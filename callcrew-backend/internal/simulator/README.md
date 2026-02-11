Internal CallCrew Simulator
===========================

This directory documents how to run the INTERNAL simulation batch for the CallCrew assistant.

Prerequisites:
- Node.js 20+
- Dependencies installed in the `callcrew-backend` package (`npm install` from `callcrew-backend/`)
- A valid OpenAI API key stored in an `.env` file

Setup:
- Create either `callcrew-backend/.env` (preferred) or repo root `.env`
- Add at least:

```bash
OPENAI_API_KEY=sk-...your-real-key...
MONGODB_URI=mongodb+srv://... # optional, for persistence
```

To run a baseline batch from the repo root:

```bash
cd /path/to/CallCrewMVP
npm run sim:batch
```

The command will:
- Automatically load env vars from `.env`
- Run a small batch of simulated calls against the current production assistant logic
- Print a single JSON summary object to stdout as the final line
- Best-effort persist results if MongoDB and `mongoose` are available

## How to Interpret Results

The simulator output includes a `readyForBeta` boolean that indicates launch readiness.

**If `readyForBeta=false`, do not onboard users.**

The `readyForBeta` gate requires:
- `quality.averageScore >= 80`
- All `gateFailures` values must be `0`:
  - `greeting_present`: 0 failures
  - `intent_captured`: 0 failures
  - `required_fields_captured`: 0 failures
  - `runtime_error`: 0 failures

Review `quality.recommendedFixes` for actionable improvements. The simulator JSON is the single source of truth for launch readiness.

