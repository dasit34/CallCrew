const mongoose = require('mongoose');

const notificationRecipientSchema = new mongoose.Schema({
  // Associated Business
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  
  // Recipient Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  
  // Role
  role: {
    type: String,
    enum: ['owner', 'manager', 'staff', 'other'],
    default: 'staff'
  },
  
  // Notification Preferences
  notifications: {
    // Email Notifications
    email: {
      enabled: { type: Boolean, default: true },
      newLead: { type: Boolean, default: true },
      missedCall: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: false },
      weeklySummary: { type: Boolean, default: true },
      urgentOnly: { type: Boolean, default: false }
    },
    // SMS Notifications
    sms: {
      enabled: { type: Boolean, default: false },
      newLead: { type: Boolean, default: false },
      missedCall: { type: Boolean, default: false },
      urgentOnly: { type: Boolean, default: true }
    }
  },
  
  // Quiet Hours (don't send notifications during these times)
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00' },
    end: { type: String, default: '08:00' },
    timezone: { type: String, default: 'America/New_York' }
  },
  
  // Active Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Stats
  notificationsSent: {
    type: Number,
    default: 0
  },
  lastNotificationAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index
notificationRecipientSchema.index({ business: 1, email: 1 }, { unique: true });

// Static method to get recipients for a business
notificationRecipientSchema.statics.getBusinessRecipients = function(businessId, type = 'email') {
  const query = {
    business: businessId,
    isActive: true
  };
  
  if (type === 'email') {
    query['notifications.email.enabled'] = true;
  } else if (type === 'sms') {
    query['notifications.sms.enabled'] = true;
  }
  
  return this.find(query);
};

// Static method to get recipients for new lead notification
notificationRecipientSchema.statics.getLeadNotificationRecipients = function(businessId) {
  return this.find({
    business: businessId,
    isActive: true,
    $or: [
      { 'notifications.email.enabled': true, 'notifications.email.newLead': true },
      { 'notifications.sms.enabled': true, 'notifications.sms.newLead': true }
    ]
  });
};

// Instance method to check if in quiet hours
notificationRecipientSchema.methods.isInQuietHours = function() {
  if (!this.quietHours.enabled) return false;
  
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: this.quietHours.timezone 
  });
  
  const start = this.quietHours.start;
  const end = this.quietHours.end;
  
  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }
  
  return currentTime >= start && currentTime <= end;
};

// Instance method to increment notification count
notificationRecipientSchema.methods.recordNotification = function() {
  this.notificationsSent += 1;
  this.lastNotificationAt = new Date();
  return this.save();
};

module.exports = mongoose.model('NotificationRecipient', notificationRecipientSchema);
