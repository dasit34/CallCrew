/**
 * Setup Demo Assistant Script
 * Updates the CallCrew demo business with professional demo script
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');

const DEMO_PHONE = '+18446876128';

const demoConfig = {
  businessName: 'CallCrew Demo',
  ownerName: 'CallCrew Team',
  ownerEmail: 'demo@callcrew.ai',
  industry: 'general',
  isActive: true,
  onboardingCompleted: true,
  voiceType: 'nova', // Warm, friendly female voice
  
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
    {
      question: "How much does CallCrew cost?",
      answer: "Pricing varies based on your needs and call volume. I can have our team reach out with specific pricing for your situation. Would you like that?"
    },
    {
      question: "How do I sign up?",
      answer: "The best way is a quick setup call where we configure your assistant for your specific business. Can I get your email to have someone reach out?"
    },
    {
      question: "How long does setup take?",
      answer: "Most businesses are live in under 10 minutes. We help you set up your greeting, questions, and notification preferences, then you just forward your calls."
    },
    {
      question: "Do I keep my business number?",
      answer: "Absolutely! You keep your existing number. When you want CallCrew to answer, you just turn on call forwarding. Turn it off anytime to answer calls yourself."
    },
    {
      question: "Can you transfer calls to me?",
      answer: "Yes! You can set rules for urgent calls or VIP customers to be transferred directly to your cell phone."
    },
    {
      question: "What if you don't know the answer?",
      answer: "I'll let the caller know someone will get back to them, capture their info, and send you a summary so you can follow up with the right answer."
    },
    {
      question: "Is this available 24/7?",
      answer: "Yes, I can answer around the clock. But you control when - you can set me up for just lunch hours, after hours, weekends, or 24/7. Whatever works for your business."
    },
    {
      question: "How do I get the call summaries?",
      answer: "After each call, you get a text message or email - your choice - within seconds. It includes who called, what they wanted, and any info they shared."
    }
  ],

  services: [
    {
      name: "24/7 Call Answering",
      description: "AI receptionist answers calls anytime, or only during hours you set"
    },
    {
      name: "Lead Capture",
      description: "Collects caller name, number, and reason for calling"
    },
    {
      name: "Caller Qualification",
      description: "Asks your screening questions to prioritize callbacks"
    },
    {
      name: "Appointment Requests",
      description: "Takes down service needs and preferred times"
    },
    {
      name: "Call Routing",
      description: "Transfers urgent calls directly to your cell"
    },
    {
      name: "Instant Summaries",
      description: "Text or email summary after every call"
    }
  ],

  callSettings: {
    maxCallDuration: 600, // 10 minutes for demo
    enableTransfer: false,
    afterHoursMessage: "Thanks for calling CallCrew! I'm available 24/7 to demo our AI receptionist. How can I help you today?"
  }
};

async function setupDemoAssistant() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!\n');

    // Find existing demo business
    let demoBusiness = await Business.findOne({ twilioPhoneNumber: DEMO_PHONE });

    if (demoBusiness) {
      console.log('Found existing demo business. Updating...');
      
      // Update with new config
      Object.assign(demoBusiness, demoConfig);
      await demoBusiness.save();
      
      console.log('Demo assistant updated successfully!\n');
    } else {
      console.log('No existing demo business found. Creating new one...');
      
      demoBusiness = new Business({
        ...demoConfig,
        twilioPhoneNumber: DEMO_PHONE
      });
      await demoBusiness.save();
      
      console.log('Demo assistant created successfully!\n');
    }

    console.log('=== DEMO ASSISTANT CONFIGURATION ===');
    console.log(`Business Name: ${demoBusiness.businessName}`);
    console.log(`Phone Number: ${demoBusiness.twilioPhoneNumber}`);
    console.log(`Voice: ${demoBusiness.voiceType}`);
    console.log(`Active: ${demoBusiness.isActive}`);
    console.log(`FAQs: ${demoBusiness.faqs.length} configured`);
    console.log(`Services: ${demoBusiness.services.length} listed`);
    console.log('\n=== GREETING ===');
    console.log(demoBusiness.customGreeting);
    console.log('\n=== READY FOR CALLS ===');
    console.log(`Call ${DEMO_PHONE} to test the demo!`);

  } catch (error) {
    console.error('Error setting up demo assistant:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

setupDemoAssistant();
