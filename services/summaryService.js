const { OpenAI } = require('openai');
const { CHAT_MODEL } = require('../openaiModels');

class SummaryService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize OpenAI client
   */
  initialize() {
    if (this.initialized) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.initialized = true;
  }

  /**
   * Generate AI summary from call transcript
   * @param {Object} options - Summary options
   * @param {string} options.transcript - Full conversation transcript
   * @param {string} options.name - Caller's name
   * @param {string} options.phone - Caller's phone number
   * @param {string} options.reason - Reason for calling
   * @returns {Promise<Object>} Summary result with text, status, model, error
   */
  async generateSummary({ transcript, name, phone, reason, leadId, callSid }) {
    console.log('📝 SUMMARY_GENERATING');
    console.log('LeadId:', leadId);
    console.log('CallSid:', callSid);
    console.log('Transcript length:', transcript?.length || 0);
    console.log('Name:', name);
    console.log('Phone:', phone);
    console.log('Reason:', reason);

    try {
      this.initialize();

      // Handle empty/missing transcript - still return structured format
      const transcriptText = transcript && transcript.trim().length > 0 
        ? transcript.trim() 
        : 'Transcript unavailable';

      const prompt = `You are analyzing a phone call transcript for a business owner.

STRICT RULES:
- DO NOT invent details not in the transcript
- If information is unclear or missing, output "unclear"
- No marketing language or fluff
- Be concise and factual only
- Use the exact format below

OUTPUT FORMAT (use exactly these labels):
Caller: [name from given fields or transcript, or "unclear"]
Phone: [phone from given fields or transcript, or "unclear"]
Intent: [specific need/question from transcript, or "unclear"]
Urgency: [low|medium|high|unclear] (based on language in transcript)
Next Step: [recommended action based on transcript, or "unclear"]
Special Notes: [any important details from transcript, or "none"]

Given Information:
- Name: ${name || 'unclear'}
- Phone: ${phone || 'unclear'}
- Reason: ${reason || 'unclear'}

Transcript:
${transcriptText}`;

      const response = await this.client.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a factual assistant that summarizes phone call transcripts. Output ONLY the structured format requested. Do not invent details. Use "unclear" when information is missing.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 250,
        temperature: 0.2
      });

      const summaryText = response.choices[0]?.message?.content?.trim();

      if (!summaryText) {
        console.log('❌ SUMMARY_FAILED: Empty response from OpenAI');
        console.log('LeadId:', leadId, 'CallSid:', callSid);
        return {
          text: null,
          status: 'failed',
          model: CHAT_MODEL,
          error: 'Empty response from OpenAI'
        };
      }

      console.log('✅ SUMMARY_SUCCESS');
      console.log('LeadId:', leadId, 'CallSid:', callSid);
      console.log('Summary preview:', summaryText.substring(0, 100) + '...');
      console.log('Model:', CHAT_MODEL);
      console.log('Tokens used:', response.usage?.total_tokens || 'unknown');

      return {
        text: summaryText,
        status: 'success',
        model: CHAT_MODEL,
        error: null
      };

    } catch (error) {
      console.error('❌ SUMMARY_FAILED');
      console.error('LeadId:', leadId, 'CallSid:', callSid);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);

      return {
        text: null,
        status: 'failed',
        model: CHAT_MODEL,
        error: error.message || 'Unknown error'
      };
    }
  }
}

// Export singleton instance
module.exports = new SummaryService();
