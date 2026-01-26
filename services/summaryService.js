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
  async generateSummary({ transcript, name, phone, reason }) {
    console.log('📝 SUMMARY_GENERATING');
    console.log('Transcript length:', transcript?.length || 0);
    console.log('Name:', name);
    console.log('Phone:', phone);
    console.log('Reason:', reason);

    try {
      this.initialize();

      if (!transcript || transcript.trim().length === 0) {
        console.log('⚠️ Empty transcript, skipping summary');
        return {
          text: null,
          status: 'failed',
          model: null,
          error: 'Empty transcript'
        };
      }

      const prompt = `You are analyzing a phone call transcript for a business owner.

Summarize this call in 3-4 sentences focusing on:
- Caller's name and contact info
- Their specific need or question
- Urgency level (low/medium/high)
- Recommended next action

DO NOT invent details not in the transcript.
If information is unclear, write 'Not mentioned'.

Transcript: ${transcript}`;

      const response = await this.client.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes phone call transcripts for business owners. Be concise and factual.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const summaryText = response.choices[0]?.message?.content?.trim();

      if (!summaryText) {
        console.log('❌ SUMMARY_FAILED: Empty response from OpenAI');
        return {
          text: null,
          status: 'failed',
          model: CHAT_MODEL,
          error: 'Empty response from OpenAI'
        };
      }

      console.log('✅ SUMMARY_SUCCESS');
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
