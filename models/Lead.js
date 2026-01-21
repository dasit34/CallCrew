const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Associated Business
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  
  // Associated Call (if captured during a call)
  call: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call'
  },
  
  // Contact Information
  name: {
    type: String,
    trim: true,
    default: 'Unknown'
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Lead Source
  source: {
    type: String,
    enum: ['phone_call', 'voicemail', 'transfer', 'callback_request', 'manual'],
    default: 'phone_call'
  },
  
  // Lead Status
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost', 'archived'],
    default: 'new'
  },
  
  // Lead Quality
  quality: {
    type: String,
    enum: ['hot', 'warm', 'cold', 'unknown'],
    default: 'unknown'
  },
  
  // Interest Information
  interestedIn: {
    type: String,
    default: ''
  },
  services: [{
    type: String
  }],
  
  // Communication Preferences
  preferredContactMethod: {
    type: String,
    enum: ['phone', 'email', 'text', 'any'],
    default: 'any'
  },
  preferredContactTime: {
    type: String
  },
  
  // Conversation Context
  conversationSummary: {
    type: String,
    default: ''
  },
  specificRequests: {
    type: String,
    default: ''
  },
  questions: [{
    type: String
  }],
  
  // Appointment/Callback
  callbackRequested: {
    type: Boolean,
    default: false
  },
  callbackTime: {
    type: Date
  },
  appointmentRequested: {
    type: Boolean,
    default: false
  },
  appointmentDetails: {
    type: String
  },
  
  // Follow-up
  followUpDate: {
    type: Date
  },
  followUpNotes: {
    type: String
  },
  lastContactedAt: {
    type: Date
  },
  contactAttempts: {
    type: Number,
    default: 0
  },
  
  // Notes
  notes: [{
    content: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Tags
  tags: [{
    type: String
  }],
  
  // Notification Status
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: {
    type: Date
  },
  
  // Value
  estimatedValue: {
    type: Number,
    default: 0
  },
  
  // Metadata
  metadata: {
    city: String,
    state: String,
    country: String,
    timezone: String,
    callerIdName: String
  }
}, {
  timestamps: true
});

// Indexes
leadSchema.index({ business: 1, createdAt: -1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ quality: 1 });
leadSchema.index({ createdAt: -1 });

// Virtual for full name
leadSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.name || 'Unknown';
});

// Pre-save middleware to update business stats
leadSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Business = mongoose.model('Business');
    await Business.findByIdAndUpdate(this.business, {
      $inc: { 'stats.totalLeads': 1 }
    });
  }
  next();
});

// Static method to find leads by phone
leadSchema.statics.findByPhone = function(phone, businessId) {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return this.find({
    business: businessId,
    phone: { $regex: normalizedPhone }
  }).sort({ createdAt: -1 });
};

// Static method to get recent leads
leadSchema.statics.getRecentLeads = function(businessId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    business: businessId,
    createdAt: { $gte: startDate }
  }).sort({ createdAt: -1 });
};

// Instance method to add note
leadSchema.methods.addNote = function(content, createdBy = 'System') {
  this.notes.push({ content, createdBy });
  return this.save();
};

// Instance method to update status
leadSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  if (newStatus === 'contacted') {
    this.lastContactedAt = new Date();
    this.contactAttempts += 1;
  }
  return this.save();
};

module.exports = mongoose.model('Lead', leadSchema);
