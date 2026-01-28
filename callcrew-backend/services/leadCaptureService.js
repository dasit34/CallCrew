const Lead = require('../models/Lead');
const openaiService = require('./openaiService');
const notificationService = require('./notificationService');

class LeadCaptureService {
  /**
   * Capture a lead from a phone call
   * @param {Object} options - Lead capture options
   * @param {Object} options.call - The call document
   * @param {Object} options.business - The business document
   * @param {Array} options.transcript - The conversation transcript
   * @param {Object} options.collectedInfo - Pre-collected info (name, phone, reason) from scripted flow
   */
  async captureFromCall(options) {
    const { call, business, transcript, collectedInfo } = options;

    try {
      let extractedInfo = {};
      
      // Use pre-collected info if available (avoids OpenAI call)
      if (collectedInfo && (collectedInfo.name || collectedInfo.phone || collectedInfo.reason)) {
        console.log('Using pre-collected info (no OpenAI needed)');
        extractedInfo = {
          name: collectedInfo.name || 'Unknown',
          phone: collectedInfo.phone,
          summary: collectedInfo.reason || 'General inquiry',
          interestedIn: collectedInfo.reason,
          quality: collectedInfo.phone ? 'warm' : 'cold'
        };
      } else if (transcript && transcript.length > 0) {
        // Fall back to AI extraction only if no collected info
        console.log('Extracting lead info with OpenAI...');
        extractedInfo = await openaiService.extractLeadInfo(transcript) || {};
      }
      
      if (!extractedInfo.name && !call.fromNumber) {
        console.log('Could not extract lead info from conversation');
        return null;
      }

      // Check if lead already exists with this phone number
      const phoneToCheck = extractedInfo.phone || call.fromNumber;
      const existingLead = await Lead.findOne({
        business: business._id,
        phone: { $regex: phoneToCheck.replace(/\D/g, '').slice(-10) }
      });

      if (existingLead) {
        // Update existing lead with new conversation info
        return await this.updateExistingLead(existingLead, extractedInfo, call);
      }

      // Format transcript as string
      const transcriptText = Array.isArray(transcript)
        ? transcript.map(entry => `${entry.role === 'assistant' ? 'AI' : 'Caller'}: ${entry.content}`).join('\n')
        : (typeof transcript === 'string' ? transcript : '');

      // Create new lead
      const lead = await this.createNewLead({
        business,
        call,
        extractedInfo,
        phone: extractedInfo.phone || call.fromNumber,
        transcript: transcriptText,
        reasonForCalling: collectedInfo?.reason || extractedInfo.interestedIn || ''
      });

      // Note: Email notifications are now handled in handleCallComplete()
      // to ensure summary is generated first

      return lead;
    } catch (error) {
      console.error('Error capturing lead:', error);
      throw error;
    }
  }

  /**
   * Create a new lead (atomic per callSid to avoid duplicates)
   * @param {Object} options - Lead creation options
   */
  async createNewLead(options) {
    const { business, call, extractedInfo, phone, transcript, reasonForCalling } = options;

    const leadData = {
      business: business._id,
      call: call?._id,
      phone: phone,
      name: extractedInfo.name || 'Unknown',
      firstName: extractedInfo.firstName,
      lastName: extractedInfo.lastName,
      email: extractedInfo.email,
      source: 'phone_call',
      status: 'new',
      quality: extractedInfo.quality || 'unknown',
      interestedIn: extractedInfo.interestedIn,
      reasonForCalling: reasonForCalling || extractedInfo.interestedIn || '',
      services: extractedInfo.services || [],
      conversationSummary: extractedInfo.summary,
      transcript: transcript || '',
      callSid: call?.twilioCallSid || null,
      specificRequests: extractedInfo.specificRequests,
      questions: extractedInfo.questions || [],
      callbackRequested: extractedInfo.callbackRequested || false,
      appointmentRequested: extractedInfo.appointmentRequested || false,
      appointmentDetails: extractedInfo.appointmentDetails,
      metadata: call?.metadata || {}
    };

    const lead = await Lead.findOneAndUpdate(
      { callSid: leadData.callSid },
      {
        $setOnInsert: leadData
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log(`✓ Lead captured/updated: ${lead._id}`);

    // Link lead to call
    if (call) {
      call.leadCaptured = true;
      call.lead = lead._id;
      call.outcome = 'lead_captured';
      await call.save();
    }

    return lead;
  }

  /**
   * Update an existing lead with new information
   * @param {Object} existingLead - The existing lead document
   * @param {Object} extractedInfo - Newly extracted information
   * @param {Object} call - The call document
   */
  async updateExistingLead(existingLead, extractedInfo, call) {
    // Update fields if new info is available
    if (extractedInfo.name && extractedInfo.name !== 'Unknown') {
      existingLead.name = extractedInfo.name;
    }
    if (extractedInfo.firstName) {
      existingLead.firstName = extractedInfo.firstName;
    }
    if (extractedInfo.lastName) {
      existingLead.lastName = extractedInfo.lastName;
    }
    if (extractedInfo.email) {
      existingLead.email = extractedInfo.email;
    }
    if (extractedInfo.interestedIn) {
      existingLead.interestedIn = extractedInfo.interestedIn;
    }
    if (extractedInfo.services && extractedInfo.services.length > 0) {
      // Merge services
      const existingServices = new Set(existingLead.services);
      extractedInfo.services.forEach(s => existingServices.add(s));
      existingLead.services = Array.from(existingServices);
    }
    if (extractedInfo.questions && extractedInfo.questions.length > 0) {
      existingLead.questions = [...existingLead.questions, ...extractedInfo.questions];
    }
    if (extractedInfo.callbackRequested) {
      existingLead.callbackRequested = true;
    }
    if (extractedInfo.appointmentRequested) {
      existingLead.appointmentRequested = true;
      existingLead.appointmentDetails = extractedInfo.appointmentDetails;
    }

    // Add note about the new conversation
    existingLead.notes.push({
      content: `Follow-up call: ${extractedInfo.summary || 'No summary available'}`,
      createdBy: 'AI Receptionist'
    });

    // Update quality if it's higher
    const qualityRank = { cold: 1, unknown: 2, warm: 3, hot: 4 };
    if (qualityRank[extractedInfo.quality] > qualityRank[existingLead.quality]) {
      existingLead.quality = extractedInfo.quality;
    }

    // Link this call
    if (call) {
      call.leadCaptured = true;
      call.lead = existingLead._id;
      await call.save();
    }

    await existingLead.save();
    return existingLead;
  }

  /**
   * Create a lead manually
   * @param {Object} leadData - Lead data
   */
  async createManualLead(leadData) {
    const lead = new Lead({
      ...leadData,
      source: 'manual',
      status: 'new'
    });

    await lead.save();
    return lead;
  }

  /**
   * Get leads for a business with filtering
   * @param {string} businessId - The business ID
   * @param {Object} filters - Filter options
   */
  async getLeads(businessId, filters = {}) {
    const {
      status,
      quality,
      source,
      startDate,
      endDate,
      search,
      limit = 50,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = -1
    } = filters;

    const query = { business: businessId };

    if (status) query.status = status;
    if (quality) query.quality = quality;
    if (source) query.source = source;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('call'),
      Lead.countDocuments(query)
    ]);

    return {
      leads,
      total,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get lead statistics for a business
   * @param {string} businessId - The business ID
   */
  async getLeadStats(businessId) {
    const [
      totalLeads,
      newLeads,
      qualifiedLeads,
      convertedLeads,
      leadsByQuality,
      leadsBySource,
      recentLeads
    ] = await Promise.all([
      Lead.countDocuments({ business: businessId }),
      Lead.countDocuments({ business: businessId, status: 'new' }),
      Lead.countDocuments({ business: businessId, status: 'qualified' }),
      Lead.countDocuments({ business: businessId, status: 'converted' }),
      Lead.aggregate([
        { $match: { business: businessId } },
        { $group: { _id: '$quality', count: { $sum: 1 } } }
      ]),
      Lead.aggregate([
        { $match: { business: businessId } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      Lead.find({ business: businessId })
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    return {
      totalLeads,
      newLeads,
      qualifiedLeads,
      convertedLeads,
      conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0,
      leadsByQuality: leadsByQuality.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {}),
      leadsBySource: leadsBySource.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {}),
      recentLeads
    };
  }
}

// Export singleton instance
module.exports = new LeadCaptureService();
