const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the OpenAI client
   */
  initialize() {
    if (this.initialized) return;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.initialized = true;
  }

  /**
   * Generate a system prompt for the AI receptionist
   * @param {Object} business - The business document
   * @param {Object} template - The industry template
   */
  generateSystemPrompt(business, template) {
    let systemPrompt = template?.systemPrompt || this.getDefaultSystemPrompt();
    
    // Replace placeholders with business info
    systemPrompt = systemPrompt
      .replace(/\{businessName\}/g, business.businessName)
      .replace(/\{ownerName\}/g, business.ownerName);

    // Add custom instructions if provided
    if (business.customInstructions) {
      systemPrompt += `\n\nAdditional Instructions:\n${business.customInstructions}`;
    }

    // Add services information
    if (business.services && business.services.length > 0) {
      const servicesText = business.services
        .map(s => `- ${s.name}: ${s.description}${s.price ? ` (${s.price})` : ''}`)
        .join('\n');
      systemPrompt += `\n\nServices offered:\n${servicesText}`;
    }

    // Add FAQ information
    if (business.faqs && business.faqs.length > 0) {
      const faqText = business.faqs
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n\n');
      systemPrompt += `\n\nFrequently Asked Questions:\n${faqText}`;
    }

    // Add business hours
    if (business.businessHours && business.businessHours.length > 0) {
      const hoursText = business.businessHours
        .filter(h => !h.isClosed)
        .map(h => `${h.day}: ${h.open} - ${h.close}`)
        .join('\n');
      systemPrompt += `\n\nBusiness Hours:\n${hoursText}`;
    }

    return systemPrompt;
  }

  /**
   * Default system prompt for general business
   */
  getDefaultSystemPrompt() {
    return `You are a friendly and professional AI phone receptionist for {businessName}. Your role is to:

1. Greet callers warmly and professionally
2. Answer questions about the business
3. Collect caller information (name, phone number, reason for calling)
4. Schedule callbacks or appointments when needed
5. Handle common inquiries efficiently

Guidelines:
- Keep responses concise and natural for phone conversation (1-2 sentences)
- Be helpful, friendly, and professional
- If you don't know something, offer to have someone call them back
- Always try to capture the caller's name and phone number for follow-up
- Never make up information about services, prices, or availability

Remember: You are the first impression of {businessName}. Make it count!`;
  }

  /**
   * Process a conversation turn
   * @param {Array} conversationHistory - Array of {role, content} messages
   * @param {string} systemPrompt - The system prompt to use
   * @param {Object} options - Additional options
   */
  async processConversation(conversationHistory, systemPrompt, options = {}) {
    this.initialize();

    const {
      model = 'gpt-4o-mini',
      maxTokens = 150,
      temperature = 0.7
    } = options;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ];

      const startTime = Date.now();
      
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const responseTime = Date.now() - startTime;

      const response = completion.choices[0].message.content;
      const usage = completion.usage;

      return {
        response,
        tokensUsed: usage.total_tokens,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        responseTime,
        model
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to process conversation: ${error.message}`);
    }
  }

  /**
   * Extract lead information from conversation
   * @param {Array} conversationHistory - The conversation transcript
   */
  async extractLeadInfo(conversationHistory) {
    this.initialize();

    const extractionPrompt = `Analyze this phone conversation and extract the following information in JSON format:
{
  "name": "caller's full name or null if not provided",
  "firstName": "first name or null",
  "lastName": "last name or null",
  "email": "email address or null",
  "phone": "phone number mentioned or null",
  "interestedIn": "what they're interested in or null",
  "services": ["array of services mentioned"],
  "callbackRequested": true/false,
  "appointmentRequested": true/false,
  "appointmentDetails": "any appointment details or null",
  "questions": ["questions they asked"],
  "specificRequests": "any specific requests",
  "quality": "hot/warm/cold based on interest level",
  "summary": "brief summary of the conversation"
}

Only return valid JSON, nothing else.`;

    const conversationText = conversationHistory
      .map(m => `${m.role === 'assistant' ? 'Receptionist' : 'Caller'}: ${m.content}`)
      .join('\n');

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: extractionPrompt },
          { role: 'user', content: conversationText }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const responseText = completion.choices[0].message.content;
      
      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting lead info:', error);
      return null;
    }
  }

  /**
   * Generate a conversation summary
   * @param {Array} conversationHistory - The conversation transcript
   */
  async generateSummary(conversationHistory) {
    this.initialize();

    const conversationText = conversationHistory
      .map(m => `${m.role === 'assistant' ? 'AI' : 'Caller'}: ${m.content}`)
      .join('\n');

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Summarize this phone conversation in 2-3 sentences, focusing on the caller\'s needs and any actions to be taken.'
          },
          { role: 'user', content: conversationText }
        ],
        max_tokens: 150,
        temperature: 0.3
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Summary unavailable';
    }
  }

  /**
   * Determine caller intent
   * @param {string} message - The caller's message
   */
  async analyzeIntent(message) {
    this.initialize();

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Classify the caller's intent into one of these categories: inquiry, booking, support, complaint, sales, other. Return only the category name.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 20,
        temperature: 0.1
      });

      const intent = completion.choices[0].message.content.toLowerCase().trim();
      const validIntents = ['inquiry', 'booking', 'support', 'complaint', 'sales', 'other'];
      
      return validIntents.includes(intent) ? intent : 'other';
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return 'unknown';
    }
  }

  /**
   * Analyze sentiment of a message
   * @param {string} message - The message to analyze
   */
  async analyzeSentiment(message) {
    this.initialize();

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Classify the sentiment of this message as: positive, neutral, or negative. Return only the sentiment.'
          },
          { role: 'user', content: message }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const sentiment = completion.choices[0].message.content.toLowerCase().trim();
      const validSentiments = ['positive', 'neutral', 'negative'];
      
      return validSentiments.includes(sentiment) ? sentiment : 'neutral';
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 'unknown';
    }
  }

  /**
   * Generate greeting based on context
   * @param {Object} business - The business document
   * @param {boolean} isAfterHours - Whether it's after business hours
   */
  generateGreeting(business, isAfterHours = false) {
    if (business.customGreeting) {
      return business.customGreeting;
    }

    if (isAfterHours) {
      return business.callSettings?.afterHoursMessage || 
        `Thank you for calling ${business.businessName}. We are currently closed. Please leave your name and number, and we'll call you back during business hours.`;
    }

    return `Thank you for calling ${business.businessName}. How may I help you today?`;
  }
}

// Export singleton instance
module.exports = new OpenAIService();
