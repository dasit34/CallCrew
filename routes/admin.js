const express = require('express');
const router = express.Router();

const Business = require('../models/Business');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const IndustryTemplate = require('../models/IndustryTemplate');
const NotificationRecipient = require('../models/NotificationRecipient');
const leadCaptureService = require('../services/leadCaptureService');
const notificationService = require('../services/notificationService');
const numberProvisioningService = require('../services/numberProvisioningService');

/**
 * GET /api/admin/businesses
 * Get all businesses (admin only)
 */
router.get('/businesses', async (req, res) => {
  try {
    const { limit = 50, skip = 0, search } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { ownerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const [businesses, total] = await Promise.all([
      Business.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .select('-faqs -services'),
      Business.countDocuments(query)
    ]);

    res.json({
      success: true,
      businesses,
      total,
      page: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch businesses' });
  }
});

/**
 * GET /api/admin/businesses/:id
 * Get a specific business with full details
 */
router.get('/businesses/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate('industryTemplate');
    
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({ success: true, business });
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch business' });
  }
});

/**
 * PUT /api/admin/businesses/:id
 * Update a business
 */
router.put('/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.twilioPhoneNumber;
    delete updateData.twilioPhoneSid;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const business = await Business.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({ success: true, business });
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ success: false, error: 'Failed to update business' });
  }
});

/**
 * DELETE /api/admin/businesses/:id
 * Delete a business (releases phone number)
 */
router.delete('/businesses/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    // Release the phone number
    if (business.twilioPhoneSid) {
      try {
        await numberProvisioningService.releaseNumber(business.twilioPhoneSid);
      } catch (releaseError) {
        console.error('Failed to release phone number:', releaseError);
        // Continue with deletion even if release fails
      }
    }

    // Delete related data
    await Promise.all([
      Call.deleteMany({ business: business._id }),
      Lead.deleteMany({ business: business._id }),
      NotificationRecipient.deleteMany({ business: business._id })
    ]);

    await business.deleteOne();

    res.json({ success: true, message: 'Business deleted successfully' });
  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({ success: false, error: 'Failed to delete business' });
  }
});

/**
 * GET /api/admin/leads
 * Get leads for a business
 */
router.get('/leads', async (req, res) => {
  try {
    const { businessId, status, quality, limit = 50, skip = 0 } = req.query;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    const result = await leadCaptureService.getLeads(businessId, {
      status,
      quality,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leads' });
  }
});

/**
 * GET /api/admin/leads/:id
 * Get a specific lead
 */
router.get('/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('call');
    
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lead' });
  }
});

/**
 * PUT /api/admin/leads/:id
 * Update a lead
 */
router.put('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const lead = await Lead.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ success: false, error: 'Failed to update lead' });
  }
});

/**
 * POST /api/admin/leads/:id/note
 * Add a note to a lead
 */
router.post('/leads/:id/note', async (req, res) => {
  try {
    const { content, createdBy } = req.body;

    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    await lead.addNote(content, createdBy);

    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

/**
 * GET /api/admin/leads/stats/:businessId
 * Get lead statistics
 */
router.get('/leads/stats/:businessId', async (req, res) => {
  try {
    const stats = await leadCaptureService.getLeadStats(req.params.businessId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lead statistics' });
  }
});

/**
 * GET /api/admin/notification-recipients
 * Get notification recipients for a business
 */
router.get('/notification-recipients', async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    const recipients = await NotificationRecipient.find({ business: businessId });

    res.json({ success: true, recipients });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notification recipients' });
  }
});

/**
 * POST /api/admin/notification-recipients
 * Add a notification recipient
 */
router.post('/notification-recipients', async (req, res) => {
  try {
    const recipientData = req.body;

    const recipient = new NotificationRecipient(recipientData);
    await recipient.save();

    res.status(201).json({ success: true, recipient });
  } catch (error) {
    console.error('Error creating recipient:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'This email is already a recipient for this business' });
    }
    res.status(500).json({ success: false, error: 'Failed to create notification recipient' });
  }
});

/**
 * PUT /api/admin/notification-recipients/:id
 * Update a notification recipient
 */
router.put('/notification-recipients/:id', async (req, res) => {
  try {
    const recipient = await NotificationRecipient.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }

    res.json({ success: true, recipient });
  } catch (error) {
    console.error('Error updating recipient:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification recipient' });
  }
});

/**
 * DELETE /api/admin/notification-recipients/:id
 * Delete a notification recipient
 */
router.delete('/notification-recipients/:id', async (req, res) => {
  try {
    const recipient = await NotificationRecipient.findByIdAndDelete(req.params.id);

    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }

    res.json({ success: true, message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipient:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification recipient' });
  }
});

/**
 * POST /api/admin/test-email
 * Test email configuration
 */
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    await notificationService.sendEmail({
      to: email,
      subject: 'CallCrew Test Email',
      text: 'This is a test email from CallCrew. Your email configuration is working correctly!',
      html: '<h1>CallCrew Test Email</h1><p>Your email configuration is working correctly!</p>'
    });

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, error: 'Failed to send test email' });
  }
});

/**
 * GET /api/admin/dashboard/:businessId
 * Get dashboard data for a business
 */
router.get('/dashboard/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;

    const [business, callStats, leadStats, recentCalls, recentLeads] = await Promise.all([
      Business.findById(businessId).select('businessName twilioPhoneNumber stats subscription'),
      Call.aggregate([
        { $match: { business: businessId } },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalDuration: { $sum: '$duration' },
            avgDuration: { $avg: '$duration' }
          }
        }
      ]),
      leadCaptureService.getLeadStats(businessId),
      Call.find({ business: businessId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fromNumber status duration callerIntent createdAt'),
      Lead.find({ business: businessId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name phone quality status createdAt')
    ]);

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({
      success: true,
      dashboard: {
        business: {
          name: business.businessName,
          phone: business.twilioPhoneNumber,
          stats: business.stats,
          subscription: business.subscription
        },
        callStats: callStats[0] || { totalCalls: 0, totalDuration: 0, avgDuration: 0 },
        leadStats,
        recentCalls,
        recentLeads
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
