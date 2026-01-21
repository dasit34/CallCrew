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
 * Create a new business and provision phone number
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
      selectedPhoneNumber,
      customGreeting,
      customInstructions,
      voiceType,
      businessHours,
      timezone,
      services,
      faqs
    } = req.body;

    // Validate required fields
    if (!businessName || !ownerName || !ownerEmail || !industry || !selectedPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessName, ownerName, ownerEmail, industry, selectedPhoneNumber'
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

    // Get industry template
    const template = await IndustryTemplate.getBySlug(industry);

    // Provision the phone number
    let provisionedNumber;
    try {
      provisionedNumber = await numberProvisioningService.provisionNumber(
        selectedPhoneNumber,
        'pending' // Will update with actual business ID
      );
    } catch (provisionError) {
      console.error('Failed to provision number:', provisionError);
      return res.status(400).json({
        success: false,
        error: 'Failed to provision phone number. It may no longer be available.'
      });
    }

    // Create the business
    const business = new Business({
      businessName,
      ownerName,
      ownerEmail: ownerEmail.toLowerCase(),
      ownerPhone,
      industry,
      industryTemplate: template?._id,
      twilioPhoneNumber: provisionedNumber.phoneNumber,
      twilioPhoneSid: provisionedNumber.phoneSid,
      customGreeting: customGreeting || '',
      customInstructions: customInstructions || '',
      voiceType: voiceType || template?.recommendedVoice || 'alloy',
      businessHours: businessHours || template?.defaultBusinessHours || getDefaultBusinessHours(),
      timezone: timezone || 'America/New_York',
      services: services || template?.suggestedServices || [],
      faqs: faqs || template?.suggestedFaqs || [],
      onboardingCompleted: true
    });

    await business.save({ session });

    // Update the phone number friendly name with actual business ID
    try {
      await numberProvisioningService.updateWebhooks(provisionedNumber.phoneSid, {
        voiceUrl: `${process.env.BASE_URL}/webhooks/twilio/voice`,
        statusCallback: `${process.env.BASE_URL}/webhooks/twilio/status`
      });
    } catch (updateError) {
      console.error('Failed to update webhook URLs:', updateError);
      // Non-critical, continue
    }

    // Create notification recipient for owner
    const notificationRecipient = new NotificationRecipient({
      business: business._id,
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      phone: ownerPhone,
      role: 'owner',
      notifications: {
        email: {
          enabled: true,
          newLead: true,
          missedCall: true,
          dailySummary: false,
          weeklySummary: true
        }
      }
    });

    await notificationRecipient.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      business: {
        id: business._id,
        businessName: business.businessName,
        phoneNumber: business.twilioPhoneNumber,
        formattedPhone: business.formattedPhone,
        industry: business.industry,
        onboardingCompleted: business.onboardingCompleted
      },
      message: 'Business created successfully! Your AI receptionist is ready.'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating business:', error);
    res.status(500).json({ success: false, error: 'Failed to create business' });
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
