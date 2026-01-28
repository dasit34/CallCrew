const mongoose = require('mongoose');

const transcriptEntrySchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['assistant', 'user', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const callSchema = new mongoose.Schema({
  // Associated Business
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  
  // Twilio Call Information
  twilioCallSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  twilioAccountSid: {
    type: String
  },
  
  // Phone Numbers
  fromNumber: {
    type: String,
    required: true
  },
  toNumber: {
    type: String,
    required: true
  },
  
  // Call Status & Timing
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'cancelled'],
    default: 'initiated'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  
  // Call Direction
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    default: 'inbound'
  },
  
  // AI Conversation
  transcript: [transcriptEntrySchema],
  conversationSummary: {
    type: String,
    default: ''
  },
  fullTranscript: {
    type: String,
    default: ''
  },
  conversationLength: {
    type: Number,
    default: 0
  },
  
  // Caller Intent & Sentiment
  callerIntent: {
    type: String,
    enum: ['inquiry', 'booking', 'support', 'complaint', 'sales', 'other', 'unknown'],
    default: 'unknown'
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative', 'unknown'],
    default: 'unknown'
  },
  
  // Lead Capture
  leadCaptured: {
    type: Boolean,
    default: false
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  
  // Call Outcome
  outcome: {
    type: String,
    enum: ['lead_captured', 'info_provided', 'transferred', 'voicemail', 'callback_scheduled', 'hung_up', 'other'],
    default: 'other'
  },
  
  // Transfer Information
  wasTransferred: {
    type: Boolean,
    default: false
  },
  transferredTo: {
    type: String
  },
  
  // Recording
  recordingUrl: {
    type: String
  },
  recordingSid: {
    type: String
  },
  
  // AI Processing Stats
  aiStats: {
    tokensUsed: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 }, // Average response time in ms
    turnsCount: { type: Number, default: 0 }
  },
  
  // Error Handling
  callErrors: [{
    message: String,
    timestamp: { type: Date, default: Date.now },
    context: String
  }],
  
  // Metadata
  metadata: {
    city: String,
    state: String,
    country: String,
    callerName: String,
    isAfterHours: Boolean
  }
}, {
  timestamps: true
});

// Indexes for common queries
callSchema.index({ business: 1, createdAt: -1 });
callSchema.index({ fromNumber: 1 });
callSchema.index({ status: 1 });
callSchema.index({ createdAt: -1 });

// Calculate duration on save
callSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 1000);
  }
  next();
});

// Virtual for formatted duration
callSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Static method to get calls for a business
callSchema.statics.getBusinessCalls = function(businessId, options = {}) {
  const { limit = 50, skip = 0, status, startDate, endDate } = options;
  
  const query = { business: businessId };
  
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('lead');
};

// Instance method to add transcript entry
callSchema.methods.addTranscriptEntry = function(role, content) {
  this.transcript.push({ role, content, timestamp: new Date() });
  this.aiStats.turnsCount = this.transcript.length;
  return this.save();
};

// Instance method to complete call
callSchema.methods.completeCall = async function(summary = '') {
  this.status = 'completed';
  this.endTime = new Date();
  this.conversationSummary = summary;
  
  // Update business stats
  const Business = mongoose.model('Business');
  await Business.findByIdAndUpdate(this.business, {
    $inc: {
      'stats.totalCalls': 1,
      'stats.totalMinutes': Math.ceil(this.duration / 60)
    }
  });
  
  return this.save();
};

module.exports = mongoose.model('Call', callSchema);
