const mongoose = require('mongoose');

const businessHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  open: {
    type: String, // Format: "09:00"
    required: true
  },
  close: {
    type: String, // Format: "17:00"
    required: true
  },
  isClosed: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const businessSchema = new mongoose.Schema({
  // Basic Information
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  ownerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  ownerPhone: {
    type: String,
    trim: true
  },
  
  // Industry & Template
  industry: {
    type: String,
    required: true,
    enum: ['general', 'after-hours', 'coach', 'gym', 'salon', 'sales', 'executive-assistant']
  },
  industryTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IndustryTemplate'
  },
  
  // Twilio Phone Number
  twilioPhoneNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  twilioPhoneSid: {
    type: String
  },
  
  // Custom Greeting & Instructions
  customGreeting: {
    type: String,
    default: ''
  },
  customInstructions: {
    type: String,
    default: ''
  },
  voiceType: {
    type: String,
    enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    default: 'alloy'
  },
  
  // Business Hours
  businessHours: [businessHoursSchema],
  timezone: {
    type: String,
    default: 'America/New_York'
  },
  
  // Services/Products (for AI context)
  services: [{
    name: String,
    description: String,
    price: String,
    duration: String
  }],
  
  // FAQ for AI
  faqs: [{
    question: String,
    answer: String
  }],
  
  // Call Handling Settings
  callSettings: {
    maxCallDuration: {
      type: Number,
      default: 300 // 5 minutes in seconds
    },
    transferNumber: {
      type: String,
      default: ''
    },
    enableTransfer: {
      type: Boolean,
      default: false
    },
    afterHoursMessage: {
      type: String,
      default: 'We are currently closed. Please leave a message and we will get back to you.'
    }
  },
  
  // Notification Settings
  notificationSettings: {
    primaryEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    ccEmails: [{
      type: String,
      lowercase: true,
      trim: true
    }],
    enableEmail: {
      type: Boolean,
      default: true
    },
    enableSMS: {
      type: Boolean,
      default: false
    }
  },
  
  // Subscription Status
  subscription: {
    plan: {
      type: String,
      enum: ['trial', 'basic', 'pro', 'enterprise'],
      default: 'trial'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'past_due', 'trialing'],
      default: 'trialing'
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  
  // Stats
  stats: {
    totalCalls: { type: Number, default: 0 },
    totalLeads: { type: Number, default: 0 },
    totalMinutes: { type: Number, default: 0 }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
businessSchema.index({ ownerEmail: 1 });
businessSchema.index({ industry: 1 });

// Virtual for full phone display
businessSchema.virtual('formattedPhone').get(function() {
  if (!this.twilioPhoneNumber) return '';
  const cleaned = this.twilioPhoneNumber.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return this.twilioPhoneNumber;
});

// Method to check if currently open
businessSchema.methods.isCurrentlyOpen = function() {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  
  const todayHours = this.businessHours.find(h => h.day === currentDay);
  if (!todayHours || todayHours.isClosed) return false;
  
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: this.timezone 
  });
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

module.exports = mongoose.model('Business', businessSchema);
