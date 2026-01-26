const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    if (this.initialized) return;

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

    if (!smtpUser || !smtpPass) {
      console.warn('⚠️ Email credentials not configured (SMTP_USER/SMTP_PASS)');
      this.initialized = true; // Mark as initialized to prevent repeated warnings
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    this.initialized = true;
    console.log('✅ Email transporter initialized');
  }

  /**
   * Send lead notification email
   * @param {Object} options - Email options
   * @param {Object} options.business - Business document
   * @param {Object} options.lead - Lead document
   * @param {string} options.summary - AI-generated summary (optional)
   * @returns {Promise<Object>} Result with success, error, messageId
   */
  async sendLeadEmail({ business, lead, summary }) {
    console.log('📧 EMAIL_SENDING');
    console.log('Business:', business.businessName);
    console.log('Lead:', lead.name);
    console.log('Summary available:', !!summary);

    try {
      this.initialize();

      if (!this.transporter) {
        const error = 'Email transporter not configured (missing SMTP credentials)';
        console.error('❌ EMAIL_FAILED:', error);
        return {
          success: false,
          error: error,
          messageId: null
        };
      }

      // Get recipients
      const primaryEmail = business.notificationSettings?.primaryEmail;
      if (!primaryEmail) {
        const error = 'No primaryEmail configured for business';
        console.error('❌ EMAIL_FAILED:', error);
        return {
          success: false,
          error: error,
          messageId: null
        };
      }

      const recipients = [primaryEmail];
      if (business.notificationSettings?.ccEmails?.length > 0) {
        recipients.push(...business.notificationSettings.ccEmails);
      }

      console.log('Recipients:', recipients.join(', '));

      // Format phone number
      const formatPhone = (phone) => {
        if (!phone) return 'Not provided';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
      };

      // Build subject
      const shortReason = lead.reasonForCalling 
        ? lead.reasonForCalling.substring(0, 50) 
        : 'General inquiry';
      const subject = `New Lead: ${lead.name || 'Unknown'} - ${shortReason}`;

      // Build HTML email
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #4F46E5; margin-top: 0; }
    h2 { color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
    .summary-box { background: #f0f9ff; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table td { padding: 10px; border-bottom: 1px solid #e5e5e5; }
    table td:first-child { font-weight: 600; color: #666; width: 150px; }
    .transcript { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 12px; text-align: center; }
    .call-sid { color: #999; font-size: 11px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎉 New Lead Captured</h1>
    <p><strong>${business.businessName}</strong></p>
    
    ${summary ? `
    <div class="summary-box">
      <h2>AI Summary</h2>
      <p>${summary.replace(/\n/g, '<br>')}</p>
    </div>
    ` : '<p style="color: #999; font-style: italic;">Summary unavailable</p>'}
    
    <h2>Lead Details</h2>
    <table>
      <tr>
        <td>Name</td>
        <td>${lead.name || 'Not provided'}</td>
      </tr>
      <tr>
        <td>Phone</td>
        <td><a href="tel:${lead.phone}">${formatPhone(lead.phone)}</a></td>
      </tr>
      ${lead.email ? `
      <tr>
        <td>Email</td>
        <td><a href="mailto:${lead.email}">${lead.email}</a></td>
      </tr>
      ` : ''}
      <tr>
        <td>Reason for Calling</td>
        <td>${lead.reasonForCalling || lead.interestedIn || 'Not specified'}</td>
      </tr>
      <tr>
        <td>Quality</td>
        <td><strong>${(lead.quality || 'unknown').toUpperCase()}</strong></td>
      </tr>
      <tr>
        <td>Call Time</td>
        <td>${new Date(lead.createdAt).toLocaleString()}</td>
      </tr>
    </table>
    
    ${lead.transcript ? `
    <h2>Full Transcript</h2>
    <div class="transcript">${lead.transcript}</div>
    ` : ''}
    
    <div class="footer">
      <p>This lead was captured by CallCrew AI Receptionist</p>
      ${lead.callSid ? `<p class="call-sid">Call SID: ${lead.callSid}</p>` : ''}
      <p>${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
      `;

      // Plain text version
      const text = `
NEW LEAD CAPTURED - ${business.businessName}
============================================

${summary ? `AI SUMMARY:\n${summary}\n\n` : 'Summary unavailable\n\n'}

LEAD DETAILS:
- Name: ${lead.name || 'Not provided'}
- Phone: ${formatPhone(lead.phone)}
${lead.email ? `- Email: ${lead.email}\n` : ''}
- Reason: ${lead.reasonForCalling || lead.interestedIn || 'Not specified'}
- Quality: ${(lead.quality || 'unknown').toUpperCase()}
- Call Time: ${new Date(lead.createdAt).toLocaleString()}

${lead.transcript ? `\nFULL TRANSCRIPT:\n${lead.transcript}\n` : ''}

${lead.callSid ? `Call SID: ${lead.callSid}\n` : ''}
============================================
Captured by CallCrew AI Receptionist
${new Date().toLocaleString()}
      `;

      const emailFrom = process.env.EMAIL_FROM || `CallCrew <${smtpUser}>`;

      const info = await this.transporter.sendMail({
        from: emailFrom,
        to: recipients.join(', '),
        subject: subject,
        text: text,
        html: html
      });

      console.log('✅ EMAIL_SENT');
      console.log('Message ID:', info.messageId);
      console.log('Recipients:', recipients.join(', '));

      return {
        success: true,
        error: null,
        messageId: info.messageId
      };

    } catch (error) {
      console.error('❌ EMAIL_FAILED');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);

      return {
        success: false,
        error: error.message || 'Unknown error',
        messageId: null
      };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
