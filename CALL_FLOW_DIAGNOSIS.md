# Call Flow Diagnosis Report

## Executive Summary

After a comprehensive line-by-line analysis of `twilioVoice.js` and related services, **multiple critical issues** have been identified that cause:
1. Questions repeating unexpectedly
2. Phone number/reason collection failures
3. Incomplete data capture
4. Potential double-processing of calls

---

## 🔴 CRITICAL ISSUES

### Issue #1: In-Memory Conversation Store is Volatile (Line 15)

**Location:** `webhooks/twilioVoice.js:15`
```javascript
const conversations = new Map();
```

**Problem:**
- Conversation state is stored in memory
- If the server restarts mid-call, ALL conversation state is lost
- Railway deploys can cause server restarts
- Multi-instance deployments (horizontal scaling) would fail completely

**Symptoms:**
- "No conversation found for CallSid" errors
- Questions repeat from the beginning
- Caller data lost mid-call

**Impact:** HIGH - Complete call failure on server restart

---

### Issue #2: Duplicate Call Completion Processing (Lines 788-795 AND 916-922)

**Location:** `webhooks/twilioVoice.js`

**Two places call `completeCall()` and `handleCallComplete()`:**

1. **In `endCall()` function (lines 788-795):**
```javascript
await call.completeCall(call.conversationSummary);
if (leadCaptured && business) {
  handleCallComplete(call, business).catch(err => {...});
}
```

2. **In `/status` webhook (lines 916-922):**
```javascript
await call.completeCall(call.conversationSummary);
if (leadCaptured && business) {
  handleCallComplete(call, business).catch(err => {...});
}
```

**Problem:**
- Both `endCall()` AND `/status` webhook can fire for the same call
- `completeCall()` increments business stats (`totalCalls`, `totalMinutes`)
- This causes **double-counting of stats**
- `handleCallComplete()` may run twice, sending duplicate emails

**Impact:** HIGH - Incorrect stats, duplicate emails

---

### Issue #3: No Validation of Extracted Phone Number (Lines 99-113)

**Location:** `webhooks/twilioVoice.js:99-113`
```javascript
function extractPhoneNumber(speech) {
  const cleaned = speech.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  if (cleaned.length >= 7) {
    return cleaned;
  }
  
  // Return original if can't parse
  return speech;  // ⚠️ THIS IS THE PROBLEM
}
```

**Problem:**
- If caller says "I don't have a phone" or "my number is unavailable", the function returns the LITERAL TEXT
- No validation that the result is actually a phone number
- Bad data gets saved to the lead

**Symptoms:**
- Lead records with phone numbers like "I don't have one"
- Invalid phone data in database

**Impact:** MEDIUM - Bad data quality

---

### Issue #4: Stage Transition Never Validates Data (Lines 420-445) - ✅ FIXED

**Location:** `webhooks/twilioVoice.js:420-445`

**Original Problem:**
- Stage ALWAYS advances regardless of input quality
- If caller says "um" or "what?" it's treated as a valid name
- If caller says "I'm not sure" it's treated as a phone number
- No re-prompting for unclear responses

**FIX APPLIED:**
Added `isValidInput()` function that validates:
- **Names:** Must be 2+ chars, not filler words (um, uh, hmm, hold on, wait, what, huh)
- **Phones:** Must have 7+ digits, handles "I don't have a phone" gracefully
- **Reasons:** Must be 5+ chars or 2+ words, not single-word fillers (yes, no, ok)

Added `getRepromptMessage()` for context-aware re-prompting:
- Name invalid: "I didn't quite catch your name. Could you tell me your name?"
- Phone invalid: "I didn't get that number. Could you repeat your phone number?"
- No phone: Skips to reason stage gracefully
- Reason invalid: "Could you tell me a bit more about why you're calling today?"

**Impact:** ✅ RESOLVED - Data quality now validated before stage advancement

---

### Issue #5: Goodbye Detection is Too Aggressive (Lines 67-76)

**Location:** `webhooks/twilioVoice.js:67-76`
```javascript
function isGoodbye(text) {
  const goodbyePhrases = [
    'goodbye', 'bye', 'thank you', 'thanks', "that's all", ...
  ];
  const lower = text.toLowerCase();
  return goodbyePhrases.some(phrase => lower.includes(phrase));
}
```

**Problem:**
- `includes()` matches substrings, not whole words
- "Thanks for asking" triggers goodbye
- "I'll thank you for that info" triggers goodbye
- "Goodbye to my old phone number, my new one is..." triggers goodbye

**Called at Line 404:**
```javascript
if (isGoodbye(speechResult)) {
  return await endCall(callSid, twiml, res, `Thank you for calling...`);
}
```

**Symptoms:**
- Calls end prematurely
- Caller says something with "thank" in it and gets disconnected
- Incomplete data collection

**Impact:** MEDIUM - Premature call termination

---

### Issue #6: FAQ Matching is Weak (Lines 124-168)

**Location:** `webhooks/twilioVoice.js:124-168`

```javascript
function checkFAQs(question, faqs) {
  // ...
  for (const faq of faqs) {
    const faqWords = faqLower.split(/\s+/).filter(w => w.length > 3);
    // Count matching significant words
    let matchCount = 0;
    for (const word of faqWords) {
      if (questionWords.some(qw => qw.includes(word) || word.includes(qw))) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {  // ⚠️ Only 2 words needed
      return faq.answer;
    }
  }
}
```

**Problem:**
- Only needs 2 matching words to return an FAQ answer
- "What are your hours?" might match wrong FAQ
- Substring matching causes false positives
- "location" matches "relocation"

**Symptoms:**
- Wrong FAQ answers given
- Caller gets irrelevant information
- Confusion in conversation

**Impact:** LOW-MEDIUM - Wrong answers sometimes

---

### Issue #7: No Recovery from OpenAI Failures (Lines 554-567)

**Location:** `webhooks/twilioVoice.js:554-567`

```javascript
async function getAIResponse(question, conversation) {
  try {
    // ... OpenAI call
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return "That's a great question! Let me have someone call you back with more details.";
  }
}
```

**Problem:**
- If OpenAI fails, caller gets generic response
- No retry logic
- No indication to business owner that AI failed
- Question count still increments even on failure (line 464)

**Symptoms:**
- Generic responses when OpenAI has issues
- No visibility into AI failures
- Question limits hit faster due to failed attempts

**Impact:** MEDIUM - Degraded experience during OpenAI issues

---

### Issue #8: Race Condition in Lead Capture (Lines 885-897)

**Location:** `webhooks/twilioVoice.js:885-897`

```javascript
if (conversation) {
  // Capture lead if not already done
  if (!call.leadCaptured && conversation.collectedInfo.name) {
    // ... capture lead
  } else if (call.leadCaptured) {
    // Lead already captured, get business
    business = await Business.findById(conversation.businessId);
  }
}
```

**Problem:**
- `endCall()` and `/status` webhook can both try to capture leads
- Check for `call.leadCaptured` is not atomic
- Database read-modify-write race condition
- Possible duplicate lead creation

**Symptoms:**
- Duplicate leads for same caller
- Missing leads (if race causes neither to save)

**Impact:** MEDIUM - Data integrity issues

---

### Issue #9: Transcript Not Always Saved to Lead (Lines 611-622)

**Location:** `webhooks/twilioVoice.js:611-622`

```javascript
if (!lead.transcript && transcriptText) {
  lead.transcript = transcriptText;
}
if (!lead.callSid && call.twilioCallSid) {
  lead.callSid = call.twilioCallSid;
}
```

**Problem:**
- Transcript only saved if `!lead.transcript` (not already set)
- `leadCaptureService.createNewLead()` DOES set transcript
- But if lead already exists, `updateExistingLead()` does NOT update transcript
- `handleCallComplete()` only updates if transcript is empty

**Related Code:** `leadCaptureService.js:121-134`
```javascript
async updateExistingLead(existingLead, extractedInfo, call) {
  // ⚠️ NO transcript update here!
  if (extractedInfo.name && extractedInfo.name !== 'Unknown') {
    existingLead.name = extractedInfo.name;
  }
  // ...
}
```

**Symptoms:**
- Repeat callers have outdated transcripts
- New conversation not recorded
- Lost conversation history

**Impact:** MEDIUM - Missing conversation data

---

### Issue #10: Speech Timeout Too Short (Lines 293-300) - ✅ FIXED

**Location:** `webhooks/twilioVoice.js` - All 7 Gather instances

**Original Problem:**
- `timeout: 5` means caller has only 5 seconds to START speaking
- `speechTimeout: 'auto'` can cut off mid-sentence
- If caller pauses to think, they get redirected to no-input handler

**FIX APPLIED:**
Updated ALL 7 Gather configurations from:
```javascript
speechTimeout: 'auto',
timeout: 5,
```
To:
```javascript
speechTimeout: 3,  // Wait 3s after speech stops before processing
timeout: 10,       // Allow 10s for user to start speaking
```

**Locations Updated:**
- Line 58: `generateGatherResponse()` function
- Line 382: Initial greeting gather
- Line 447: Empty speech re-prompt
- Line 462: Low confidence re-prompt
- Line 643: Main response gather
- Line 660: Error recovery gather
- Line 976: No-input handler gather

**Impact:** ✅ RESOLVED - Users now have more time to think and speak naturally

---

### Issue #11: No-Input Handler Asks Wrong Question (Lines 824-857)

**Location:** `webhooks/twilioVoice.js:824-857`

```javascript
router.post('/no-input', async (req, res) => {
  // ...
  switch (conversation.stage) {
    case STAGES.GET_NAME:
      prompt = "Are you still there? May I have your name?";
      break;
    case STAGES.GET_PHONE:
      prompt = "Are you still there? What's the best number to reach you?";
      break;
    // ...
  }
});
```

**Problem:**
- If caller already answered but speech wasn't recognized, they get asked AGAIN
- No context from previous attempt
- Caller thinks: "I just said my name!"

**Symptoms:**
- Questions repeat immediately
- Caller frustration
- Feeling like they're not being heard

**Impact:** MEDIUM - Poor user experience

---

### Issue #12: Voice Mismatch - Business voiceType Ignored (Line 20)

**Location:** `webhooks/twilioVoice.js:20`

```javascript
const VOICE = 'Polly.Joanna';  // ⚠️ HARDCODED
```

**Business Model has:** `voiceType` field (nova, alloy, echo, etc.)

**Problem:**
- Business selects voice during onboarding (line 214 in onboarding.js)
- But `twilioVoice.js` uses hardcoded `Polly.Joanna`
- Business voice preference is completely ignored

**Symptoms:**
- All businesses have same voice
- Customization option doesn't work

**Impact:** LOW - Feature not working

---

### Issue #13: Question Limit Applied Per Call, Not Per Topic (Line 489)

**Location:** `webhooks/twilioVoice.js:489`

```javascript
} else if (conversation.questionCount < 3) {
  // Use OpenAI for complex questions (limit to 3)
  console.log('=== USING OPENAI ===');
  const aiResponse = await getAIResponse(speechResult, conversation);
  response = `${aiResponse} Anything else I can help with?`;
  conversation.questionCount++;
} else {
  // Too many questions - offer callback
  response = `That's a great question! Let me have someone call you back with more details.`;
}
```

**Problem:**
- After 3 OpenAI calls, ALL questions get generic response
- Even simple questions that could be answered
- Counter includes failed OpenAI calls

**Symptoms:**
- "Let me have someone call you back" after 3 questions
- Caller can't get answers to simple questions
- Abrupt decline in helpfulness

**Impact:** MEDIUM - Limited conversation depth

---

## 📊 ISSUE SEVERITY MATRIX

| Issue | Severity | Frequency | Data Impact | UX Impact |
|-------|----------|-----------|-------------|-----------|
| #1 In-memory store | 🔴 HIGH | On restart | Complete loss | Call fails |
| #2 Duplicate processing | 🔴 HIGH | Every call | Double stats | Duplicate emails |
| #3 No phone validation | 🟡 MEDIUM | Sometimes | Bad data | - |
| #4 No stage validation | 🔴 HIGH | Often | Bad data | Confusion |
| #5 Aggressive goodbye | 🟡 MEDIUM | Sometimes | Incomplete | Premature end |
| #6 Weak FAQ matching | 🟡 MEDIUM | Sometimes | - | Wrong answer |
| #7 No OpenAI retry | 🟡 MEDIUM | On API issues | - | Generic response |
| #8 Lead race condition | 🟡 MEDIUM | Sometimes | Duplicates | - |
| #9 Transcript not saved | 🟡 MEDIUM | Repeat callers | Missing data | - |
| #10 Short timeout | 🔴 HIGH | Often | - | Interrupted |
| #11 Wrong re-prompt | 🟡 MEDIUM | Often | - | Frustration |
| #12 Voice mismatch | 🟢 LOW | Always | - | Minor |
| #13 Question limit | 🟡 MEDIUM | After 3 Qs | - | Limited help |

---

## 🔍 ROOT CAUSE ANALYSIS

### Why Questions Repeat

1. **Short speech timeout** (Issue #10) - Caller cut off mid-sentence
2. **No-input handler re-asks** (Issue #11) - Same question after silence
3. **Server restart** (Issue #1) - Conversation lost, starts over
4. **Low confidence threshold** (Line 377) - Valid speech rejected

### Why Phone/Reason Collection Fails

1. **No input validation** (Issue #4) - Any text accepted as valid
2. **No phone number validation** (Issue #3) - Text saved as phone
3. **Goodbye detection** (Issue #5) - Call ends before collection
4. **Short timeout** (Issue #10) - Caller doesn't finish speaking

### Why Conversation Doesn't Capture Everything

1. **Repeat caller transcript** (Issue #9) - Old transcript kept
2. **Race condition** (Issue #8) - Data overwritten
3. **Server restart** (Issue #1) - History lost
4. ~~**Short speechTimeout** (Issue #10)~~ - ✅ FIXED: Now 10s/3s

### Why Stats Are Wrong

1. **Double completeCall()** (Issue #2) - Stats incremented twice
2. **Both endCall() and /status** process same call

---

## 📋 RECOMMENDED FIX PRIORITY

### Phase 1: Critical Fixes (Do First)
1. Fix duplicate processing (Issue #2) - Add flag to prevent double completion
2. ~~Increase speech timeout (Issue #10)~~ - ✅ FIXED: `timeout: 10`, `speechTimeout: 3`
3. Add input validation (Issue #4) - Verify data before advancing stage

### Phase 2: Data Quality
4. Validate phone numbers (Issue #3) - Check for actual digits
5. Fix goodbye detection (Issue #5) - Use word boundaries
6. Save transcript for repeat callers (Issue #9)

### Phase 3: Resilience
7. Add Redis for conversation state (Issue #1)
8. Add lead capture mutex (Issue #8)
9. Add OpenAI retry logic (Issue #7)

### Phase 4: Polish
10. Use business voiceType (Issue #12)
11. Improve FAQ matching (Issue #6)
12. Improve question limit logic (Issue #13)
13. Better no-input prompts (Issue #11)

---

## 📝 VERIFICATION CHECKLIST

To verify fixes work:
- [ ] Make test call, pause for 8 seconds - should NOT get "I didn't catch that"
- [ ] Say "thank you for that information" - should NOT end call
- [ ] Say "my number is I don't have one" - should re-prompt
- [ ] Restart server mid-call - conversation should resume (after Redis fix)
- [ ] Check business stats after call - should increment by 1, not 2
- [ ] Call same number twice - both transcripts should be saved
- [ ] Ask 4 questions - should still try to answer (after limit fix)

---

## 📁 FILES TO MODIFY

1. `webhooks/twilioVoice.js` - Main call handling logic
2. `services/leadCaptureService.js` - Transcript saving for repeat callers
3. `models/Call.js` - Add `completionProcessed` flag
4. New: `services/conversationStore.js` - Redis-based state management

---

**Report Generated:** January 22, 2026
**Analyst:** AI Systems Architect
**Status:** DIAGNOSIS COMPLETE - Ready for fixes
