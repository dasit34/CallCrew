# Turn-by-turn latency instrumentation

## Overview

The gather webhook (`POST /api/webhooks/twilio/gather`) logs **per-turn latency** as JSON one-liners. Use these to find slow turns and bottlenecks (DB, LLM, TTS, total).

## Log format

Each log line is a single JSON object with:

| Field | Description |
|-------|-------------|
| `_type` | `"turn_latency"` – use this to filter |
| `callSid` | Twilio Call SID |
| `turnIndex` | 0-based turn index for this call (-1 on early exits) |
| `stt_ms` | Always `0` – STT runs on Twilio |
| `llm_ms` | Time spent in OpenAI / `getAIResponse` (ms) |
| `tts_ms` | Time to build TwiML + `sendTwiML` (ms) |
| `db_ms` | Time spent in MongoDB (CallState, Call, Lead, etc.) (ms) |
| `total_turn_ms` | Full request duration (ms) |

## Where to find these logs in Railway

1. Open your **Railway** project → select the **CallCrew backend** service.
2. Go to the **Deployments** tab → open the **latest deployment**.
3. Click **View Logs** (or use the **Logs** tab for the service).
4. Filter by `turn_latency`:
   - In the log UI search: `turn_latency`
   - Or `_type":"turn_latency"` for strict JSON key match.

Alternatively, use the **Railway CLI**:

```bash
railway logs --service callcrew-backend | grep turn_latency
```

Or stream and filter:

```bash
railway logs -f | grep '"_type":"turn_latency"'
```

## Sample log line

```json
{"_type":"turn_latency","callSid":"CA1234567890abcdef","turnIndex":2,"stt_ms":0,"llm_ms":412,"tts_ms":3,"db_ms":89,"total_turn_ms":508}
```

Interpretation:

- **llm_ms: 412** – OpenAI call took ~412 ms.
- **db_ms: 89** – MongoDB ops took ~89 ms.
- **tts_ms: 3** – Building and sending TwiML took ~3 ms.
- **total_turn_ms: 508** – Entire gather request ~508 ms.

## Implementation

- **`measure(name, fn)`** – Runs `fn`, returns `{ result, ms }`.
- **`logTurnLatency(payload)`** – `console.log` of `JSON.stringify({ _type: 'turn_latency', ...payload })`.
- **`runDb` / `runLlm`** – Wrap DB and LLM work, add `ms` into `timing.db_ms` / `timing.llm_ms`.

Instrumentation is applied in the gather handler for:

- Recovery (CallState / Call lookup)
- Empty speech, low-confidence, no-call early exits
- Main flow: DB (State, Call, transcript), optional LLM, then TwiML build + send

All return paths emit a latency log before sending the TwiML response (or before `endCall` for goodbye).
