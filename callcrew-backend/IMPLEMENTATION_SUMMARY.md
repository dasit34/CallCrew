# AI Summary + Email Notification Implementation Summary

## ✅ FILES CREATED

1. **services/summaryService.js** - AI summary generation service
2. **services/emailService.js** - Email notification service using nodemailer

## ✅ FILES MODIFIED

1. **models/Lead.js** - Added fields:
   - `transcript: String`
   - `callSid: String`
   - `reasonForCalling: String`
   - `aiSummary: { text, status, model, generatedAt, error }`
   - `notification: { status, sentAt, error, recipients }`
   - Removed old `notificationSent` and `notificationSentAt` fields

2. **models/Business.js** - Added:
   - `notificationSettings: { primaryEmail, ccEmails, enableEmail, enableSMS }`

3. **routes/onboarding.js** - Updated:
   - Accepts `notificationSettings.primaryEmail` in request body
   - Validates email format
   - Saves to Business.notificationSettings
   - Sets `enableEmail: false` if no primaryEmail provided

4. **webhooks/twilioVoice.js** - Added:
   - `handleCallComplete()` function for summary + email processing
   - Calls `handleCallComplete()` after lead capture in both `endCall()` and status webhook
   - Imports: `summaryService`, `emailService`, `Lead` model

5. **services/leadCaptureService.js** - Updated:
   - Formats transcript as string before saving
   - Saves `transcript`, `callSid`, `reasonForCalling` to lead
   - Removed old notification sending code (now handled in handleCallComplete)

6. **routes/admin.js** - Added:
   - `requireAdminKey()` middleware for test endpoints
   - `GET /api/admin/test-email?email=test@example.com&key=ADMIN_KEY`
   - `GET /api/admin/test-summary?key=ADMIN_KEY`

## 🔧 RAILWAY ENVIRONMENT VARIABLES

Add these to Railway Dashboard → Variables:

### Required:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=callcrew25@gmail.com
SMTP_PASS=[Gmail App Password - see instructions below]
EMAIL_FROM=CallCrew <notifications@callcrew.ai>
OPENAI_API_KEY=[Your OpenAI API key]
```

### Optional (for test endpoints):
```
ADMIN_KEY=[Random secure string for protecting test endpoints]
```

### Already Set (verify these):
```
BASE_URL=https://web-production-6877d.up.railway.app
WEBHOOK_BASE_URL=https://web-production-6877d.up.railway.app
NODE_ENV=production
MONGODB_URI=[Your MongoDB URI]
TWILIO_ACCOUNT_SID=[Your Twilio SID]
TWILIO_AUTH_TOKEN=[Your Twilio Token]
```

## 📧 GMAIL APP PASSWORD SETUP

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with: `callcrew25@gmail.com`
3. Select app: "Mail"
4. Select device: "Other (Custom name)" → Enter "CallCrew"
5. Click "Generate"
6. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
7. Remove spaces and add to Railway: `SMTP_PASS=xxxxxxxxxxxxxxxx`
8. **Important:** This is NOT your regular Gmail password - it's a special app password

## 🧪 TEST COMMANDS

### 1. Test Email Configuration
```bash
curl "https://web-production-6877d.up.railway.app/api/admin/test-email?email=your-email@example.com&key=YOUR_ADMIN_KEY"
```

### 2. Test AI Summary Generation
```bash
curl "https://web-production-6877d.up.railway.app/api/admin/test-summary?key=YOUR_ADMIN_KEY"
```

### 3. Test Full Flow (Make a Call)
1. Call: +1 (844) 687-6128
2. Complete conversation (name, phone, reason)
3. End call
4. Check Railway logs for:
   - `📝 SUMMARY_GENERATING`
   - `✅ SUMMARY_SUCCESS` or `❌ SUMMARY_FAILED`
   - `📧 EMAIL_SENDING`
   - `✅ EMAIL_SENT` or `❌ EMAIL_FAILED`
   - `✅ LEAD_PROCESSED`

### 4. Verify Lead in Database
```bash
curl "https://web-production-6877d.up.railway.app/api/admin/leads?businessId=YOUR_BUSINESS_ID&limit=1"
```

Check for:
- `aiSummary.status: "success"` or `"failed"`
- `aiSummary.text: "..."` (summary text)
- `notification.status: "sent"` or `"failed"`
- `transcript: "..."` (full conversation)

## 📋 IMPLEMENTATION DETAILS

### Summary Generation Flow:
1. Call completes → Lead captured
2. `handleCallComplete()` called (non-blocking)
3. Transcript formatted as string
4. `summaryService.generateSummary()` called
5. Lead updated with `aiSummary` object
6. If summary succeeds, email sent
7. Lead updated with `notification` object

### Email Notification Flow:
1. After summary generated (or if summary fails)
2. Check `business.notificationSettings.enableEmail`
3. Check `business.notificationSettings.primaryEmail` exists
4. `emailService.sendLeadEmail()` called
5. Email includes:
   - AI summary (if available)
   - Lead details table
   - Full transcript (collapsible)
   - Call SID for reference
6. Lead updated with notification status

### Error Handling:
- All operations are wrapped in try/catch
- Failures logged but don't crash the system
- Lead always saved even if summary/email fails
- Status fields track success/failure

## 🔍 LOGGING

Watch Railway logs for these messages:

**Summary:**
- `📝 SUMMARY_GENERATING`
- `✅ SUMMARY_SUCCESS` (with preview)
- `❌ SUMMARY_FAILED` (with error)

**Email:**
- `📧 EMAIL_SENDING` (with recipient)
- `✅ EMAIL_SENT` (with messageId)
- `❌ EMAIL_FAILED` (with error)

**Processing:**
- `✅ LEAD_PROCESSED: [leadId]`
- `❌ LEAD_PROCESSING_ERROR: [error]`

## ✅ VERIFICATION CHECKLIST

After deployment:

- [ ] Railway ENV vars set (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM)
- [ ] Gmail App Password generated and added to SMTP_PASS
- [ ] OpenAI API key valid and set
- [ ] Test email endpoint works: `/api/admin/test-email?email=...&key=...`
- [ ] Test summary endpoint works: `/api/admin/test-summary?key=...`
- [ ] Make a test call and verify:
  - [ ] Lead created with transcript
  - [ ] AI summary generated (check `aiSummary.status`)
  - [ ] Email sent (check `notification.status`)
  - [ ] Email received in inbox

## 🚀 DEPLOYMENT

1. Commit changes:
```bash
git add .
git commit -m "Implement AI summary and email notifications"
git push origin main
```

2. Wait for Railway deployment (1-2 minutes)

3. Test endpoints to verify configuration

4. Make a test call to verify end-to-end flow
