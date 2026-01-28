const twilio = require('twilio');

class NumberProvisioningService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Get BASE_URL for webhooks (required for provisioning).
   * @returns {string}
   */
  getBaseUrl() {
    const url = process.env.BASE_URL || process.env.WEBHOOK_BASE_URL;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('BASE_URL or WEBHOOK_BASE_URL must be set and start with http(s) for Twilio webhooks');
    }
    return url.replace(/\/$/, '');
  }

  /**
   * Initialize the Twilio client
   * @returns {Object} The Twilio client for direct access
   */
  initialize() {
    if (this.initialized) return this.client;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env');
    }

    this.client = twilio(accountSid, authToken);
    this.initialized = true;
    return this.client;
  }

  /**
   * Get the Twilio client (initializing if needed)
   */
  getClient() {
    this.initialize();
    return this.client;
  }

  /**
   * Search for available phone numbers
   * @param {Object} options - Search options
   * @param {string} options.areaCode - Preferred area code
   * @param {string} options.country - Country code (default: US)
   * @param {boolean} options.voiceEnabled - Must support voice
   * @param {boolean} options.smsEnabled - Must support SMS
   * @param {number} options.limit - Number of results
   */
  async searchAvailableNumbers(options = {}) {
    console.log('=== NUMBER SEARCH START ===');
    console.log('Options received:', JSON.stringify(options));
    
    this.initialize();
    console.log('Twilio client initialized, Account SID:', process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...');

    const {
      areaCode,
      country = 'US',
      voiceEnabled = true,
      smsEnabled = false,
      limit = 10
    } = options;

    try {
      const searchParams = {
        voiceEnabled,
        smsEnabled,
        limit
      };

      if (areaCode) {
        searchParams.areaCode = areaCode;
      }

      console.log('Search params:', JSON.stringify(searchParams));
      console.log('Country:', country);

      const availableNumbers = await this.client
        .availablePhoneNumbers(country)
        .local.list(searchParams);

      console.log('Numbers found:', availableNumbers.length);
      if (availableNumbers.length > 0) {
        console.log('First number:', availableNumbers[0].phoneNumber);
      }
      console.log('=== NUMBER SEARCH END ===');

      return availableNumbers.map(num => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        locality: num.locality,
        region: num.region,
        postalCode: num.postalCode,
        capabilities: {
          voice: num.capabilities.voice,
          sms: num.capabilities.sms,
          mms: num.capabilities.mms
        }
      }));
    } catch (error) {
      console.error('=== NUMBER SEARCH ERROR ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error status:', error.status);
      console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error('=== NUMBER SEARCH ERROR END ===');
      throw new Error(`Failed to search for numbers: ${error.message}`);
    }
  }

  /**
   * Provision (purchase) a phone number
   * @param {string} phoneNumber - The phone number to purchase (E.164)
   * @param {string} friendlyNameSuffix - Suffix for friendly name (e.g. 'onboarding', businessId)
   * @param {string} [baseUrl] - Base URL for webhooks (default: getBaseUrl())
   * @returns {Promise<{phoneNumber: string, phoneSid: string, ...}>}
   */
  async provisionNumber(phoneNumber, friendlyNameSuffix, baseUrl) {
    this.initialize();
    const base = baseUrl || this.getBaseUrl();

    try {
      const voiceUrl = `${base}/webhooks/twilio/voice`;
      const statusCallback = `${base}/webhooks/twilio/status`;
      console.log('[provision] Purchasing', phoneNumber, '| voiceUrl:', voiceUrl);

      const incomingPhoneNumber = await this.client.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl,
        voiceMethod: 'POST',
        statusCallback,
        statusCallbackMethod: 'POST',
        friendlyName: `CallCrew - ${friendlyNameSuffix}`
      });

      console.log('[provision] Purchased', incomingPhoneNumber.phoneNumber, 'SID:', incomingPhoneNumber.sid);
      return {
        phoneNumber: incomingPhoneNumber.phoneNumber,
        phoneSid: incomingPhoneNumber.sid,
        friendlyName: incomingPhoneNumber.friendlyName,
        voiceUrl: incomingPhoneNumber.voiceUrl,
        dateCreated: incomingPhoneNumber.dateCreated
      };
    } catch (err) {
      console.error('[provision] Failed to purchase', phoneNumber, err?.message || err);
      throw new Error(`Failed to provision number: ${err?.message || err}`);
    }
  }

  /**
   * Update webhook URLs for a phone number
   * @param {string} phoneSid - The Twilio Phone SID
   * @param {Object|string} webhooksOrBaseUrl - { voiceUrl, statusCallback } or baseUrl string
   */
  async updateWebhooks(phoneSid, webhooksOrBaseUrl = {}) {
    this.initialize();

    let voiceUrl;
    let statusCallback;
    if (typeof webhooksOrBaseUrl === 'string') {
      const base = webhooksOrBaseUrl.replace(/\/$/, '');
      voiceUrl = `${base}/webhooks/twilio/voice`;
      statusCallback = `${base}/webhooks/twilio/status`;
    } else {
      voiceUrl = webhooksOrBaseUrl.voiceUrl;
      statusCallback = webhooksOrBaseUrl.statusCallback;
    }
    if (!voiceUrl) voiceUrl = `${this.getBaseUrl()}/webhooks/twilio/voice`;
    if (!statusCallback) statusCallback = `${this.getBaseUrl()}/webhooks/twilio/status`;

    try {
      const updateParams = {
        voiceUrl,
        voiceMethod: 'POST',
        statusCallback,
        statusCallbackMethod: 'POST'
      };
      if (webhooksOrBaseUrl && typeof webhooksOrBaseUrl === 'object' && webhooksOrBaseUrl.smsUrl) {
        updateParams.smsUrl = webhooksOrBaseUrl.smsUrl;
        updateParams.smsMethod = 'POST';
      }

      const updated = await this.client
        .incomingPhoneNumbers(phoneSid)
        .update(updateParams);

      console.log('[updateWebhooks] Updated', phoneSid, 'voiceUrl:', updated.voiceUrl);
      return {
        phoneNumber: updated.phoneNumber,
        phoneSid: updated.sid,
        voiceUrl: updated.voiceUrl,
        statusCallback: updated.statusCallback
      };
    } catch (err) {
      console.error('[updateWebhooks] Failed for', phoneSid, err?.message || err);
      throw new Error(`Failed to update webhooks: ${err?.message || err}`);
    }
  }

  /**
   * Search, purchase, and configure a Twilio number for onboarding.
   * Tries US local numbers first, then US toll-free. Sets voice + status webhooks.
   * @param {Object} [options] - { baseUrl?: string, areaCode?: string }
   * @returns {Promise<{phoneNumber: string, phoneSid: string}|null>}
   */
  async provisionForOnboarding(options = {}) {
    let baseUrl = options.baseUrl;
    if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.startsWith('http')) {
      try {
        baseUrl = this.getBaseUrl();
      } catch (e) {
        console.error('[provisionForOnboarding] BASE_URL/WEBHOOK_BASE_URL not set; cannot provision');
        return null;
      }
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    this.initialize();

    let candidates = [];

    try {
      const local = await this.searchAvailableNumbers({
        country: 'US',
        voiceEnabled: true,
        limit: 10,
        areaCode: options.areaCode
      });
      if (local && local.length > 0) {
        candidates = local;
        console.log('[provisionForOnboarding] Local numbers found:', local.length);
      }
    } catch (err) {
      console.warn('[provisionForOnboarding] Local search failed:', err?.message || err);
    }

    if (candidates.length === 0) {
      try {
        const tollFree = await this.client
          .availablePhoneNumbers('US')
          .tollFree.list({ voiceEnabled: true, limit: 10 });
        if (tollFree && tollFree.length > 0) {
          candidates = tollFree.map((n) => ({ phoneNumber: n.phoneNumber }));
          console.log('[provisionForOnboarding] Toll-free numbers found:', tollFree.length);
        }
      } catch (err) {
        console.warn('[provisionForOnboarding] Toll-free search failed:', err?.message || err);
      }
    }

    if (candidates.length === 0) {
      console.error('[provisionForOnboarding] No numbers available (local or toll-free)');
      return null;
    }

    const phoneToBuy = candidates[0].phoneNumber;
    const provisioned = await this.provisionNumber(phoneToBuy, 'onboarding', baseUrl);
    await this.updateWebhooks(provisioned.phoneSid, baseUrl);
    return { phoneNumber: provisioned.phoneNumber, phoneSid: provisioned.phoneSid };
  }

  /**
   * Release (delete) a phone number
   * @param {string} phoneSid - The Twilio Phone SID to release
   */
  async releaseNumber(phoneSid) {
    this.initialize();

    try {
      await this.client.incomingPhoneNumbers(phoneSid).remove();
      return { success: true, message: 'Number released successfully' };
    } catch (error) {
      console.error('Error releasing number:', error);
      throw new Error(`Failed to release number: ${error.message}`);
    }
  }

  /**
   * Get details of a provisioned number
   * @param {string} phoneSid - The Twilio Phone SID
   */
  async getNumberDetails(phoneSid) {
    this.initialize();

    try {
      const number = await this.client.incomingPhoneNumbers(phoneSid).fetch();
      
      return {
        phoneNumber: number.phoneNumber,
        phoneSid: number.sid,
        friendlyName: number.friendlyName,
        voiceUrl: number.voiceUrl,
        smsUrl: number.smsUrl,
        statusCallback: number.statusCallback,
        capabilities: number.capabilities,
        dateCreated: number.dateCreated
      };
    } catch (error) {
      console.error('Error fetching number details:', error);
      throw new Error(`Failed to get number details: ${error.message}`);
    }
  }

  /**
   * List all provisioned numbers
   */
  async listProvisionedNumbers() {
    this.initialize();

    try {
      const numbers = await this.client.incomingPhoneNumbers.list();
      
      return numbers.map(num => ({
        phoneNumber: num.phoneNumber,
        phoneSid: num.sid,
        friendlyName: num.friendlyName,
        voiceUrl: num.voiceUrl,
        dateCreated: num.dateCreated
      }));
    } catch (error) {
      console.error('Error listing numbers:', error);
      throw new Error(`Failed to list numbers: ${error.message}`);
    }
  }

  /**
   * Validate a Twilio request signature
   * @param {string} signature - The X-Twilio-Signature header
   * @param {string} url - The full URL of the request
   * @param {Object} params - The request parameters
   */
  validateRequest(signature, url, params) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    return twilio.validateRequest(authToken, signature, url, params);
  }
}

// Export singleton instance
module.exports = new NumberProvisioningService();
