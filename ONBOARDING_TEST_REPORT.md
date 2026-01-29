# Onboarding Flow Test Report (Without Email)

## STEP 1: Frontend Check

**There is no `callcrew-frontend/onboarding.html`.** Onboarding lives in the **Next.js** app:

- **App:** `callcrew-dashboard` (Next.js 14, App Router)
- **Route:** `/onboarding` → `src/app/onboarding/page.tsx` + `src/components/onboarding/steps.tsx`
- **Steps:** 5 steps (Business Setup → Template → Customize → Notifications → Launch)

### Form fields (current)

| Field | Step | Required | Notes |
|-------|------|----------|--------|
| Business Name | 1 | Yes | |
| Your Phone Number | 1 | Yes | Owner contact; mapped to `ownerPhone` |
| Email | 1 | Yes | Notifications; mapped to `ownerEmail` / `primaryEmail` |
| Time Zone | 1 | Yes | Dropdown |
| What does your business do? | 1 | Yes | `businessDescription` |
| Services you offer | 1 | No | Comma-separated |
| Template | 2 | Yes | 7 options (General, After-Hours, Coach, Gym, Salon, Sales, Executive Assistant) |
| Voice | 3 | Yes | 6 options (Alloy, Echo, Fable, Onyx, Nova, Shimmer) |
| Greeting | 3 | No | Default: "Thank you for calling [Business]! How can I help you today?" |
| Top 5 FAQs | 3 | No | Template-specific, editable |
| Email notifications | 4 | No | Toggle, default ON |
| SMS notifications | 4 | No | Toggle + number |
| Forward urgent calls | 4 | No | Toggle + number |

**Submit:** `POST ${API_URL}/api/onboarding/create` with JSON payload. On success, redirect to `/dashboard/${businessId}`.

- **Local:** `API_URL = http://localhost:3000`
- **Production:** `API_URL = https://web-production-6877d.up.railway.app`

All listed fields exist. Nothing missing for the “without email” test.

---

## STEP 2: Test Business Creation via API

**Correct endpoint:** `POST /api/onboarding/create` (not `/api/onboarding/business`).

### Minimal payload (required only)

```json
{
  "businessName": "Quick Test Business",
  "ownerEmail": "your-unique-email@example.com",
  "industry": "general"
}
```

### Full payload (matches frontend)

```json
{
  "businessName": "Quick Test Business",
  "ownerName": "Quick Test Business",
  "ownerEmail": "quick-test-20250122@example.com",
  "ownerPhone": "+15559876543",
  "industry": "general",
  "customGreeting": "Thanks for calling Quick Test Business!",
  "voiceType": "nova",
  "timezone": "America/New_York",
  "notificationSettings": {
    "primaryEmail": "quick-test-20250122@example.com",
    "enableEmail": false,
    "ccEmails": []
  }
}
```

### Curl

```bash
curl -X POST "https://web-production-6877d.up.railway.app/api/onboarding/create" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Quick Test Business",
    "ownerName": "Quick Test",
    "ownerEmail": "quick-test-20250122@example.com",
    "ownerPhone": "+15559876543",
    "industry": "general",
    "customGreeting": "Thanks for calling!",
    "voiceType": "nova",
    "notificationSettings": {
      "primaryEmail": "quick-test-20250122@example.com",
      "enableEmail": false,
      "ccEmails": []
    }
  }'
```

### Actual response (2025-01-22)

```json
{
  "success": true,
  "business": {
    "id": "697a4ab69d20275178ac62cd",
    "_id": "697a4ab69d20275178ac62cd",
    "businessName": "Quick Test Business",
    "phoneNumber": null,
    "formattedPhone": "",
    "industry": "general",
    "onboardingCompleted": true
  },
  "businessId": "697a4ab69d20275178ac62cd",
  "message": "Business created successfully! Your AI receptionist is ready."
}
```

- **Status:** 201
- **businessId:** `697a4ab69d20275178ac62cd`
- **phoneNumber:** `null` → **no Twilio number was provisioned.**

So business creation works, but number provisioning did not run or failed (e.g. search empty, provisioning error). Check Railway logs for `NUMBER SEARCH`, `provision`, and Twilio errors.

---

## STEP 3: Verify New Number

- **Expected:** `business.phoneNumber` or `business.formattedPhone` contains the provisioned Twilio number.
- **Actual:** Both empty; no number provisioned.

**When provisioning works:**

1. Twilio Console → Phone Numbers → Manage → Active Numbers.
2. Select the number for this business.
3. **Voice webhook:** `https://<BASE_URL>/webhooks/twilio/voice`  
   (no `/api` – backend mounts webhooks at `/webhooks/twilio`.)
4. **Status callback:** `https://<BASE_URL>/webhooks/twilio/status`

**BASE_URL** (e.g. `https://web-production-6877d.up.railway.app`) must match your deployment.

---

## STEP 4: Make a Test Call

**If you have a provisioned number (e.g. +1 844-687-6128 or the one from onboarding):**

1. Call it from your phone.
2. Confirm:
   - AI answers with the configured greeting.
   - AI asks for name → phone → reason.
   - You can complete the flow and say goodbye.
   - Call ends cleanly.

**If no number was provisioned:** Fix provisioning (see below) and create a new business or use an existing business that has a number.

---

## STEP 5: Check Data (MongoDB)

After a **successful** test call:

1. **Business:** `businesses` collection – record for this `businessId`.
2. **Call:** `calls` collection – new document with `twilioCallSid`, `business`, transcript.
3. **Lead:** `leads` collection – new lead with `callSid`, name, phone, reason.
4. **AI summary:** `lead.aiSummary` present (status `success` or `failed`).  
   Email check skipped for this “without email” test.

---

## What Works vs What’s Broken

| Item | Status |
|------|--------|
| Frontend onboarding form | ✅ Has all required fields, submits to `/api/onboarding/create` |
| POST /api/onboarding/create | ✅ 201, business created |
| businessId in response | ✅ Returned |
| Twilio number provisioned | ❌ `phoneNumber` null – provisioning failed or not run |
| Webhook config | ⚠️ Use `/webhooks/twilio/voice` and `.../status` (no `/api`) |
| Test call | ⏸️ Blocked until a number is provisioned |
| MongoDB (business/call/lead) | ⏸️ Depends on successful call |

---

## Fixing Number Provisioning

1. **Railway env:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `BASE_URL` (your Railway app URL).
2. **Railway logs:** Look for `NUMBER SEARCH`, `provision`, and Twilio errors when calling `/api/onboarding/create`.
3. **Twilio:** Ensure the project has US numbers available (local or toll‑free) and that the account can create numbers.

---

## Correct Curl Reference

```bash
# Create business (use a unique ownerEmail each time)
curl -X POST "https://web-production-6877d.up.railway.app/api/onboarding/create" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Quick Test Business",
    "ownerName": "Quick Test",
    "ownerEmail": "quick-test-'$(date +%Y%m%d%H%M)'@example.com",
    "industry": "general",
    "customGreeting": "Thanks for calling!",
    "voiceType": "nova",
    "notificationSettings": {
      "primaryEmail": "test@example.com",
      "enableEmail": false,
      "ccEmails": []
    }
  }'
```

Use **`/api/onboarding/create`** and the payload above. The earlier curl that used **`/api/onboarding/business`** and a different structure does not match the API.
