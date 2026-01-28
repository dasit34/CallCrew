const mongoose = require('mongoose');

const CallStateSchema = new mongoose.Schema({
  callSid: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  stage: { 
    type: String, 
    default: 'GREETING',
    enum: ['GREETING', 'GET_NAME', 'GET_PHONE', 'GET_REASON', 'CONVERSATION', 'CLOSING']
  },
  collectedData: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    reason: { type: String, default: null }
  },
  retryAttempts: {
    name: { type: Number, default: 0 },
    phone: { type: Number, default: 0 },
    reason: { type: Number, default: 0 }
  },
  transcript: [{ type: String }],
  currentQuestion: { type: String },
  timeoutCount: { type: Number, default: 0 },
  lowConfidenceAttempts: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Auto-cleanup old states after 24 hours
CallStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('CallState', CallStateSchema);

