const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const Business = require('../models/Business');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const CallState = require('../models/CallState');
const openaiService = require('../services/openaiService');
const leadCaptureService = require('../services/leadCaptureService');
const summaryService = require('../services/summaryService');
const emailService = require('../services/emailService');

// In-memory conversation cache (primary state is stored in Mongo via CallState)
const conversations = new Map();

/**
 * SINGLE CONSISTENT VOICE FOR ALL RESPONSES
 */
const VOICE = 'Polly.Joanna';

/**
 * CONVERSATION STAGES
 * - Scripted stages don't call OpenAI (fast & free)
 * - Only ANSWER_QUESTION stage calls OpenAI
 */
const STAGES = {
  GREETING: 'GREETING',
  GET_NAME: 'GET_NAME',
  GET_PHONE: 'GET_PHONE',
  GET_REASON: 'GET_REASON',
  ANSWER_QUESTION: 'ANSWER_QUESTION',
  FOLLOW_UP: 'FOLLOW_UP',
  END: 'END'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Send TwiML response with proper headers
 */
function sendTwiML(res, twiml) {
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
}

/**
 * Run async fn, return { result, ms }. Used for latency instrumentation.
 */
async function measure(name, fn) {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

/**
 * Log turn-by-turn latency as JSON one-liner for Railway log parsing.
 * Fields: stt_ms (0; Twilio does STT), llm_ms, tts_ms, db_ms, total_turn_ms, callSid, turnIndex.
 * Grep Railway logs for _type: "turn_latency" or "turn_latency".
 */
function logTurnLatency(payload) {
  console.log(JSON.stringify({ _type: 'turn_latency', ...payload }));
}

/**
 * Generate TwiML for gathering speech input
 */
function generateGatherResponse(sayText, voice = VOICE) {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    input: 'speech',
    action: '/webhooks/twilio/gather',
    method: 'POST',
    speechTimeout: 2,  // Shorter trailing silence = faster turn-around (was 3)
    timeout: 10,       // Allow 10s for user to start speaking
    language: 'en-US'
  });
  gather.say({ voice }, sayText);
  return twiml;
}

/**
 * Detect goodbye/end phrases with stage awareness
 */
function isGoodbye(text, currentStage) {
  if (!text) return false;

  const lower = text.toLowerCase().trim();
  const dataStages = ['GREETING', 'GET_NAME', 'GET_PHONE', 'GET_REASON'];

  // During data collection stages, only act on explicit goodbyes
  if (dataStages.includes(currentStage)) {
    const explicit = ['goodbye', 'bye bye', 'gotta go', 'talk later'];
    return explicit.some(p => new RegExp(`\\b${p}\\b`, 'i').test(lower));
  }

  // After main data is collected, be more flexible
  const flexible = ['goodbye', 'bye', 'thank you bye', "that's all", 'no thanks'];
  return flexible.some(p => new RegExp(`\\b${p}\\b`, 'i').test(lower));
}

/**
 * Detect affirmative responses
 */
function isAffirmative(text) {
  const affirmativePhrases = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'please', 'go ahead'];
  const lower = text.toLowerCase();
  return affirmativePhrases.some(phrase => lower.includes(phrase));
}

/**
 * Detect negative responses
 */
function isNegative(text) {
  const negativePhrases = ['no', 'nope', 'nah', "don't", 'not'];
  const lower = text.toLowerCase();
  return negativePhrases.some(phrase => lower.includes(phrase));
}

/**
 * Extract phone number from speech (more robust)
 */
function extractPhoneNumber(speech) {
  console.log('Phone input:', speech);
  
  const refusals = [
    "i don't have", 'i dont have', 'not sure',
    "don't know", 'no phone'
  ];
  
  const lower = speech.toLowerCase();
  if (refusals.some(p => lower.includes(p))) return null;
  
  const digits = speech.replace(/\D/g, '');
  
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (digits.length >= 7) return `+1${digits.padEnd(10, '0')}`;
  
  return null;
}

/**
 * CallState helpers - Mongo-backed conversation state
 */
async function getCallState(callSid) {
  try {
    let state = await CallState.findOne({ callSid });
    if (!state) {
      state = await CallState.create({
        callSid,
        stage: 'GREETING',
        collectedData: {},
        retryAttempts: {},
        transcript: []
      });
    }
    return state;
  } catch (error) {
    console.error('Error getting call state:', error);
    throw error;
  }
}

async function updateCallState(callSid, updates) {
  try {
    return await CallState.findOneAndUpdate(
      { callSid },
      { ...updates, lastUpdated: new Date() },
      { new: true, upsert: true }
    );
  } catch (error) {
    console.error('Error updating call state:', error);
    throw error;
  }
}

async function addToTranscript(callSid, speaker, message) {
  try {
    await CallState.findOneAndUpdate(
      { callSid },
      { $push: { transcript: `${speaker}: ${message}` } }
    );
  } catch (error) {
    console.error('Error updating CallState transcript:', error);
  }
}

/**
 * Handle no-input scenarios with timeout tracking
 */
async function handleNoInput(callSid) {
  try {
    const state = await getCallState(callSid);
    
    // Track timeout count
    const timeoutCount = (state.timeoutCount || 0) + 1;
    
    if (timeoutCount >= 2) {
      // After 2 timeouts, move to next stage with "unclear"
      console.log(`⚠ Max timeouts reached for ${callSid}, moving on`);
      
      return {
        response: "I'm having trouble hearing you. Let me ask you something else.",
        moveToNextStage: true,
        storeAsUnclear: true
      };
    }
    
    // Update timeout count
    await updateCallState(callSid, { timeoutCount });
    
    // Re-ask the SAME question they didn't answer
    const currentQuestion = state.currentQuestion || "How can I help you today?";
    
    console.log(`Timeout ${timeoutCount}/2 for ${callSid}, re-asking: ${currentQuestion}`);
    
    return {
      response: `I didn't hear anything. ${currentQuestion}`,
      stage: state.stage, // Stay on same stage
      keepAsking: true
    };
  } catch (error) {
    console.error('Error handling no-input:', error);
    return {
      response: "I didn't catch that. How can I help you today?",
      stage: 'GREETING'
    };
  }
}

/**
 * Persist full transcript from CallState onto Call document
 */
async function saveTranscript(callSid) {
  try {
    const callState = await CallState.findOne({ callSid });
    const call = await Call.findOne({ twilioCallSid: callSid });

    if (callState && call) {
      const transcriptArray = Array.isArray(callState.transcript) ? callState.transcript : [];
      const fullTranscript = transcriptArray.join('\n');

      call.fullTranscript = fullTranscript;
      call.conversationLength = transcriptArray.length;
      call.completedAt = new Date();

      await call.save();
      console.log(`✓ Saved transcript for ${callSid}: ${fullTranscript.length} chars`);
      return true;
    } else {
      console.log(`⚠ Missing CallState or Call for ${callSid}`);
      return false;
    }
  } catch (error) {
    console.error('✗ Error saving transcript:', error);
    return false;
  }
}

/**
 * Detect SALES/ProductInfo intent from user utterance
 * Returns { isSales: boolean, subtype: string, response: string }
 */
function detectSalesIntent(question, businessName) {
  if (!question) return { isSales: false };
  
  const lower = question.toLowerCase();
  
  // SALES intent patterns - explicit interest signals
  const salesPatterns = {
    demo: {
      keywords: ['demo', 'demonstration', 'show me', 'see it in action', 'try it', 'trial'],
      response: `I'd love to get you set up with a demo! Let me make sure we have your info so our team can schedule a quick walkthrough. Can I confirm your phone number?`
    },
    pricing: {
      keywords: ['pricing', 'price', 'cost', 'how much', 'fee', 'rate', 'subscription', 'plan', 'package'],
      response: `Great question! Pricing depends on your call volume and specific needs. Our team can put together a custom quote for you. Can I confirm your contact info so they can reach out with details?`
    },
    interested: {
      keywords: ['interested', 'want to sign up', 'want to try', 'sign me up', 'get started', 'set me up', 'learn more'],
      response: `That's great to hear! I'll make sure our team follows up to get you set up. Can I confirm the best number to reach you?`
    },
    howItWorks: {
      keywords: ['how does it work', 'how it works', 'what does it do', 'tell me about', 'explain', 'what is callcrew', 'what is this'],
      response: `${businessName || 'CallCrew'} is an AI phone receptionist that answers calls 24/7, captures lead info, and sends you instant notifications. It handles FAQs, takes messages, and ensures you never miss a potential customer. Would you like to see it in action with a demo?`
    },
    features: {
      keywords: ['feature', 'capability', 'can it', 'does it', 'what can', 'functionality'],
      response: `${businessName || 'CallCrew'} can answer calls 24/7, capture caller information, answer frequently asked questions, send email notifications for each lead, and provide call transcripts. Is there a specific feature you'd like to know more about?`
    },
    comparison: {
      keywords: ['compared to', 'vs', 'versus', 'better than', 'difference between', 'competitor'],
      response: `Great question! Our team can walk you through how ${businessName || 'CallCrew'} compares to other solutions. Can I get your contact info so they can give you a detailed comparison?`
    }
  };
  
  // Check each pattern
  for (const [subtype, pattern] of Object.entries(salesPatterns)) {
    if (pattern.keywords.some(kw => lower.includes(kw))) {
      console.log(`=== SALES INTENT DETECTED: ${subtype} ===`);
      return {
        isSales: true,
        subtype,
        response: pattern.response
      };
    }
  }
  
  return { isSales: false };
}

/**
 * Check FAQs for matching answer (no OpenAI needed)
 * Returns answer string or null if no match
 */
function checkFAQs(question, faqs) {
  if (!faqs || faqs.length === 0) return null;
  
  const lowerQuestion = question.toLowerCase();
  
  // Common question patterns to check
  const patterns = [
    { keywords: ['hour', 'open', 'close', 'time'], type: 'hours' },
    { keywords: ['price', 'cost', 'how much', 'fee', 'rate'], type: 'pricing' },
    { keywords: ['location', 'address', 'where', 'directions'], type: 'location' },
    { keywords: ['appointment', 'book', 'schedule', 'available'], type: 'booking' },
    { keywords: ['service', 'offer', 'provide', 'do you'], type: 'services' },
    { keywords: ['demo', 'trial', 'try', 'test'], type: 'demo' },
    { keywords: ['feature', 'capability', 'work', 'function'], type: 'features' }
  ];
  
  for (const faq of faqs) {
    if (!faq.question || !faq.answer) continue;
    
    const faqLower = faq.question.toLowerCase();
    
    // Direct keyword matching
    const faqWords = faqLower.split(/\s+/).filter(w => w.length > 3);
    const questionWords = lowerQuestion.split(/\s+/);
    
    // Count matching significant words
    let matchCount = 0;
    for (const word of faqWords) {
      if (questionWords.some(qw => qw.includes(word) || word.includes(qw))) {
        matchCount++;
      }
    }
    
    // If 2+ words match, use this FAQ
    if (matchCount >= 2) {
      return faq.answer;
    }
    
    // Check pattern-based matching
    for (const pattern of patterns) {
      const questionMatchesPattern = pattern.keywords.some(k => lowerQuestion.includes(k));
      const faqMatchesPattern = pattern.keywords.some(k => faqLower.includes(k));
      
      if (questionMatchesPattern && faqMatchesPattern) {
        return faq.answer;
      }
    }
  }
  
  return null;
}

/**
 * Extract name from speech (basic cleanup)
 */
function extractName(speech) {
  // Remove common prefixes
  let name = speech.replace(/^(my name is|this is|i'm|i am|it's|call me)\s*/i, '');
  
  // Capitalize first letter of each word
  name = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name.trim() || speech;
}

/**
 * Validate input before advancing to next stage
 * Returns { valid: boolean, reason: string }
 */
function isValidInput(input, stage) {
  if (!input || input.trim().length === 0) {
    return { valid: false, reason: 'empty' };
  }
  
  const cleaned = input.trim().toLowerCase();
  
  switch(stage) {
    case STAGES.GET_NAME:
      // Name must be at least 2 characters, not filler words
      const fillerWords = ['um', 'uh', 'hmm', 'hm', 'hold on', 'wait', 'hold', 'one second', 
                           'what', 'huh', 'sorry', 'pardon', 'excuse me', 'let me think',
                           'i dont know', "i don't know", 'not sure', 'maybe'];
      if (fillerWords.some(f => cleaned === f || cleaned.startsWith(f + ' '))) {
        return { valid: false, reason: 'filler' };
      }
      if (cleaned.length < 2) {
        return { valid: false, reason: 'too_short' };
      }
      // Check if it looks like a question (not a name)
      if (cleaned.includes('?') || cleaned.startsWith('what') || cleaned.startsWith('how')) {
        return { valid: false, reason: 'question' };
      }
      return { valid: true, reason: null };
      
    case STAGES.GET_PHONE:
      // Phone must have at least 7 digits
      const digits = input.replace(/\D/g, '');
      if (digits.length < 7) {
        // Check if they said they don't have a phone
        if (cleaned.includes("don't have") || cleaned.includes('dont have') || 
            cleaned.includes('no phone') || cleaned.includes('not sure')) {
          return { valid: false, reason: 'no_phone' };
        }
        return { valid: false, reason: 'invalid_phone' };
      }
      return { valid: true, reason: null };
      
    case STAGES.GET_REASON:
      // Reason must be at least 5 characters or 2 words
      const words = cleaned.split(/\s+/).filter(w => w.length > 0);
      if (cleaned.length < 5 && words.length < 2) {
        return { valid: false, reason: 'too_short' };
      }
      // Check for filler responses
      const reasonFillers = ['yes', 'yeah', 'yep', 'no', 'nope', 'ok', 'okay', 'sure', 'um', 'uh'];
      if (reasonFillers.includes(cleaned)) {
        return { valid: false, reason: 'filler' };
      }
      return { valid: true, reason: null };
      
    default:
      return { valid: cleaned.length > 0, reason: null };
  }
}

/**
 * Get re-prompt message when input is invalid
 */
function getRepromptMessage(stage, reason) {
  switch(stage) {
    case STAGES.GET_NAME:
      if (reason === 'question') {
        return "I'd be happy to help with that! But first, may I have your name?";
      }
      return "I didn't quite catch your name. Could you tell me your name?";
      
    case STAGES.GET_PHONE:
      if (reason === 'no_phone') {
        return "No problem! What's the reason for your call today?";
      }
      return "I didn't get that number. Could you repeat your phone number?";
      
    case STAGES.GET_REASON:
      return "Could you tell me a bit more about why you're calling today?";
      
    default:
      return "I didn't catch that. Could you please repeat?";
  }
}

// ============================================
// MAIN WEBHOOKS
// ============================================

/**
 * Main voice webhook - handles incoming calls
 * STAGE: GREETING (Scripted - No OpenAI)
 */
router.post('/voice', async (req, res) => {
  const twiml = new VoiceResponse();
  
  try {
    console.log('=== INCOMING CALL ===');
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

    // Initialize conversation with STAGE tracking
    const conversation = {
      businessId: business._id.toString(),
      businessName: business.businessName,
      callId: call._id.toString(),
      stage: STAGES.GET_NAME, // Start by getting name
      collectedInfo: {
        name: null,
        phone: null,
        reason: null
      },
      history: [],
      faqs: business.faqs || [],
      services: business.services || [],
      customInstructions: business.customInstructions || '',
      isAfterHours,
      noInputCount: 0,
      questionCount: 0
    };
    
    conversations.set(CallSid, conversation);

    // Persist initial state to Mongo
    await updateCallState(CallSid, {
      stage: conversation.stage,
      collectedData: {
        name: conversation.collectedInfo.name,
        phone: conversation.collectedInfo.phone,
        reason: conversation.collectedInfo.reason
      },
      timeoutCount: conversation.noInputCount,
      lowConfidenceAttempts: conversation.questionCount
    });

    // Generate greeting (SCRIPTED - No OpenAI)
    const greeting = business.customGreeting 
      ? business.customGreeting 
      : `Thank you for calling ${business.businessName}! I'm here to help you today.`;
    
    const followUp = "May I have your name?";
    const fullGreeting = `${greeting} ${followUp}`;

    console.log('=== STAGE: GREETING ===');
    console.log('Greeting:', fullGreeting);

    // Store current question for no-input handling
    await updateCallState(CallSid, {
      currentQuestion: followUp,
      stage: STAGES.GET_NAME
    });

    // Add greeting to transcript (Call + CallState)
    await call.addTranscriptEntry('assistant', fullGreeting);
    conversation.history.push({ role: 'assistant', content: fullGreeting });
    await addToTranscript(CallSid, 'assistant', fullGreeting);

    // Respond with greeting, then gather speech input
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 2,  // Shorter trailing silence = faster turn-around (was 3)
      timeout: 10,       // Allow 10s for user to start speaking
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, fullGreeting);

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
 * Gather webhook - processes speech input based on STAGE
 * Most stages are SCRIPTED (no OpenAI)
 */
router.post('/gather', async (req, res) => {
  const turnStart = Date.now();
  const timing = { stt_ms: 0, llm_ms: 0, tts_ms: 0, db_ms: 0 };
  let turnIndex = -1;
  const twiml = new VoiceResponse();
  
  console.log('=== SPEECH INPUT ===');
  console.log('CallSid:', req.body.CallSid);
  console.log('SpeechResult:', req.body.SpeechResult);
  console.log('Confidence:', req.body.Confidence);
  console.log('====================');
  
  const emitTurnLatency = (callSidForLog) => {
    const total_turn_ms = Date.now() - turnStart;
    logTurnLatency({
      callSid: callSidForLog || req.body?.CallSid || '',
      turnIndex,
      stt_ms: timing.stt_ms,
      llm_ms: timing.llm_ms,
      tts_ms: timing.tts_ms,
      db_ms: timing.db_ms,
      total_turn_ms
    });
  };

  const runDb = async (fn) => {
    const { result, ms } = await measure('db', fn);
    timing.db_ms += ms;
    return result;
  };
  const runLlm = async (fn) => {
    const { result, ms } = await measure('llm', fn);
    timing.llm_ms += ms;
    return result;
  };

  try {
    const callSid = req.body.CallSid || '';
    const speechResult = req.body.SpeechResult || '';
    const MIN_CONFIDENCE = 0.15; // Lowered from 0.3
    const confidence = parseFloat(req.body.Confidence) || 0;

    // Handle missing CallSid
    if (!callSid) {
      console.error('No CallSid in request');
      twiml.say({ voice: VOICE }, 'Sorry, there was a connection error. Goodbye.');
      twiml.hangup();
      const { ms } = await measure('tts', () => sendTwiML(res, twiml));
      timing.tts_ms += ms;
      emitTurnLatency('');
      return;
    }

    let conversation = conversations.get(callSid);
    
    if (!conversation) {
      console.warn(`No in-memory conversation for CallSid: ${callSid}. Attempting recovery from CallState.`);
      const dbRecovery = await measure('db', async () => {
        const state = await CallState.findOne({ callSid });
        if (!state) return { state: null, call: null, business: null };
        const call = await Call.findOne({ twilioCallSid: callSid }).populate('business');
        return { state, call, business: call?.business };
      });
      timing.db_ms += dbRecovery.ms;
      const { state, call, business } = dbRecovery.result;

      if (!state) {
        console.error(`No conversation or CallState found for CallSid: ${callSid}`);
        twiml.say({ voice: VOICE }, 'Sorry, there was an error with your call. Goodbye.');
        twiml.hangup();
        const { ms } = await measure('tts', () => sendTwiML(res, twiml));
        timing.tts_ms += ms;
        emitTurnLatency(callSid);
        return;
      }

      if (!call || !business) {
        console.error(`Unable to reconstruct conversation for CallSid: ${callSid} (missing Call/Business)`);
        twiml.say({ voice: VOICE }, 'Sorry, there was an error with your call. Goodbye.');
        twiml.hangup();
        const { ms } = await measure('tts', () => sendTwiML(res, twiml));
        timing.tts_ms += ms;
        emitTurnLatency(callSid);
        return;
      }

      conversation = {
        businessId: business._id.toString(),
        businessName: business.businessName,
        callId: call._id.toString(),
        stage: state.stage || STAGES.GET_NAME,
        collectedInfo: {
          name: state.collectedData?.name || null,
          phone: state.collectedData?.phone || null,
          reason: state.collectedData?.reason || null
        },
        history: [],
        faqs: business.faqs || [],
        services: business.services || [],
        customInstructions: business.customInstructions || '',
        isAfterHours: call.metadata?.isAfterHours || false,
        noInputCount: state.timeoutCount || 0,
        questionCount: state.lowConfidenceAttempts || 0
      };

      conversations.set(callSid, conversation);
    }

    // Handle empty speech input
    if (!speechResult || speechResult.trim() === '') {
      conversation.turnIndex = (conversation.turnIndex ?? 0) + 1;
      turnIndex = conversation.turnIndex;
      conversation.noInputCount = (conversation.noInputCount || 0) + 1;
      await runDb(() => updateCallState(callSid, { timeoutCount: conversation.noInputCount }));
      
      if (conversation.noInputCount >= 3) {
        emitTurnLatency(callSid);
        return await endCall(callSid, twiml, res, "I'm having trouble hearing you. Thank you for calling. Goodbye!");
      }
      
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhooks/twilio/gather',
        method: 'POST',
        speechTimeout: 2,
        timeout: 10,
        language: 'en-US'
      });
      gather.say({ voice: VOICE }, "I didn't catch that. Could you please repeat?");
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);
      const { ms: ttsMs } = await measure('tts', () => sendTwiML(res, twiml));
      timing.tts_ms += ttsMs;
      emitTurnLatency(callSid);
      return;
    }

    console.log(`Speech confidence: ${confidence} for: "${speechResult}"`);

    // Handle low confidence with CallState-backed attempts
    if (confidence < MIN_CONFIDENCE) {
      console.log(`⚠ Low confidence (${confidence}): "${speechResult}"`);
      conversation.turnIndex = (conversation.turnIndex ?? 0) + 1;
      turnIndex = conversation.turnIndex;

      const lowConfResult = await runDb(async () => {
        const state = await getCallState(callSid);
        state.lowConfidenceAttempts = (state.lowConfidenceAttempts || 0) + 1;
        if (state.lowConfidenceAttempts >= 2) {
          state.lowConfidenceAttempts = 0;
          await state.save();
          await updateCallState(callSid, { lowConfidenceAttempts: 0 });
        } else {
          await state.save();
          await updateCallState(callSid, { lowConfidenceAttempts: state.lowConfidenceAttempts });
        }
        return state.lowConfidenceAttempts;
      });

      if (lowConfResult === 0) {
        // Accepted after 2 attempts – fall through to main flow
      } else {
        const gather = twiml.gather({
          input: 'speech',
          action: '/webhooks/twilio/gather',
          method: 'POST',
          speechTimeout: 2,
          timeout: 10,
          language: 'en-US'
        });
        gather.say({ voice: VOICE }, "Sorry, I had trouble understanding. Could you say that again?");
        twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);
        const { ms: ttsMs } = await measure('tts', () => sendTwiML(res, twiml));
        timing.tts_ms += ttsMs;
        emitTurnLatency(callSid);
        return;
      }
    }

    // Reset no-input count
    conversation.noInputCount = 0;
    await runDb(() => updateCallState(callSid, { timeoutCount: 0 }));

    // Get call document
    const call = await runDb(() => Call.findById(conversation.callId));
    if (!call) {
      console.error(`No call document found for callId: ${conversation.callId}`);
      conversation.turnIndex = (conversation.turnIndex ?? 0) + 1;
      turnIndex = conversation.turnIndex;
      twiml.say({ voice: VOICE }, 'Sorry, there was an error. Goodbye.');
      twiml.hangup();
      const { ms } = await measure('tts', () => sendTwiML(res, twiml));
      timing.tts_ms += ms;
      emitTurnLatency(callSid);
      return;
    }

    // Add user message to history; defer DB transcript writes (don't block response)
    conversation.history.push({ role: 'user', content: speechResult });
    runDb(async () => {
      await call.addTranscriptEntry('user', speechResult);
      await addToTranscript(callSid, 'user', speechResult);
    }).catch(err => console.error('Deferred user transcript write error:', err));

    if (turnIndex === -1) {
      conversation.turnIndex = (conversation.turnIndex ?? 0) + 1;
      turnIndex = conversation.turnIndex;
    }

    // Check for goodbye at any stage (stage-aware)
    if (isGoodbye(speechResult, conversation.stage)) {
      emitTurnLatency(callSid);
      return await endCall(callSid, twiml, res, `Thank you for calling ${conversation.businessName}. We'll be in touch soon. Have a great day!`);
    }

    console.log(`=== STAGE: ${conversation.stage} ===`);
    console.log('User said:', speechResult);

    // ========================================
    // STAGE-BASED ROUTING (mostly scripted)
    // ========================================
    
    let response = '';
    let nextStage = conversation.stage;

    switch (conversation.stage) {
      
      // ----------------------------------------
      // STAGE: GET_NAME (Scripted - No OpenAI)
      // ----------------------------------------
      case STAGES.GET_NAME: {
        const nameValidation = isValidInput(speechResult, STAGES.GET_NAME);
        
        if (!nameValidation.valid) {
          console.log('Invalid name input:', speechResult, 'Reason:', nameValidation.reason);
          
          // If they asked a question, note it but still ask for name
          if (nameValidation.reason === 'question') {
            response = getRepromptMessage(STAGES.GET_NAME, 'question');
          } else {
            response = getRepromptMessage(STAGES.GET_NAME, nameValidation.reason);
          }
          nextStage = STAGES.GET_NAME; // Stay on same stage
        } else {
          conversation.collectedInfo.name = extractName(speechResult);
          const phoneQuestion = "What's the best phone number to reach you?";
          response = `Thanks ${conversation.collectedInfo.name}! ${phoneQuestion}`;
          nextStage = STAGES.GET_PHONE;
          console.log('Collected name:', conversation.collectedInfo.name);
          
          // Store current question before asking
          await runDb(() => updateCallState(callSid, {
            stage: STAGES.GET_PHONE,
            currentQuestion: phoneQuestion,
            collectedData: {
              name: conversation.collectedInfo.name,
              phone: conversation.collectedInfo.phone,
              reason: conversation.collectedInfo.reason
            }
          }));
        }
        break;
      }

      // ----------------------------------------
      // STAGE: GET_PHONE (Scripted - No OpenAI)
      // ----------------------------------------
      case STAGES.GET_PHONE: {
        const phoneValidation = isValidInput(speechResult, STAGES.GET_PHONE);
        
        if (!phoneValidation.valid) {
          console.log('Invalid phone input:', speechResult, 'Reason:', phoneValidation.reason);
          
          // If they don't have a phone, skip to reason
          if (phoneValidation.reason === 'no_phone') {
            response = getRepromptMessage(STAGES.GET_PHONE, 'no_phone');
            nextStage = STAGES.GET_REASON;
          } else {
            response = getRepromptMessage(STAGES.GET_PHONE, phoneValidation.reason);
            nextStage = STAGES.GET_PHONE; // Stay on same stage
          }
        } else {
          const extractedPhone = extractPhoneNumber(speechResult);
          conversation.collectedInfo.phone = extractedPhone || 'Not provided';
          const reasonQuestion = "What's the reason for your call today?";
          response = `Perfect. ${reasonQuestion}`;
          nextStage = STAGES.GET_REASON;
          console.log('Collected phone:', conversation.collectedInfo.phone);
          
          // Store current question before asking
          await runDb(() => updateCallState(callSid, {
            stage: STAGES.GET_REASON,
            currentQuestion: reasonQuestion,
            collectedData: {
              name: conversation.collectedInfo.name,
              phone: conversation.collectedInfo.phone,
              reason: conversation.collectedInfo.reason
            }
          }));
        }
        break;
      }

      // ----------------------------------------
      // STAGE: GET_REASON (Check SALES intent, then FAQs, then OpenAI)
      // ----------------------------------------
      case STAGES.GET_REASON: {
        const reasonValidation = isValidInput(speechResult, STAGES.GET_REASON);
        
        if (!reasonValidation.valid) {
          console.log('Invalid reason input:', speechResult, 'Reason:', reasonValidation.reason);
          response = getRepromptMessage(STAGES.GET_REASON, reasonValidation.reason);
          nextStage = STAGES.GET_REASON; // Stay on same stage
        } else {
          conversation.collectedInfo.reason = speechResult;
          console.log('Collected reason:', speechResult);
          await runDb(() => updateCallState(callSid, {
            stage: STAGES.GET_REASON,
            collectedData: {
              name: conversation.collectedInfo.name,
              phone: conversation.collectedInfo.phone,
              reason: conversation.collectedInfo.reason
            }
          }));
          
          // 1. Check for SALES intent first (no OpenAI needed)
          const salesIntent = detectSalesIntent(speechResult, conversation.businessName);
          
          if (salesIntent.isSales) {
            console.log(`=== SALES INTENT: ${salesIntent.subtype} (No OpenAI) ===`);
            response = `${salesIntent.response} Is there anything else I can help you with?`;
            nextStage = STAGES.FOLLOW_UP;
          } else {
            // 2. Try to answer from FAQs (no OpenAI)
            const faqAnswer = checkFAQs(speechResult, conversation.faqs);
            
            if (faqAnswer) {
              console.log('=== FAQ MATCH (No OpenAI) ===');
              response = `${faqAnswer} Is there anything else I can help you with?`;
              nextStage = STAGES.FOLLOW_UP;
            } else {
              // 3. Need OpenAI for this question
              console.log('=== USING OPENAI ===');
              const aiResponse = await runLlm(() => getAIResponse(speechResult, conversation));
              response = `${aiResponse} Is there anything else I can help you with?`;
              nextStage = STAGES.FOLLOW_UP;
              conversation.questionCount++;
            }
          }
        }
        break;
      }

      // ----------------------------------------
      // STAGE: FOLLOW_UP (Check SALES intent, FAQs, then OpenAI)
      // ----------------------------------------
      case STAGES.FOLLOW_UP: {
        // Check if they're done
        if (isNegative(speechResult) || isGoodbye(speechResult, conversation.stage)) {
          const name = conversation.collectedInfo.name || 'you';
          const phone = conversation.collectedInfo.phone;
          const closingMsg = phone 
            ? `Great! We'll reach out to ${name} at ${phone} soon. Thank you for calling ${conversation.businessName}. Have a wonderful day!`
            : `Great! Thank you for calling ${conversation.businessName}. Have a wonderful day!`;
          emitTurnLatency(callSid);
          return await endCall(callSid, twiml, res, closingMsg);
        }
        
        // 1. Check for SALES intent first (no OpenAI needed)
        const followUpSalesIntent = detectSalesIntent(speechResult, conversation.businessName);
        
        if (followUpSalesIntent.isSales) {
          console.log(`=== SALES INTENT: ${followUpSalesIntent.subtype} (No OpenAI) ===`);
          response = `${followUpSalesIntent.response} Anything else?`;
        } else {
          // 2. Try FAQs
          const followUpFaqAnswer = checkFAQs(speechResult, conversation.faqs);
          
          if (followUpFaqAnswer) {
            console.log('=== FAQ MATCH (No OpenAI) ===');
            response = `${followUpFaqAnswer} Anything else?`;
          } else if (conversation.questionCount < 3) {
            // 3. Use OpenAI for complex questions (limit to 3)
            console.log('=== USING OPENAI ===');
            const aiResponse = await runLlm(() => getAIResponse(speechResult, conversation));
            response = `${aiResponse} Anything else I can help with?`;
            conversation.questionCount++;
          } else {
            // 4. Max questions reached - neutral handoff
            response = `Got it — I'll have our team follow up shortly. Can I confirm the best number to reach you is ${conversation.collectedInfo.phone || 'the one you called from'}?`;
          }
        }
        
        nextStage = STAGES.FOLLOW_UP;
        break;
      }

      default:
        response = "How can I help you?";
        nextStage = STAGES.GET_REASON;
    }

    // Update stage
    conversation.stage = nextStage;
    conversation.history.push({ role: 'assistant', content: response });

    console.log('Response:', response);
    console.log('Next stage:', nextStage);

    // Generate TwiML and send immediately (don't block on DB)
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 2,  // Shorter trailing silence = faster turn-around (was 3)
      timeout: 10,       // Allow 10s for user to start speaking
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, response);
    twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + callSid);

    const { ms: ttsMs } = await measure('tts', () => sendTwiML(res, twiml));
    timing.tts_ms += ttsMs;
    emitTurnLatency(callSid);

    // Fire-and-forget transcript write so we don't block Twilio response
    runDb(() => call.addTranscriptEntry('assistant', response)).catch(err =>
      console.error('Deferred transcript write error:', err)
    );
    return;

  } catch (error) {
    console.error('Error in gather webhook:', error);
    
    // Safe error recovery
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 2,
      timeout: 10,
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, "I'm sorry, I had trouble with that. Could you please repeat?");
    
    if (req.body?.CallSid) {
      twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + req.body.CallSid);
    } else {
      twiml.say({ voice: VOICE }, 'Sorry, there was a technical issue. Goodbye.');
      twiml.hangup();
    }
    
    const { ms: ttsMs } = await measure('tts', () => sendTwiML(res, twiml));
    timing.tts_ms += ttsMs;
    emitTurnLatency(req.body?.CallSid);
    return;
  }
});

/**
 * Get AI response for complex questions (ONLY place that calls OpenAI).
 * Single LLM call per turn; no classify-then-answer-then-summarize chain.
 * Summary runs only at call end (handleCallComplete).
 */
async function getAIResponse(question, conversation) {
  try {
    // First check for SALES intent (no OpenAI needed)
    const salesIntent = detectSalesIntent(question, conversation.businessName);
    if (salesIntent.isSales) {
      console.log(`=== SALES INTENT in getAIResponse: ${salesIntent.subtype} ===`);
      return salesIntent.response;
    }
    
    const systemPrompt = `You are a helpful receptionist for ${conversation.businessName}.
${conversation.customInstructions ? `Business info: ${conversation.customInstructions}` : ''}
${conversation.services?.length > 0 ? `Services: ${conversation.services.map(s => s.name).join(', ')}` : ''}

RULES:
- Answer in 1-2 sentences MAX
- Be friendly and helpful
- If you don't know something, say "Got it, I'll have our team follow up with that information"
- Never make up information
- For pricing/demo/sign-up questions, offer to have the team follow up with details`;

    const response = await openaiService.processConversation(
      [{ role: 'user', content: question }],
      systemPrompt,
      { maxTokens: 100 }
    );

    return response.response || "Got it — I'll have our team follow up with that information shortly.";
    
  } catch (error) {
    console.error('OpenAI API Error:', error);
    // Graceful fallback - no crash, neutral handoff
    return "Got it — I'll make sure our team follows up with you on that.";
  }
}

/**
 * Handle call completion: Generate summary and send email notification
 * This is called after lead is captured and call is completed
 */
async function handleCallComplete(call, business) {
  const callSid = call.twilioCallSid || 'unknown';
  let lead = null;
  
  try {
    console.log('=== HANDLING CALL COMPLETE ===');
    console.log('Call ID:', call._id);
    console.log('CallSid:', callSid);
    console.log('Business:', business.businessName);

    // Persist transcript for this call (best-effort)
    if (callSid && callSid !== 'unknown') {
      await saveTranscript(callSid);
    }

    // Find the lead associated with this call
    lead = await Lead.findOne({ call: call._id }).sort({ createdAt: -1 });
    
    if (!lead) {
      console.log('⚠️ No lead found for call, skipping summary/email');
      console.log('CallSid:', callSid);
      return;
    }

    const leadId = lead._id.toString();
    console.log('Lead found:', leadId);
    console.log('Lead name:', lead.name);

    // Format transcript as string
    const transcriptText = call.transcript
      ? call.transcript.map(entry => `${entry.role === 'assistant' ? 'AI' : 'Caller'}: ${entry.content}`).join('\n')
      : '';

    // Also update transcript and callSid if not set
    if (!lead.transcript && transcriptText) {
      lead.transcript = transcriptText;
    }
    if (!lead.callSid && call.twilioCallSid) {
      lead.callSid = call.twilioCallSid;
    }
    if (!lead.reasonForCalling && (lead.interestedIn || lead.conversationSummary)) {
      lead.reasonForCalling = lead.interestedIn || lead.conversationSummary || '';
    }

    // 1. Generate AI summary (non-blocking) - ALWAYS attempt
    let summaryText = null;
    let summaryStatus = 'failed';
    let summaryError = null;
    
    try {
      console.log('📝 Generating AI summary...');
      const summary = await summaryService.generateSummary({
        transcript: transcriptText,
        name: lead.name,
        phone: lead.phone,
        reason: lead.reasonForCalling || lead.interestedIn || '',
        leadId: leadId,
        callSid: callSid
      });

      summaryText = summary.text;
      summaryStatus = summary.status;
      summaryError = summary.error;

      // Update lead with summary (even if failed)
      lead.aiSummary = {
        text: summary.text,
        status: summary.status,
        model: summary.model || 'gpt-4o-mini',
        generatedAt: summary.status === 'success' ? new Date() : new Date(),
        error: summary.error
      };

      await lead.save();
      console.log('✅ Lead updated with summary status:', summary.status);
    } catch (summaryErr) {
      console.error('❌ Summary generation exception:', summaryErr);
      summaryError = summaryErr.message || 'Unknown error';
      
      // Still save failed status
      lead.aiSummary = {
        text: null,
        status: 'failed',
        model: 'gpt-4o-mini',
        generatedAt: new Date(),
        error: summaryError
      };
      await lead.save();
    }

    // Use fallback summary text if summary failed
    const emailSummaryText = summaryText || 'AI summary unavailable for this call. Please review the transcript excerpt below.';

    // 2. Send email notification (non-blocking) - ALWAYS attempt if enabled
    // Ensure notificationSettings exists (backward compatibility)
    const notificationSettings = business.getNotificationSettings 
      ? business.getNotificationSettings() 
      : (business.notificationSettings || {
          primaryEmail: business.ownerEmail || null,
          ccEmails: [],
          enableEmail: true,
          enableSMS: false
        });
    const enableEmail = notificationSettings.enableEmail !== false; // Default true

    if (enableEmail) {
      try {
        console.log('📧 Sending email notification...');
        const emailResult = await emailService.sendLeadEmail({
          business: {
            ...business.toObject(),
            notificationSettings: notificationSettings
          },
          lead: lead,
          summary: emailSummaryText // Use summary or fallback
        });

        // Always set notification object with recipients
        lead.notification = {
          status: emailResult.success ? 'sent' : 'failed',
          sentAt: emailResult.success ? new Date() : null,
          error: emailResult.error || null,
          recipients: emailResult.recipients || (emailResult.success 
            ? [notificationSettings.primaryEmail || process.env.FOUNDER_EMAIL || 'alerts@callcrew.ai', ...(notificationSettings.ccEmails || [])]
            : [])
        };

        await lead.save();
        console.log('✅ Lead updated with notification status:', lead.notification.status);
      } catch (emailErr) {
        console.error('❌ Email sending exception:', emailErr);
        
        // Save failed notification status
        lead.notification = {
          status: 'failed',
          sentAt: null,
          error: emailErr.message || 'Unknown error',
          recipients: []
        };
        await lead.save();
      }
    } else {
      console.log('⚠️ Email notifications disabled');
      lead.notification = {
        status: 'failed',
        sentAt: null,
        error: 'Email notifications disabled',
        recipients: []
      };
      await lead.save();
    }

    console.log('✅ LEAD_PROCESSED');
    console.log('LeadId:', leadId, 'CallSid:', callSid);

  } catch (error) {
    console.error('❌ LEAD_PROCESSING_ERROR');
    console.error('LeadId:', lead?._id?.toString() || 'unknown', 'CallSid:', callSid);
    console.error('Error:', error.message);
    console.error('Error stack:', error.stack);
    // DO NOT crash - continue
  }
}

/**
 * End call helper
 */
async function endCall(callSid, twiml, res, message) {
  console.log('=== ENDING CALL ===');
  console.log('Message:', message);
  
  const conversation = conversations.get(callSid);
  
  if (conversation) {
    const call = await Call.findById(conversation.callId);
    const business = await Business.findById(conversation.businessId);
    
    if (call) {
      // Add final message to transcript
      await call.addTranscriptEntry('assistant', message);
      
      // Capture lead if we have info
      let leadCaptured = false;
      if (business && (conversation.collectedInfo.name || conversation.collectedInfo.phone)) {
        try {
          await leadCaptureService.captureFromCall({
            call,
            business,
            transcript: conversation.history,
            collectedInfo: conversation.collectedInfo
          });
          leadCaptured = true;
        } catch (err) {
          console.error('Error capturing lead:', err);
        }
      }

      // Generate basic summary for call record
      if (conversation.history.length > 2) {
        try {
          const summary = await openaiService.generateSummary(conversation.history);
          call.conversationSummary = summary;
        } catch (err) {
          // Fallback summary
          call.conversationSummary = `Call with ${conversation.collectedInfo.name || 'caller'}. Reason: ${conversation.collectedInfo.reason || 'General inquiry'}`;
        }
      }

      await call.completeCall(call.conversationSummary);

      // Process summary and email notification (non-blocking)
      if (leadCaptured && business) {
        // Run in background - don't await to avoid blocking call end
        handleCallComplete(call, business).catch(err => {
          console.error('Background lead processing error:', err);
        });
      }
    }
    
    conversations.delete(callSid);
  }
  
  twiml.say({ voice: VOICE }, message);
  twiml.hangup();
  // Also record final assistant message in CallState transcript
  await addToTranscript(callSid, 'assistant', message);
  return sendTwiML(res, twiml);
}

/**
 * No-input webhook - handles silence from caller
 */
router.post('/no-input', async (req, res) => {
  const twiml = new VoiceResponse();
  const CallSid = req.query.CallSid || req.body.CallSid;

  console.log(`=== NO INPUT === CallSid: ${CallSid}`);

  const conversation = conversations.get(CallSid);
  
  if (!conversation) {
    // Try to recover from CallState
    const state = await CallState.findOne({ callSid: CallSid });
    if (!state) {
      twiml.say({ voice: VOICE }, 'Goodbye.');
      twiml.hangup();
      return sendTwiML(res, twiml);
    }
    // If we have state but no conversation, end call gracefully
    twiml.say({ voice: VOICE }, 'Thank you for calling. Goodbye.');
    twiml.hangup();
    return sendTwiML(res, twiml);
  }

  // Use handleNoInput to get response strategy
  const result = await handleNoInput(CallSid);

  if (result.moveToNextStage) {
    // After 2 timeouts, move to next stage with "unclear"
    console.log(`Moving to next stage after max timeouts for ${CallSid}`);
    
    // Determine next stage based on current stage
    let nextStage = conversation.stage;
    let unclearValue = 'unclear';
    
    switch (conversation.stage) {
      case STAGES.GET_NAME:
        nextStage = STAGES.GET_PHONE;
        conversation.collectedInfo.name = unclearValue;
        break;
      case STAGES.GET_PHONE:
        nextStage = STAGES.GET_REASON;
        conversation.collectedInfo.phone = unclearValue;
        break;
      case STAGES.GET_REASON:
        nextStage = STAGES.FOLLOW_UP;
        conversation.collectedInfo.reason = unclearValue;
        break;
      default:
        // If already past data collection, end call
        return await endCall(CallSid, twiml, res, "I haven't heard from you. Thank you for calling. Goodbye!");
    }
    
    conversation.stage = nextStage;
    await updateCallState(CallSid, {
      stage: nextStage,
      timeoutCount: 0, // Reset timeout count
      collectedData: {
        name: conversation.collectedInfo.name,
        phone: conversation.collectedInfo.phone,
        reason: conversation.collectedInfo.reason
      }
    });
    
    // Ask next question
    let nextQuestion = '';
    switch (nextStage) {
      case STAGES.GET_PHONE:
        nextQuestion = "What's the best phone number to reach you?";
        await updateCallState(CallSid, { currentQuestion: nextQuestion });
        break;
      case STAGES.GET_REASON:
        nextQuestion = "What's the reason for your call today?";
        await updateCallState(CallSid, { currentQuestion: nextQuestion });
        break;
      case STAGES.FOLLOW_UP:
        nextQuestion = "Is there anything else I can help you with?";
        await updateCallState(CallSid, { currentQuestion: nextQuestion });
        break;
    }
    
    const gather = twiml.gather({
      input: 'speech',
      action: '/webhooks/twilio/gather',
      method: 'POST',
      speechTimeout: 2,
      timeout: 10,
      language: 'en-US'
    });
    gather.say({ voice: VOICE }, `${result.response} ${nextQuestion}`);
    twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + CallSid);
    return sendTwiML(res, twiml);
  }

  // Re-ask the same question
  const gather = twiml.gather({
    input: 'speech',
    action: '/webhooks/twilio/gather',
    method: 'POST',
    speechTimeout: 2,  // Shorter trailing silence = faster turn-around (was 3)
    timeout: 10,       // Allow 10s for user to start speaking
    language: 'en-US'
  });
  gather.say({ voice: VOICE }, result.response);
  twiml.redirect({ method: 'POST' }, '/webhooks/twilio/no-input?CallSid=' + CallSid);

  return sendTwiML(res, twiml);
});

/**
 * Call status webhook
 */
router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`=== STATUS === ${CallSid}: ${CallStatus}`);

    const call = await Call.findOne({ twilioCallSid: CallSid });
    
    if (call) {
      const wasAlreadyCompleted = call.status === 'completed';

      // If we've already fully completed this call, skip duplicate processing.
      // This prevents double stats + duplicate emails when both endCall() and
      // the /status webhook run the completion logic.
      if (wasAlreadyCompleted && ['completed', 'failed', 'busy', 'no-answer', 'cancelled'].includes(CallStatus)) {
        console.log(`Call ${CallSid} already completed - skipping duplicate status completion logic`);
        return res.sendStatus(200);
      }

      call.status = CallStatus;
      
      if (['completed', 'failed', 'busy', 'no-answer', 'cancelled'].includes(CallStatus)) {
        call.endTime = new Date();
        if (CallDuration) {
          call.duration = parseInt(CallDuration);
        }

        const conversation = conversations.get(CallSid);
        let leadCaptured = call.leadCaptured;
        let business = null;

        if (conversation) {
          // Capture lead if not already done
          if (!call.leadCaptured && conversation.collectedInfo.name) {
            try {
              business = await Business.findById(conversation.businessId);
              if (business) {
                await leadCaptureService.captureFromCall({
                  call,
                  business,
                  transcript: conversation.history,
                  collectedInfo: conversation.collectedInfo
                });
                leadCaptured = true;
              }
            } catch (err) {
              console.error('Error capturing lead:', err);
            }
          } else if (call.leadCaptured) {
            // Lead already captured, get business
            business = await Business.findById(conversation.businessId);
          }

          // Generate summary if not done
          if (!call.conversationSummary && conversation.history.length > 2) {
            try {
              call.conversationSummary = await openaiService.generateSummary(conversation.history);
            } catch (err) {
              call.conversationSummary = `Call with ${conversation.collectedInfo.name || 'caller'}`;
            }
          }

          conversations.delete(CallSid);
        }

        await call.completeCall(call.conversationSummary);

        // Process summary and email notification (non-blocking)
        if (leadCaptured && business) {
          // Run in background - don't await to avoid blocking status webhook
          handleCallComplete(call, business).catch(err => {
            console.error('Background lead processing error:', err);
          });
        }
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

module.exports = router;
