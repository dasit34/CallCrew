const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const Business = require('../models/Business');
const Call = require('../models/Call');
const IndustryTemplate = require('../models/IndustryTemplate');
const openaiService = require('../services/openaiService');
const leadCaptureService = require('../services/leadCaptureService');

// In-memory conversation store (in production, use Redis)
const conversations = new Map();

/**
 * SINGLE CONSISTENT VOICE FOR ALL RESPONSES
 * Using Polly.Joanna - professional female voice
 */
const VOICE = 'Polly.Joanna';

/**
 * Helper: Send TwiML response with proper headers
 */
function sendTwiML(res, twiml) {
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
}

/**
 * Main voice webhook - handles incoming calls
 * Returns TwiML only
 */
router.post('/voice', async (req, res) => {
  const twiml = new VoiceResponse();
  
  try {
    console.log('=== INCOMING VOICE WEBHOOK ===');
    console.log('CallSid:', req.body.CallSid);
    console.log('From:', req.body.From);
    console.log('To:', req.body.To);
    
    const { CallSid, AccountSid, From, To, CallerCity, CallerState, CallerCountry, CallerName } = req.body;

    // Normalize phone number (add + if missing)
    let normalizedTo = To;
    if (To && !To.startsWith('+')) {
      normalizedTo = '+' + To;
    }

    // Find the business by Twilio phone number
    const business = await Business.findOne({ twilioPhoneNumber: normalizedTo });
    
    if (!business) {
      console.error(`No business found for number: ${normalizedTo}`);
      twiml.say({ voice: VOICE }, 'Sorry, this number is not configured. Goodbye.');
      twiml.hangup();
      return sendTwiML(res, twiml);
    }
    
    console.log('Found business:', business.businessName);

    // Check if business is active
    if (!business.isActive) {
      twiml.say({ voice: VOICE }, 'Sorry, this business is currently not accepting calls. Goodbye.');
      twiml.hangup();
      return sendTwiML(res, twiml);
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

    conversations.set(CallSid, {
      businessId: business._id.toString(),
      callId: call._id.toString(),
      systemPrompt,
      history: [],
      isAfterHours,
      noInputCount: 0
    });

    // Add greeting to transcript
    await call.addTranscriptEntry('assistant', greeting);

    console.log('Greeting:', greeting);

    // Respond with greeting using <Say>, then gather speech input
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, greeting);

    // If no input, redirect to no-input handler
    twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + CallSid);

    return sendTwiML(res, twiml);
  } catch (error) {
    console.error('Error handling voice webhook:', error);
    twiml.say({ voice: VOICE }, 'Sorry, we encountered an error. Please try again later.');
    twiml.hangup();
    return sendTwiML(res, twiml);
  }
});

/**
 * Gather webhook - processes speech input
 * Returns TwiML only
 * HARDENED: Safely handles missing/empty SpeechResult
 */
router.post('/gather', async (req, res) => {
  const twiml = new VoiceResponse();
  
  try {
    // SAFELY extract speech data - handle undefined/null/empty
    const callSid = req.body.CallSid || '';
    const speechResult = req.body.SpeechResult || '';
    const confidence = parseFloat(req.body.Confidence) || 0;
    
    console.log(`=== GATHER WEBHOOK ===`);
    console.log(`CallSid: ${callSid}`);
    console.log(`Speech: "${speechResult}" (confidence: ${confidence})`);
    console.log(`Raw body:`, JSON.stringify(req.body));

    // CRITICAL: Handle missing CallSid
    if (!callSid) {
      console.error('No CallSid in request');
      twiml.say({ voice: VOICE }, 'Sorry, there was a connection error. Goodbye.');
      twiml.hangup();
      return sendTwiML(res, twiml);
    }

    const conversation = conversations.get(callSid);
    
    if (!conversation) {
      console.error(`No conversation found for CallSid: ${callSid}`);
      twiml.say({ voice: VOICE }, 'Sorry, there was an error with your call. Goodbye.');
      twiml.hangup();
      return sendTwiML(res, twiml);
    }

    // CRITICAL: Handle empty/missing speech input
    if (!speechResult || speechResult.trim() === '') {
      console.log(`Empty speech input for CallSid: ${callSid}`);
      conversation.noInputCount = (conversation.noInputCount || 0) + 1;
      
      // After 3 empty inputs, end call
      if (conversation.noInputCount >= 3) {
        const call = await Call.findById(conversation.callId);
        twiml.say({ voice: VOICE }, 'I\'m having trouble hearing you. Thank you for calling. Goodbye!');
        if (call) {
          return await handleCallEnd(call, conversation, twiml, res, false);
        }
        twiml.hangup();
        return sendTwiML(res, twiml);
      }
      
      // Prompt to repeat
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhooks/twilio/gather',
        method: 'POST',
        speechTimeout: '5',
        language: 'en-US'
      });
      gather.say({ voice: VOICE }, 'I didn\'t catch that. Could you please repeat?');
      
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);
      return sendTwiML(res, twiml);
    }

    // CRITICAL: Handle very low confidence (likely noise/garbage)
    if (confidence > 0 && confidence < 0.3) {
      console.log(`Low confidence (${confidence}) for speech: "${speechResult}"`);
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhooks/twilio/gather',
        method: 'POST',
        speechTimeout: '5',
        language: 'en-US'
      });
      gather.say({ voice: VOICE }, 'Sorry, I had trouble understanding. Could you say that again?');
      
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);
      return sendTwiML(res, twiml);
    }

    // Reset no-input count since we got valid speech
    conversation.noInputCount = 0;

    // Get call document
    const call = await Call.findById(conversation.callId);
    
    if (!call) {
      console.error(`No call document found for callId: ${conversation.callId}`);
      twiml.say({ voice: VOICE }, 'Sorry, there was an error. Goodbye.');
      twiml.hangup();
      return sendTwiML(res, twiml);
    }

    // Add user message to transcript
    await call.addTranscriptEntry('user', speechResult);
    
    // Add to conversation history
    conversation.history.push({ role: 'user', content: speechResult });

    // Check for end-of-call keywords
    const lowerSpeech = speechResult.toLowerCase();
    if (lowerSpeech.includes('goodbye') || lowerSpeech.includes('bye') || 
        lowerSpeech.includes('that\'s all') || lowerSpeech.includes('nothing else')) {
      return await handleCallEnd(call, conversation, twiml, res, true);
    }

    // Check conversation turn limit (prevent infinite loops)
    if (conversation.history.length >= 20) {
      twiml.say({ voice: VOICE }, 'Thank you for your call. Someone will follow up with you shortly. Goodbye!');
      return await handleCallEnd(call, conversation, twiml, res, false);
    }

    // Generate AI response using OpenAI Chat (NOT TTS)
    console.log('Generating AI response...');
    const startTime = Date.now();
    
    let aiResponse;
    try {
      aiResponse = await openaiService.processConversation(
        conversation.history,
        conversation.systemPrompt,
        { maxTokens: 150 }
      );
    } catch (aiError) {
      console.error('OpenAI API error:', aiError);
      // Graceful fallback - don't crash
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhooks/twilio/gather',
        method: 'POST',
        speechTimeout: '5',
        language: 'en-US'
      });
      gather.say({ voice: VOICE }, 'I\'m sorry, I\'m having a moment. Could you repeat that?');
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);
      return sendTwiML(res, twiml);
    }

    const { response, tokensUsed, model } = aiResponse;

    console.log(`AI response (${Date.now() - startTime}ms, ${model}): "${response}"`);

    // Update call stats
    call.aiStats.tokensUsed += tokensUsed;
    call.aiStats.turnsCount += 1;
    await call.save();
    
    // Add AI response to transcript and history
    await call.addTranscriptEntry('assistant', response);
    conversation.history.push({ role: 'assistant', content: response });

    // Use Twilio <Say> to speak the response, then gather more input
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, response);

    // If no input, redirect to no-input handler
    twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);

    return sendTwiML(res, twiml);
  } catch (error) {
    console.error('Error in gather webhook:', error);
    console.error('Error stack:', error.stack);
    
    // CRITICAL: Safe error recovery - never crash, always return valid TwiML
    const errorCallSid = req.body?.CallSid || '';
    
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: '5',
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, 'Sorry, I had trouble with that. Could you please repeat?');
    
    if (errorCallSid) {
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + errorCallSid);
    } else {
      twiml.say({ voice: VOICE }, 'I\'m sorry, there was a technical issue. Goodbye.');
      twiml.hangup();
    }
    
    return sendTwiML(res, twiml);
  }
});

/**
 * No-input webhook - handles silence from caller
 * Returns TwiML only
 */
router.post('/no-input', async (req, res) => {
  const twiml = new VoiceResponse();
  const CallSid = req.query.CallSid || req.body.CallSid;

  console.log(`=== NO INPUT WEBHOOK === CallSid: ${CallSid}`);

  const conversation = conversations.get(CallSid);
  
  if (!conversation) {
    twiml.say({ voice: VOICE }, 'Goodbye.');
    twiml.hangup();
    return sendTwiML(res, twiml);
  }

  // Track no-input count
  conversation.noInputCount = (conversation.noInputCount || 0) + 1;
  console.log(`No-input count: ${conversation.noInputCount}`);

  // After 3 no-inputs, end the call
  if (conversation.noInputCount >= 3) {
    const call = await Call.findById(conversation.callId);
    twiml.say({ voice: VOICE }, 'I haven\'t heard from you. Thank you for calling. Goodbye!');
    
    if (call) {
      return await handleCallEnd(call, conversation, twiml, res, false);
    } else {
      twiml.hangup();
      return sendTwiML(res, twiml);
    }
  }

  // Prompt again
  const gather = twiml.gather({
    input: 'speech',
    action: '/webhooks/twilio/gather',
    method: 'POST',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  gather.say({ voice: VOICE }, 'Are you still there? How can I help you?');

  twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + CallSid);

  return sendTwiML(res, twiml);
});

/**
 * Call status webhook - updates call status in DB
 * Returns 200 OK (not TwiML)
 */
router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`=== STATUS WEBHOOK === ${CallSid}: ${CallStatus}`);

    const call = await Call.findOne({ twilioCallSid: CallSid });
    
    if (call) {
      call.status = CallStatus;
      
      if (['completed', 'failed', 'busy', 'no-answer', 'cancelled'].includes(CallStatus)) {
        call.endTime = new Date();
        if (CallDuration) {
          call.duration = parseInt(CallDuration);
        }

        // Process conversation data
        const conversation = conversations.get(CallSid);
        if (conversation && conversation.history.length > 0) {
          const business = await Business.findById(conversation.businessId);
          
          // Capture lead
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
        
        // Save and update business stats
        await call.completeCall(call.conversationSummary);
        console.log(`Call ${CallSid} completed and saved`);
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
 * Recording webhook
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
 * Handle call end - capture lead, summarize, say goodbye
 */
async function handleCallEnd(call, conversation, twiml, res, sayGoodbye = true) {
  try {
    console.log('=== HANDLING CALL END ===');
    
    const business = await Business.findById(conversation.businessId);

    // Analyze sentiment and intent
    if (conversation.history.length > 0) {
      const lastUserMessage = conversation.history.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        try {
          call.sentiment = await openaiService.analyzeSentiment(lastUserMessage.content);
          call.callerIntent = await openaiService.analyzeIntent(conversation.history[0]?.content || lastUserMessage.content);
        } catch (err) {
          console.error('Error analyzing call:', err);
        }
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
      try {
        const summary = await openaiService.generateSummary(conversation.history);
        call.conversationSummary = summary;
      } catch (err) {
        console.error('Error generating summary:', err);
      }
    }

    // Say goodbye using consistent voice
    if (sayGoodbye) {
      twiml.say({ voice: VOICE }, 'Thank you for calling. Have a great day! Goodbye.');
    }
    
    twiml.hangup();

    // Clean up and save
    conversations.delete(call.twilioCallSid);
    await call.completeCall(call.conversationSummary);
    
    console.log('Call ended and saved successfully');

    return sendTwiML(res, twiml);
  } catch (error) {
    console.error('Error handling call end:', error);
    twiml.hangup();
    return sendTwiML(res, twiml);
  }
}

module.exports = router;
