const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Business = require('../models/Business');
const IndustryTemplate = require('../models/IndustryTemplate');
const NotificationRecipient = require('../models/NotificationRecipient');
const openaiService = require('../services/openaiService');
const numberProvisioningService = require('../services/numberProvisioningService');

/**
 * GET /api/onboarding/templates or /api/onboarding/industries
 * Get all available industry templates
 */
router.get(['/templates', '/industries'], async (req, res) => {
  try {
    const templates = await IndustryTemplate.getActiveTemplates();
    
    res.json({
      success: true,
      templates: templates.map(t => ({
        id: t._id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        suggestedServices: t.suggestedServices,
        suggestedFaqs: t.suggestedFaqs
      }))
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/onboarding/templates/:slug
 * Get a specific industry template
 */
router.get('/templates/:slug', async (req, res) => {
  try {
    const template = await IndustryTemplate.getBySlug(req.params.slug);
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/onboarding/search-numbers
 * Search for available phone numbers
 */
router.post('/search-numbers', async (req, res) => {
  try {
    const { areaCode, country = 'US', limit = 5 } = req.body;
    
    const availableNumbers = await numberProvisioningService.searchAvailableNumbers({
      areaCode,
      country,
      voiceEnabled: true,
      limit
    });
    
    res.json({ success: true, numbers: availableNumbers });
  } catch (error) {
    console.error('Error searching numbers:', error);
    res.status(500).json({ success: false, error: 'Failed to search for available numbers' });
  }
});

/**
 * POST /api/onboarding/create
 * Create a new business with automatic phone provisioning
 */
router.post('/create', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      businessName,
      ownerName,
      ownerEmail,
      ownerPhone,
      industry,
      selectedPhoneNumber, // Optional - will auto-provision if not provided
      customGreeting,
      customInstructions,
      voiceType,
      businessHours,
      timezone,
      services,
      faqs,
      callSettings,
      notificationSettings
    } = req.body;

    // Validate required fields
    if (!businessName || !ownerEmail || !industry) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessName, ownerEmail, industry'
      });
    }

    // Check if business with this email already exists
    const existingBusiness = await Business.findOne({ ownerEmail: ownerEmail.toLowerCase() });
    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        error: 'A business with this email already exists'
      });
    }

    // Validate notificationSettings.primaryEmail if provided
    let notificationSettingsConfig = {
      enableEmail: true,
      enableSMS: notificationSettings?.enableSMS || false,
      ccEmails: notificationSettings?.ccEmails || []
    };

    if (notificationSettings?.primaryEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailToTest = notificationSettings.primaryEmail.trim().toLowerCase();
      
      if (!emailRegex.test(emailToTest)) {
        // Invalid email - disable email notifications but don't fail onboarding
        console.warn('⚠️ Invalid primaryEmail format, disabling email notifications');
        notificationSettingsConfig.enableEmail = false;
        notificationSettingsConfig.primaryEmail = null;
      } else {
        notificationSettingsConfig.primaryEmail = emailToTest;
      }
    } else {
      // If no primaryEmail provided, disable email notifications (summary still generated)
      notificationSettingsConfig.enableEmail = false;
      notificationSettingsConfig.primaryEmail = null;
      console.log('⚠️ No primaryEmail provided, disabling email notifications (summary will still be generated)');
    }

    // Get industry template
    const template = await IndustryTemplate.getBySlug(industry);

    // AUTOMATIC PHONE PROVISIONING
    // If no phone number was selected, search for and provision one (local → toll-free).
    // IMPORTANT: If provisioning fails, we abort onboarding and return a clear error.
    let provisionedNumber = null;
    const baseUrl = process.env.BASE_URL || process.env.WEBHOOK_BASE_URL;

    if (selectedPhoneNumber) {
      try {
        provisionedNumber = await numberProvisioningService.provisionNumber(
          selectedPhoneNumber,
          'onboarding',
          baseUrl || undefined
        );
        if (baseUrl && provisionedNumber?.phoneSid) {
          await numberProvisioningService.updateWebhooks(provisionedNumber.phoneSid, baseUrl);
        }
        console.log('[onboarding] Provisioned selected number:', provisionedNumber?.phoneNumber);
      } catch (err) {
        console.error('[onboarding] Failed to provision selected number:', err);
        throw new Error(`Twilio provisioning failed for selected number: ${err.message || err}`);
      }
    } else {
      try {
        if (!baseUrl || !baseUrl.startsWith('http')) {
          console.warn('[onboarding] BASE_URL or WEBHOOK_BASE_URL not set; provisioning may fail');
        }
        provisionedNumber = await numberProvisioningService.provisionForOnboarding({
          baseUrl: baseUrl || undefined,
          areaCode: req.body.areaCode
        });
        if (provisionedNumber) {
          console.log('[onboarding] Auto-provisioned number:', provisionedNumber.phoneNumber);
        } else {
          console.warn('[onboarding] No Twilio numbers available (local or toll-free)');
          throw new Error('No Twilio phone numbers are currently available for provisioning');
        }
      } catch (err) {
        console.error('[onboarding] Provisioning failed:', err);
        throw new Error(`Twilio auto-provisioning failed: ${err.message || err}`);
      }
    }

    // Create the business
    const business = new Business({
      businessName,
      ownerName: ownerName || businessName,
      ownerEmail: ownerEmail.toLowerCase(),
      ownerPhone: ownerPhone || '',
      industry,
      industryTemplate: template?._id,
      twilioPhoneNumber: provisionedNumber?.phoneNumber || null,  // Use null, not '' for sparse index
      twilioPhoneSid: provisionedNumber?.phoneSid || null,
      customGreeting: customGreeting || '',
      customInstructions: customInstructions || '',
      voiceType: voiceType || template?.recommendedVoice || 'nova',
      businessHours: businessHours || template?.defaultBusinessHours || getDefaultBusinessHours(),
      timezone: timezone || 'America/New_York',
      services: services || template?.suggestedServices || [],
      faqs: faqs || template?.suggestedFaqs || [],
      callSettings: callSettings || {},
      notificationSettings: notificationSettingsConfig,
      onboardingCompleted: true,
      isActive: true
    });

    await business.save({ session });

    // Create notification recipient for owner
    const notificationRecipient = new NotificationRecipient({
      business: business._id,
      name: ownerName || businessName,
      email: ownerEmail.toLowerCase(),
      phone: ownerPhone || '',
      role: 'owner',
      notifications: {
        email: {
          enabled: notificationSettings?.emailNotifications !== false,
          newLead: true,
          missedCall: true,
          dailySummary: false,
          weeklySummary: true
        },
        sms: {
          enabled: notificationSettings?.smsNotifications === true,
          phone: notificationSettings?.smsNumber || ''
        }
      }
    });

    await notificationRecipient.save({ session });

    await session.commitTransaction();

    console.log('Business created successfully:', business._id);

    res.status(201).json({
      success: true,
      business: {
        id: business._id,
        _id: business._id, // Include both for compatibility
        businessName: business.businessName,
        phoneNumber: business.twilioPhoneNumber,
        formattedPhone: business.formattedPhone,
        industry: business.industry,
        onboardingCompleted: business.onboardingCompleted
      },
      businessId: business._id, // Also include at top level
      message: 'Business created successfully! Your AI receptionist is ready.'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating business:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create business: ' + (error.message || 'Unknown error')
    });
  } finally {
    session.endSession();
  }
});

/**
 * PUT /api/onboarding/:id/complete
 * Mark onboarding as complete and update business details
 */
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const business = await Business.findById(id);
    
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    // Update allowed fields
    const allowedFields = [
      'customGreeting', 'customInstructions', 'voiceType',
      'businessHours', 'timezone', 'services', 'faqs', 'callSettings'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        business[field] = updateData[field];
      }
    });

    business.onboardingCompleted = true;
    await business.save();

    res.json({
      success: true,
      business: {
        id: business._id,
        businessName: business.businessName,
        phoneNumber: business.twilioPhoneNumber,
        onboardingCompleted: business.onboardingCompleted
      }
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ success: false, error: 'Failed to complete onboarding' });
  }
});

/**
 * POST /api/onboarding/voice-preview
 * Generate a short audio preview of the assistant's greeting using TTS.
 */
router.post('/voice-preview', async (req, res) => {
  try {
    const { text, voiceType } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for voice preview'
      });
    }

    const { buffer, contentType } = await openaiService.generateSpeech(text, voiceType);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (error) {
    console.error('[onboarding] Voice preview failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate voice preview: ' + (error.message || 'Unknown error')
    });
  }
});

/**
 * GET /api/onboarding/:id/status
 * Check onboarding status for a business
 */
router.get('/:id/status', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).select(
      'businessName twilioPhoneNumber industry onboardingCompleted subscription'
    );
    
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({
      success: true,
      status: {
        businessId: business._id,
        businessName: business.businessName,
        hasPhoneNumber: !!business.twilioPhoneNumber,
        industry: business.industry,
        onboardingCompleted: business.onboardingCompleted,
        subscription: business.subscription
      }
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch onboarding status' });
  }
});

/**
 * Helper function to get default business hours
 */
function getDefaultBusinessHours() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.map(day => ({
    day,
    open: '09:00',
    close: '17:00',
    isClosed: day === 'saturday' || day === 'sunday'
  }));
}

module.exports = router;
