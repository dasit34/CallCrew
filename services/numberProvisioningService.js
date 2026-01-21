const twilio = require('twilio');

class NumberProvisioningService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the Twilio client
   */
  initialize() {
    if (this.initialized) return;
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(accountSid, authToken);
    this.initialized = true;
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
    this.initialize();

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

      const availableNumbers = await this.client
        .availablePhoneNumbers(country)
        .local.list(searchParams);

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
      console.error('Error searching for available numbers:', error);
      throw new Error(`Failed to search for numbers: ${error.message}`);
    }
  }

  /**
   * Provision (purchase) a phone number
   * @param {string} phoneNumber - The phone number to purchase
   * @param {string} businessId - The business ID to associate with this number
   */
  async provisionNumber(phoneNumber, businessId) {
    this.initialize();

    try {
      const baseUrl = process.env.BASE_URL || process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
      
      const incomingPhoneNumber = await this.client.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
        voiceUrl: `${baseUrl}/webhooks/twilio/voice`,
        voiceMethod: 'POST',
        statusCallback: `${baseUrl}/webhooks/twilio/status`,
        statusCallbackMethod: 'POST',
        friendlyName: `CallCrew - ${businessId}`
      });

      return {
        phoneNumber: incomingPhoneNumber.phoneNumber,
        phoneSid: incomingPhoneNumber.sid,
        friendlyName: incomingPhoneNumber.friendlyName,
        voiceUrl: incomingPhoneNumber.voiceUrl,
        dateCreated: incomingPhoneNumber.dateCreated
      };
    } catch (error) {
      console.error('Error provisioning number:', error);
      throw new Error(`Failed to provision number: ${error.message}`);
    }
  }

  /**
   * Update webhook URLs for a phone number
   * @param {string} phoneSid - The Twilio Phone SID
   * @param {Object} webhooks - Webhook URLs to update
   */
  async updateWebhooks(phoneSid, webhooks = {}) {
    this.initialize();

    try {
      const updateParams = {};
      
      if (webhooks.voiceUrl) {
        updateParams.voiceUrl = webhooks.voiceUrl;
        updateParams.voiceMethod = 'POST';
      }
      
      if (webhooks.statusCallback) {
        updateParams.statusCallback = webhooks.statusCallback;
        updateParams.statusCallbackMethod = 'POST';
      }
      
      if (webhooks.smsUrl) {
        updateParams.smsUrl = webhooks.smsUrl;
        updateParams.smsMethod = 'POST';
      }

      const updated = await this.client
        .incomingPhoneNumbers(phoneSid)
        .update(updateParams);

      return {
        phoneNumber: updated.phoneNumber,
        phoneSid: updated.sid,
        voiceUrl: updated.voiceUrl,
        statusCallback: updated.statusCallback
      };
    } catch (error) {
      console.error('Error updating webhooks:', error);
      throw new Error(`Failed to update webhooks: ${error.message}`);
    }
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
