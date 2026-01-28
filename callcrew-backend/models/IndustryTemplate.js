const mongoose = require('mongoose');

const industryTemplateSchema = new mongoose.Schema({
  // Template Identifier
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Display Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '📞'
  },
  
  // AI System Prompt
  systemPrompt: {
    type: String,
    required: true
  },
  
  // Default Greeting
  defaultGreeting: {
    type: String,
    required: true
  },
  
  // Voice Configuration
  recommendedVoice: {
    type: String,
    enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    default: 'alloy'
  },
  
  // Common Services for this industry
  suggestedServices: [{
    name: String,
    description: String
  }],
  
  // Common FAQs
  suggestedFaqs: [{
    question: String,
    answer: String
  }],
  
  // Lead Qualification Questions
  qualificationQuestions: [{
    question: String,
    importance: {
      type: String,
      enum: ['required', 'recommended', 'optional'],
      default: 'recommended'
    }
  }],
  
  // Information to capture
  infoToCapture: [{
    field: String,
    prompt: String,
    required: Boolean
  }],
  
  // Call Flow Settings
  callFlowSettings: {
    maxTurns: {
      type: Number,
      default: 10
    },
    prioritizeLeadCapture: {
      type: Boolean,
      default: true
    },
    offerCallback: {
      type: Boolean,
      default: true
    },
    offerAppointment: {
      type: Boolean,
      default: false
    }
  },
  
  // Default Business Hours (template)
  defaultBusinessHours: [{
    day: String,
    open: String,
    close: String,
    isClosed: Boolean
  }],
  
  // Active Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Order for display
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
industryTemplateSchema.index({ isActive: 1, displayOrder: 1 });

// Static method to get all active templates
industryTemplateSchema.statics.getActiveTemplates = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1 });
};

// Static method to get template by slug
industryTemplateSchema.statics.getBySlug = function(slug) {
  return this.findOne({ slug: slug.toLowerCase() });
};

module.exports = mongoose.model('IndustryTemplate', industryTemplateSchema);
