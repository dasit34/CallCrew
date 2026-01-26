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
const summaryService = require('../services/summaryService');
const emailService = require('../services/emailService');

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

/**
 * POST /api/admin/setup-demo
 * Setup or update the demo assistant
 */
router.post('/setup-demo', async (req, res) => {
  try {
    const DEMO_PHONE = '+18446876128';
    
    const demoConfig = {
      businessName: 'CallCrew Demo',
      ownerName: 'CallCrew Team',
      ownerEmail: 'demo@callcrew.ai',
      industry: 'general',
      isActive: true,
      onboardingCompleted: true,
      voiceType: 'nova',
      
      customGreeting: `Hey there! Thanks for calling CallCrew. I'm your AI receptionist demo, and I'm here to show you exactly what I can do for your business. Before we dive in, can I get your first name?`,
      
      customInstructions: `You are the CallCrew Demo Assistant. Your job is to give callers an engaging, conversational demo of what CallCrew can do for their business.

PERSONALITY:
- Warm, friendly, and professional
- Confident but not pushy
- Speak naturally like a real person, not robotic
- Keep responses conversational (2-3 sentences max)
- Use the caller's name when you have it

DEMO FLOW:
1. After they give their name, acknowledge it warmly and ask what type of business they run
2. Once you know their business type, relate CallCrew features to their specific needs
3. Naturally demonstrate your abilities throughout the conversation
4. Collect their info for follow-up (email if they want more info)
5. Offer to have someone reach out to set up their own assistant

KEY DEMO POINTS TO WEAVE IN:
- "As you can hear, I sound natural and can understand what you're saying without those annoying phone menus"
- "I'm available 24/7, or just when you want - you control when calls come to me"
- "After every call, I send a summary straight to your phone by text or email"
- "I can capture lead info, take messages, even transfer urgent calls to you"
- "I'm trained to handle [their industry] calls specifically"

WHEN ASKED ABOUT PRICING:
Say: "Great question! Pricing depends on your call volume and needs. The best way to get details is to hop on a quick setup call with our team. Would you like me to have someone reach out to walk you through options?"

WHEN ASKED HOW TO SIGN UP:
Say: "I'd love to get you set up! The easiest way is to have one of our team members give you a quick call to configure your assistant. Can I get your email so they can reach out?"

WHEN ASKED TECHNICAL QUESTIONS YOU DON'T KNOW:
Say: "That's a great question - I want to make sure you get the right answer. Our team can cover all the technical details. Want me to have them reach out?"

CLOSING:
After collecting their info, say something like: "Perfect, [Name]! You'll hear from our team soon. In the meantime, you've just experienced what your customers would get when they call you. Pretty cool, right? Thanks for checking out CallCrew!"

If they don't want follow-up: "No problem at all! If you change your mind, you can always visit callcrew.ai or call back here anytime. Thanks for trying the demo!"

REMEMBER:
- This IS the product demo - show don't tell
- Be genuinely helpful, not salesy
- Keep it conversational and natural
- You're demonstrating CallCrew by being CallCrew`,

      faqs: [
        { question: "How much does CallCrew cost?", answer: "Pricing varies based on your needs and call volume. I can have our team reach out with specific pricing for your situation. Would you like that?" },
        { question: "How do I sign up?", answer: "The best way is a quick setup call where we configure your assistant for your specific business. Can I get your email to have someone reach out?" },
        { question: "How long does setup take?", answer: "Most businesses are live in under 10 minutes. We help you set up your greeting, questions, and notification preferences, then you just forward your calls." },
        { question: "Do I keep my business number?", answer: "Absolutely! You keep your existing number. When you want CallCrew to answer, you just turn on call forwarding. Turn it off anytime to answer calls yourself." },
        { question: "Can you transfer calls to me?", answer: "Yes! You can set rules for urgent calls or VIP customers to be transferred directly to your cell phone." },
        { question: "What if you don't know the answer?", answer: "I'll let the caller know someone will get back to them, capture their info, and send you a summary so you can follow up with the right answer." },
        { question: "Is this available 24/7?", answer: "Yes, I can answer around the clock. But you control when - you can set me up for just lunch hours, after hours, weekends, or 24/7. Whatever works for your business." },
        { question: "How do I get the call summaries?", answer: "After each call, you get a text message or email - your choice - within seconds. It includes who called, what they wanted, and any info they shared." }
      ],

      services: [
        { name: "24/7 Call Answering", description: "AI receptionist answers calls anytime, or only during hours you set" },
        { name: "Lead Capture", description: "Collects caller name, number, and reason for calling" },
        { name: "Caller Qualification", description: "Asks your screening questions to prioritize callbacks" },
        { name: "Appointment Requests", description: "Takes down service needs and preferred times" },
        { name: "Call Routing", description: "Transfers urgent calls directly to your cell" },
        { name: "Instant Summaries", description: "Text or email summary after every call" }
      ],

      callSettings: {
        maxCallDuration: 600,
        enableTransfer: false,
        afterHoursMessage: "Thanks for calling CallCrew! I'm available 24/7 to demo our AI receptionist. How can I help you today?"
      }
    };

    // Find or create demo business
    let demoBusiness = await Business.findOne({ twilioPhoneNumber: DEMO_PHONE });

    if (demoBusiness) {
      // Update existing
      Object.keys(demoConfig).forEach(key => {
        demoBusiness[key] = demoConfig[key];
      });
      await demoBusiness.save();
      console.log('Demo assistant updated');
    } else {
      // Create new
      demoBusiness = new Business({
        ...demoConfig,
        twilioPhoneNumber: DEMO_PHONE
      });
      await demoBusiness.save();
      console.log('Demo assistant created');
    }

    res.json({
      success: true,
      message: 'Demo assistant configured successfully',
      business: {
        id: demoBusiness._id,
        name: demoBusiness.businessName,
        phone: demoBusiness.twilioPhoneNumber,
        voice: demoBusiness.voiceType,
        active: demoBusiness.isActive
      }
    });
  } catch (error) {
    console.error('Error setting up demo:', error);
    res.status(500).json({ success: false, error: 'Failed to setup demo assistant' });
  }
});

/**
 * Middleware to check ADMIN_KEY
 */
function requireAdminKey(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  const providedKey = req.query.key || req.headers['x-admin-key'];
  
  if (!adminKey) {
    // If no ADMIN_KEY set, allow in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    return res.status(500).json({ 
      success: false, 
      error: 'ADMIN_KEY not configured' 
    });
  }
  
  if (providedKey !== adminKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid admin key' 
    });
  }
  
  next();
}

/**
 * GET /api/admin/test-email?email=test@example.com&key=ADMIN_KEY
 * Test email configuration with sample lead data
 */
router.get('/test-email', requireAdminKey, async (req, res) => {
  try {
    const testEmail = req.query.email || process.env.EMAIL_USER;
    
    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'No email address provided. Use ?email=test@example.com' 
      });
    }

    // Get first business for testing
    const business = await Business.findOne();
    if (!business) {
      return res.status(404).json({ 
        success: false, 
        error: 'No business found. Create a business first.' 
      });
    }

    // Create sample lead
    const sampleLead = {
      name: 'Test Caller',
      phone: '+15551234567',
      email: 'test@example.com',
      reasonForCalling: 'Testing email notifications',
      quality: 'warm',
      transcript: 'AI: Thank you for calling!\nCaller: Hi, I want to test the email system.\nAI: Great! I\'ll send you a test email.',
      callSid: 'TEST123',
      createdAt: new Date()
    };

    console.log('=== EMAIL TEST ===');
    console.log('Sending to:', testEmail);
    console.log('Business:', business.businessName);

    const result = await emailService.sendLeadEmail({
      business: {
        ...business.toObject(),
        notificationSettings: {
          primaryEmail: testEmail,
          enableEmail: true,
          ccEmails: []
        }
      },
      lead: sampleLead,
      summary: 'Test caller called to verify email notifications are working. System is functioning correctly.'
    });

    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test email sent to ${testEmail}`,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error,
        hint: result.error?.includes('EAUTH') ? 'Use Gmail App Password, not regular password.' : null
      });
    }
  } catch (error) {
    console.error('=== EMAIL TEST FAILED ===');
    console.error('Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

/**
 * GET /api/admin/test-summary?key=ADMIN_KEY
 * Test AI summary generation with sample transcript
 */
router.get('/test-summary', requireAdminKey, async (req, res) => {
  try {
    const sampleTranscript = `AI: Thank you for calling Acme Plumbing! How can I help you today?
Caller: Hi, I have a leaky faucet in my kitchen.
AI: I'd be happy to help! May I have your name?
Caller: My name is John Smith.
AI: Thanks John! What's the best phone number to reach you?
Caller: 555-123-4567
AI: Perfect. What's the reason for your call today?
Caller: I need someone to fix my kitchen faucet. It's been dripping for days.
AI: I understand. We can definitely help with that. Is this urgent or can it wait a few days?
Caller: It's not an emergency, but I'd like it fixed this week if possible.
AI: Great! I'll have one of our plumbers call you back today to schedule an appointment. Is there anything else?
Caller: No, that's all. Thank you!
AI: You're welcome! Have a great day!`;

    console.log('=== SUMMARY TEST ===');
    console.log('Transcript length:', sampleTranscript.length);

    const result = await summaryService.generateSummary({
      transcript: sampleTranscript,
      name: 'John Smith',
      phone: '+15551234567',
      reason: 'Kitchen faucet leak'
    });

    res.json({
      success: result.status === 'success',
      summary: result,
      sampleTranscript: sampleTranscript.substring(0, 200) + '...'
    });

  } catch (error) {
    console.error('=== SUMMARY TEST FAILED ===');
    console.error('Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

/**
 * GET /api/admin/system-status
 * Check system configuration status
 */
router.get('/system-status', async (req, res) => {
  const status = {
    mongodb: false,
    twilio: false,
    openai: false,
    email: false
  };

  // Check MongoDB
  try {
    await Business.findOne();
    status.mongodb = true;
  } catch (e) {
    status.mongodbError = e.message;
  }

  // Check Twilio
  status.twilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  
  // Check OpenAI
  status.openai = !!process.env.OPENAI_API_KEY;
  
  // Check Email
  status.email = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

  res.json({
    success: true,
    status,
    environment: process.env.NODE_ENV,
    baseUrl: process.env.BASE_URL || process.env.WEBHOOK_BASE_URL || 'NOT SET'
  });
});

module.exports = router;
