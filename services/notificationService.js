const nodemailer = require('nodemailer');
const NotificationRecipient = require('../models/NotificationRecipient');

class NotificationService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize the email transporter
   */
  initialize() {
    if (this.initialized) return;

    // Support both naming conventions
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;
    const emailService = process.env.EMAIL_SERVICE;

    if (emailService) {
      // Use service-based config (e.g., gmail)
      this.transporter = nodemailer.createTransport({
        service: emailService,
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });
    } else {
      // Use SMTP config
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });
    }

    this.initialized = true;
  }

  /**
   * Send an email notification
   * @param {Object} options - Email options
   */
  async sendEmail(options) {
    this.initialize();

    const { to, subject, text, html } = options;

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html
      });

      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send new lead notification
   * @param {Object} lead - The lead document
   * @param {Object} business - The business document
   * @param {Object} call - The call document (optional)
   */
  async sendNewLeadNotification(lead, business, call = null) {
    try {
      // Get notification recipients
      const recipients = await NotificationRecipient.getLeadNotificationRecipients(business._id);
      
      if (recipients.length === 0) {
        // Fall back to business owner
        recipients.push({ email: business.ownerEmail, name: business.ownerName });
      }

      // Filter out recipients in quiet hours
      const activeRecipients = recipients.filter(r => !r.isInQuietHours || !r.isInQuietHours());
      
      if (activeRecipients.length === 0) {
        console.log('All recipients are in quiet hours, skipping notification');
        return { success: true, skipped: true, reason: 'quiet_hours' };
      }

      const emailAddresses = activeRecipients.map(r => r.email);

      const subject = `🔔 New Lead: ${lead.name || 'Unknown'} - ${business.businessName}`;
      
      const html = this.generateLeadEmailHtml(lead, business, call);
      const text = this.generateLeadEmailText(lead, business, call);

      await this.sendEmail({
        to: emailAddresses,
        subject,
        text,
        html
      });

      // Update notification status on recipients
      for (const recipient of activeRecipients) {
        if (recipient.recordNotification) {
          await recipient.recordNotification();
        }
      }

      return { success: true, recipientCount: emailAddresses.length };
    } catch (error) {
      console.error('Error sending lead notification:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email for new lead
   */
  generateLeadEmailHtml(lead, business, call) {
    const callInfo = call ? `
      <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">📞 Call Details</h3>
        <p style="margin: 5px 0;"><strong>Duration:</strong> ${call.formattedDuration || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Intent:</strong> ${call.callerIntent || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Sentiment:</strong> ${call.sentiment || 'Unknown'}</p>
        ${call.conversationSummary ? `<p style="margin: 10px 0 5px 0;"><strong>Summary:</strong></p><p style="margin: 5px 0; color: #555;">${call.conversationSummary}</p>` : ''}
      </div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎉 New Lead Captured!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${business.businessName}</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 15px 0; color: #2e7d32;">Contact Information</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Name:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;">${lead.name || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Phone:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><a href="tel:${lead.phone}" style="color: #1976d2;">${lead.phone}</a></td>
            </tr>
            ${lead.email ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Email:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><a href="mailto:${lead.email}" style="color: #1976d2;">${lead.email}</a></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0;"><strong>Quality:</strong></td>
              <td style="padding: 8px 0;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background-color: ${lead.quality === 'hot' ? '#ffcdd2' : lead.quality === 'warm' ? '#ffe0b2' : '#e0e0e0'}; color: ${lead.quality === 'hot' ? '#c62828' : lead.quality === 'warm' ? '#ef6c00' : '#616161'};">
                  ${(lead.quality || 'unknown').toUpperCase()}
                </span>
              </td>
            </tr>
          </table>
        </div>

        ${lead.interestedIn ? `
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">💡 Interested In</h3>
          <p style="margin: 0; padding: 15px; background-color: #fff3e0; border-radius: 8px; color: #e65100;">${lead.interestedIn}</p>
        </div>
        ` : ''}

        ${lead.conversationSummary ? `
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">📝 Conversation Summary</h3>
          <p style="margin: 0; padding: 15px; background-color: #f5f5f5; border-radius: 8px; color: #555;">${lead.conversationSummary}</p>
        </div>
        ` : ''}

        ${lead.callbackRequested ? `
        <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f44336;">
          <strong>⚠️ Callback Requested!</strong>
          ${lead.callbackTime ? `<br>Preferred time: ${new Date(lead.callbackTime).toLocaleString()}` : ''}
        </div>
        ` : ''}

        ${callInfo}

        <div style="margin-top: 30px; text-align: center;">
          <a href="tel:${lead.phone}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold;">
            📞 Call Now
          </a>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        
        <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
          This lead was captured by CallCrew AI Receptionist<br>
          ${new Date().toLocaleString()}
        </p>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate plain text email for new lead
   */
  generateLeadEmailText(lead, business, call) {
    let text = `
NEW LEAD CAPTURED - ${business.businessName}
============================================

Contact Information:
- Name: ${lead.name || 'Not provided'}
- Phone: ${lead.phone}
${lead.email ? `- Email: ${lead.email}` : ''}
- Quality: ${(lead.quality || 'unknown').toUpperCase()}

`;

    if (lead.interestedIn) {
      text += `Interested In: ${lead.interestedIn}\n\n`;
    }

    if (lead.conversationSummary) {
      text += `Conversation Summary:\n${lead.conversationSummary}\n\n`;
    }

    if (lead.callbackRequested) {
      text += `⚠️ CALLBACK REQUESTED!\n`;
      if (lead.callbackTime) {
        text += `Preferred time: ${new Date(lead.callbackTime).toLocaleString()}\n`;
      }
      text += '\n';
    }

    if (call) {
      text += `Call Details:
- Duration: ${call.formattedDuration || 'N/A'}
- Intent: ${call.callerIntent || 'Unknown'}
- Sentiment: ${call.sentiment || 'Unknown'}
`;
    }

    text += `
--------------------------------------------
Captured by CallCrew AI Receptionist
${new Date().toLocaleString()}
`;

    return text;
  }

  /**
   * Send missed call notification
   * @param {Object} call - The call document
   * @param {Object} business - The business document
   */
  async sendMissedCallNotification(call, business) {
    try {
      const recipients = await NotificationRecipient.find({
        business: business._id,
        isActive: true,
        'notifications.email.enabled': true,
        'notifications.email.missedCall': true
      });

      if (recipients.length === 0) {
        return { success: true, skipped: true, reason: 'no_recipients' };
      }

      const activeRecipients = recipients.filter(r => !r.isInQuietHours());
      if (activeRecipients.length === 0) {
        return { success: true, skipped: true, reason: 'quiet_hours' };
      }

      const emailAddresses = activeRecipients.map(r => r.email);

      await this.sendEmail({
        to: emailAddresses,
        subject: `📵 Missed Call - ${business.businessName}`,
        text: `You missed a call from ${call.fromNumber} at ${new Date(call.startTime).toLocaleString()}`,
        html: `
          <h2>Missed Call</h2>
          <p><strong>From:</strong> ${call.fromNumber}</p>
          <p><strong>Time:</strong> ${new Date(call.startTime).toLocaleString()}</p>
          <p><a href="tel:${call.fromNumber}">Call Back</a></p>
        `
      });

      return { success: true, recipientCount: emailAddresses.length };
    } catch (error) {
      console.error('Error sending missed call notification:', error);
      throw error;
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConfiguration() {
    this.initialize();

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      console.error('Email configuration error:', error);
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance
module.exports = new NotificationService();
