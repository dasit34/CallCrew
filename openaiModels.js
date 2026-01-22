/**
 * OpenAI Model Configuration
 * Central config for all OpenAI API calls
 */

// Speech-to-Text Model (Whisper)
const STT_MODEL = "whisper-1";

// Chat/Conversation Model
const CHAT_MODEL = "gpt-4o-mini";

// Text-to-Speech Model
const TTS_MODEL = "tts-1";

// Available TTS Voices
const TTS_VOICES = {
  alloy: "alloy",
  echo: "echo",
  fable: "fable",
  onyx: "onyx",
  nova: "nova",
  shimmer: "shimmer"
};

// Default System Prompt
const SYSTEM_PROMPT = `You are CallCrew, a professional AI receptionist assistant.

Your role:
- Answer calls politely and professionally
- Collect caller information: name, phone number, reason for calling
- Answer common questions about the business
- Route urgent requests appropriately
- Keep responses concise and natural
- Always be helpful and friendly

Remember: You're representing the business, so maintain a professional tone while being warm and approachable.`;

module.exports = {
  STT_MODEL,
  CHAT_MODEL,
  TTS_MODEL,
  TTS_VOICES,
  SYSTEM_PROMPT
};
