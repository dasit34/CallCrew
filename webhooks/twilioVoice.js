const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const Business = require('../models/Business');
const Call = require('../models/Call');
const IndustryTemplate = require('../models/IndustryTemplate');
const openaiService = require('../services/openaiService');
const leadCaptureService = require('../services/leadCaptureService');
const { CHAT_MODEL, SYSTEM_PROMPT } = require('../openaiModels');

// In-memory conversation store (in production, use Redis)
const conversations = new Map();

/**
 * Voice Configuration
 * Maps OpenAI voice types to Amazon Polly voices (used by Twilio <Say>)
 * Note: Twilio uses Polly for TTS, not OpenAI TTS (for lower latency in real-time calls)
 */
const VOICE_MAP = {
  alloy: 'Polly.Matthew',     // Balanced, professional -> Matthew
  echo: 'Polly.Joey',          // Clear, articulate -> Joey
  fable: 'Polly.Joanna',       // Warm, friendly -> Joanna
  onyx: 'Polly.Brian',         // Deep, authoritative -> Brian (UK)
  nova: 'Polly.Salli',         // Energetic, upbeat -> Salli
  shimmer: 'Polly.Kimberly',   // Smooth, calming -> Kimberly
};

const DEFAULT_VOICE = 'Polly.Joanna';

/**
 * Get Polly voice for business
 */
function getVoiceForBusiness(business) {
  const voiceType = business?.voiceType || 'nova';
  return VOICE_MAP[voiceType] || DEFAULT_VOICE;
}

/**
 * Main voice webhook - handles incoming calls
 */
router.post('/voice', async (req, res) => {
  const twiml = new VoiceResponse();
  
  try {
    // Debug logging
    console.log('=== INCOMING VOICE WEBHOOK ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      CallSid,
      AccountSid,
      From,
      To,
      CallStatus,
      CallerCity,
      CallerState,
      CallerCountry,
      CallerName
    } = req.body;

    console.log(`Incoming call: ${CallSid} from ${From} to ${To}`);
    
    // Normalize phone number (add + if missing)
    let normalizedTo = To;
    if (To && !To.startsWith('+')) {
      normalizedTo = '+' + To;
    }
    console.log('Looking up business for number:', normalizedTo);

    // Find the business by Twilio phone number
    const business = await Business.findOne({ twilioPhoneNumber: normalizedTo });
    
    if (!business) {
      console.error(`No business found for number: ${To}`);
      // Debug: List all businesses
      const allBusinesses = await Business.find().select('twilioPhoneNumber businessName');
      console.log('All businesses in DB:', allBusinesses.map(b => ({ name: b.businessName, phone: b.twilioPhoneNumber })));
      twiml.say('Sorry, this number is not configured. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }
    console.log('Found business:', business.businessName);

    // Check if business is active
    if (!business.isActive) {
      twiml.say('Sorry, this business is currently not accepting calls. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // Get industry template
    const template = business.industryTemplate 
      ? await IndustryTemplate.findById(business.industryTemplate)
      : await IndustryTemplate.getBySlug(business.industry);

    // Check business hours
    const isAfterHours = !business.isCurrentlyOpen();

    // Create call record
    const call = new Call({
      business: business._id,
      twilioCallSid: CallSid,
      twilioAccountSid: AccountSid,
      fromNumber: From,
      toNumber: To,
      status: 'in-progress',
      direction: 'inbound',
      metadata: {
        city: CallerCity,
        state: CallerState,
        country: CallerCountry,
        callerName: CallerName,
        isAfterHours
      }
    });
    await call.save();

    // Initialize conversation
    const greeting = openaiService.generateGreeting(business, isAfterHours);
    const systemPrompt = openaiService.generateSystemPrompt(business, template);
    const voice = getVoiceForBusiness(business);

    conversations.set(CallSid, {
      businessId: business._id.toString(),
      callId: call._id.toString(),
      systemPrompt,
      history: [],
      isAfterHours,
      voice // Store voice for use in gather webhook
    });

    console.log(`Using voice: ${voice} for business: ${business.businessName}`);

    // Add greeting to transcript
    await call.addTranscriptEntry('assistant', greeting);

    // Respond with greeting and gather input
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US',
      enhanced: true
    });
    
    gather.say({
      voice
    }, greeting);

    // If no input, prompt again
    twiml.redirect('/webhooks/twilio/voice/no-input?CallSid=' + CallSid);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error handling voice webhook:', error);
    twiml.say('Sorry, we encountered an error. Please try again later.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

/**
 * Gather webhook - processes speech input
 */
router.post('/gather', async (req, res) => {
  const twiml = new VoiceResponse();
  
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;
    
    console.log(`Speech received for ${CallSid}: "${SpeechResult}" (confidence: ${Confidence})`);

    const conversation = conversations.get(CallSid);
    
    if (!conversation) {
      console.error(`No conversation found for CallSid: ${CallSid}`);
      twiml.say('Sorry, there was an error with your call. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // Get call document
    const call = await Call.findById(conversation.callId);
    
    if (!call) {
      twiml.say('Sorry, there was an error. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // Add user message to transcript
    await call.addTranscriptEntry('user', SpeechResult);
    
    // Add to conversation history
    conversation.history.push({ role: 'user', content: SpeechResult });

    // Check for end-of-call keywords
    const endKeywords = ['goodbye', 'bye', 'thanks bye', 'thank you bye', 'that\'s all', 'nothing else'];
    if (endKeywords.some(keyword => SpeechResult.toLowerCase().includes(keyword))) {
      return await handleCallEnd(call, conversation, twiml, res);
    }

    // Get the stored voice for this conversation
    const voice = conversation.voice || DEFAULT_VOICE;

    // Check conversation turn limit
    if (conversation.history.length >= 20) {
      twiml.say({
        voice
      }, 'Thank you for your call. Someone will follow up with you shortly. Goodbye!');
      
      await handleCallEnd(call, conversation, twiml, res, false);
      return;
    }

    // Generate AI response using CHAT_MODEL (gpt-4o-mini)
    const { response, tokensUsed, responseTime, model } = await openaiService.processConversation(
      conversation.history,
      conversation.systemPrompt,
      { maxTokens: 150 }
    );

    console.log(`AI response generated using ${model} in ${responseTime}ms`);

    // Update stats
    call.aiStats.tokensUsed += tokensUsed;
    call.aiStats.responseTime = ((call.aiStats.responseTime * call.aiStats.turnsCount) + responseTime) / (call.aiStats.turnsCount + 1);
    
    // Add AI response to transcript and history
    await call.addTranscriptEntry('assistant', response);
    conversation.history.push({ role: 'assistant', content: response });

    // Continue the conversation
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US',
      enhanced: true
    });
    
    gather.say({
      voice
    }, response);

    // If no input, check if we should end or prompt again
    twiml.redirect('/webhooks/twilio/voice/no-input?CallSid=' + CallSid);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in gather webhook:', error);
    twiml.say('Sorry, I had trouble understanding. Could you please repeat that?');
    
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    
    const voice = conversation?.voice || DEFAULT_VOICE;
    gather.say({ voice }, 'I\'m here to help. What can I do for you?');
    
    res.type('text/xml').send(twiml.toString());
  }
});

/**
 * Handle no input from caller
 */
router.post('/voice/no-input', async (req, res) => {
  const twiml = new VoiceResponse();
  const { CallSid } = req.query;

  const conversation = conversations.get(CallSid);
  
  if (!conversation) {
    twiml.say('Goodbye.');
    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  // Track no-input count
  conversation.noInputCount = (conversation.noInputCount || 0) + 1;

  const voice = conversation.voice || DEFAULT_VOICE;

  if (conversation.noInputCount >= 3) {
    const call = await Call.findById(conversation.callId);
    twiml.say({
      voice
    }, 'I haven\'t heard from you. Thank you for calling. Goodbye!');
    
    if (call) {
      await handleCallEnd(call, conversation, twiml, res, false);
    } else {
      twiml.hangup();
      res.type('text/xml').send(twiml.toString());
    }
    return;
  }

  const gather = twiml.gather({
    input: 'speech',
    action: '/webhooks/twilio/gather',
    method: 'POST',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  
  gather.say({
    voice
  }, 'Are you still there? How can I help you?');

  twiml.redirect('/webhooks/twilio/voice/no-input?CallSid=' + CallSid);

  res.type('text/xml').send(twiml.toString());
});

/**
 * Call status webhook
 */
router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`Call status update: ${CallSid} - ${CallStatus}`);

    const call = await Call.findOne({ twilioCallSid: CallSid });
    
    if (call) {
      call.status = CallStatus;
      
      if (['completed', 'failed', 'busy', 'no-answer', 'cancelled'].includes(CallStatus)) {
        call.endTime = new Date();
        if (CallDuration) {
          call.duration = parseInt(CallDuration);
        }

        // Capture lead if we have a conversation
        const conversation = conversations.get(CallSid);
        if (conversation && conversation.history.length > 0) {
          const business = await Business.findById(conversation.businessId);
          
          if (business && !call.leadCaptured) {
            try {
              await leadCaptureService.captureFromCall({
                call,
                business,
                transcript: conversation.history
              });
            } catch (err) {
              console.error('Error capturing lead:', err);
            }
          }

          // Generate summary
          try {
            const summary = await openaiService.generateSummary(conversation.history);
            call.conversationSummary = summary;
          } catch (err) {
            console.error('Error generating summary:', err);
          }
        }

        // Clean up conversation
        conversations.delete(CallSid);
        
        // Update business stats
        await call.completeCall(call.conversationSummary);
      } else {
        await call.save();
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling status webhook:', error);
    res.sendStatus(500);
  }
});

/**
 * Recording status webhook
 */
router.post('/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid } = req.body;
    
    const call = await Call.findOne({ twilioCallSid: CallSid });
    
    if (call) {
      call.recordingUrl = RecordingUrl;
      call.recordingSid = RecordingSid;
      await call.save();
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling recording webhook:', error);
    res.sendStatus(500);
  }
});

/**
 * Handle call end - capture lead and summarize
 */
async function handleCallEnd(call, conversation, twiml, res, sayGoodbye = true) {
  try {
    const business = await Business.findById(conversation.businessId);

    // Analyze sentiment and intent from last message
    if (conversation.history.length > 0) {
      const lastUserMessage = conversation.history.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        call.sentiment = await openaiService.analyzeSentiment(lastUserMessage.content);
        call.callerIntent = await openaiService.analyzeIntent(conversation.history[0]?.content || lastUserMessage.content);
      }
    }

    // Capture lead
    if (business && conversation.history.length > 0) {
      try {
        await leadCaptureService.captureFromCall({
          call,
          business,
          transcript: conversation.history
        });
      } catch (err) {
        console.error('Error capturing lead:', err);
      }
    }

    // Generate summary
    if (conversation.history.length > 0) {
      const summary = await openaiService.generateSummary(conversation.history);
      call.conversationSummary = summary;
    }

    if (sayGoodbye) {
      const voice = conversation.voice || DEFAULT_VOICE;
      twiml.say({
        voice
      }, 'Thank you for calling. Have a great day! Goodbye.');
    }
    
    twiml.hangup();

    // Clean up
    conversations.delete(call.twilioCallSid);
    
    await call.completeCall(call.conversationSummary);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error handling call end:', error);
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
}

module.exports = router;
