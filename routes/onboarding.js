const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Business = require('../models/Business');
const IndustryTemplate = require('../models/IndustryTemplate');
const NotificationRecipient = require('../models/NotificationRecipient');
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
      if (!emailRegex.test(notificationSettings.primaryEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format in notificationSettings.primaryEmail'
        });
      }
      notificationSettingsConfig.primaryEmail = notificationSettings.primaryEmail.toLowerCase();
    } else {
      // If no primaryEmail provided, disable email notifications
      notificationSettingsConfig.enableEmail = false;
      console.log('⚠️ No primaryEmail provided, disabling email notifications');
    }

    // Get industry template
    const template = await IndustryTemplate.getBySlug(industry);

    // AUTOMATIC PHONE PROVISIONING
    // If no phone number was selected, search for and provision one automatically
    let provisionedNumber = null;
    let phoneToProvision = selectedPhoneNumber;

    if (!phoneToProvision) {
      console.log('No phone selected, searching for available number...');
      try {
        // Search for available numbers (try local first, then toll-free)
        const availableNumbers = await numberProvisioningService.searchAvailableNumbers({
          country: 'US',
          voiceEnabled: true,
          limit: 1
        });

        if (availableNumbers && availableNumbers.length > 0) {
          phoneToProvision = availableNumbers[0].phoneNumber;
          console.log('Found available number:', phoneToProvision);
        } else {
          console.log('No local numbers available, trying toll-free...');
          // Try toll-free as fallback
          const twilioClient = numberProvisioningService.getClient();
          const tollFreeNumbers = await twilioClient
            .availablePhoneNumbers('US')
            .tollFree.list({ voiceEnabled: true, limit: 1 });
          
          if (tollFreeNumbers && tollFreeNumbers.length > 0) {
            phoneToProvision = tollFreeNumbers[0].phoneNumber;
            console.log('Found toll-free number:', phoneToProvision);
          }
        }
      } catch (searchError) {
        console.error('Failed to search for numbers:', searchError);
      }
    }

    // Provision the phone number if we have one
    if (phoneToProvision) {
      try {
        provisionedNumber = await numberProvisioningService.provisionNumber(
          phoneToProvision,
          'pending'
        );
        console.log('Successfully provisioned number:', provisionedNumber.phoneNumber);
      } catch (provisionError) {
        console.error('Failed to provision number:', provisionError);
        // Continue without phone number - they can add one later
      }
    } else {
      console.warn('No phone number available to provision');
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

    // Update webhooks if phone was provisioned
    if (provisionedNumber?.phoneSid) {
      try {
        await numberProvisioningService.updateWebhooks(provisionedNumber.phoneSid, {
          voiceUrl: `${process.env.BASE_URL}/webhooks/twilio/voice`,
          statusCallback: `${process.env.BASE_URL}/webhooks/twilio/status`
        });
      } catch (updateError) {
        console.error('Failed to update webhook URLs:', updateError);
      }
    }

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
    res.status(500).json({ success: false, error: 'Failed to create business: ' + error.message });
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
