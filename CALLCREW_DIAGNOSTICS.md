# CallCrew system check — diagnostic bundle

Generated: 2026-02-09T17:04:19Z

## 1) Repo overview

- **Framework detection**:
  - Frontend: Next.js (next.config.ts present)
  - Backend: Node/Express (server.js)
- **Folder structure summary**:
  - `callcrew-backend/` — Express API, Twilio/OpenAI/MongoDB
  - `callcrew-dashboard/` — Next.js app (App Router)
- **Key entrypoints**:
  - Backend: `callcrew-backend/server.js`
  - Frontend: `callcrew-dashboard/src/app/layout.tsx`, `page.tsx`

## 2) Environment expectations (var NAMES only)

**Backend** (from `callcrew-backend/env.template` + code):
  - ADMIN_KEY
  - BASE_URL
  - CORS_ORIGIN
  - EMAIL_FROM
  - EMAIL_PASSWORD
  - EMAIL_SERVICE
  - EMAIL_USER
  - FOUNDER_EMAIL
  - MONGODB_URI
  - NODE_ENV
  - OPENAI_API_KEY
  - PORT
  - SEND_TO_FOUNDER
  - SMTP_HOST
  - SMTP_PASS
  - SMTP_PORT
  - SMTP_USER
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - WEBHOOK_BASE_URL

**Frontend** (from code):
  - NEXT_PUBLIC_API_BASE_URL

## 3) Build sanity

### Root build
```
Command: npm run build
```
- **Result**: PASS

### Backend build
```
Command: (none — backend is Node, no compile step)
```
- **Result**: N/A

## 4) Runtime sanity

- **Start frontend locally**: `cd callcrew-dashboard && npm run dev` (dev server on port 3001) or `./start-dev.sh` from repo root
- **Start backend locally**: `cd callcrew-backend && npm run dev` (port 3000) or `node server.js` with `.env` in `callcrew-backend/`
- **Healthcheck endpoints**:
  - Backend: `GET /health` → JSON `{ status: 'healthy', ... }`

- **Backend health check (current host)**: not run or backend not reachable (curl localhost:3000/health)

## 5) Deployment indicators

| Config | Location | Notes |
|--------|----------|-------|
| Railway | `callcrew-backend/railway.json` | builder: NIXPACKS, startCommand: `node server.js`, healthcheckPath: `/health` |
| Railway | `callcrew-dashboard/railway.json` | startCommand: `npm start` |
| Procfile | `callcrew-backend/Procfile` | `web: node server.js` |

- **Backend (Railway/Nixpacks)**: Build command: (none or `npm install`). Output: N/A. Start: `node server.js`. Root must be `callcrew-backend` or start command must run from that directory.
- **Frontend (Railway)**: Build command: `npm run build`. Output dir: `.next` (Next.js). Start: `npm start` (runs `next start -p $PORT`).
- **Common misconfigs**:
  1. **Domain shows JSON or API response**: Frontend not deployed or wrong service; user hit backend root (which returns JSON when `callcrew-dashboard/out` is missing).
  2. **Blank site**: `NEXT_PUBLIC_API_BASE_URL` wrong or missing; CORS_ORIGIN on backend doesn’t match frontend origin; or frontend build failed.
  3. **Backend serves frontend only when `callcrew-dashboard/out` exists**: `server.js` expects a static export in `out`, but `next.config.ts` has no `output: 'export'` → no `out` dir → backend never serves UI, only API.

## 6) Minimal fix candidates (no code changes yet)

| Rank | Likely cause | One command/log/screenshot to confirm |
|------|----------------|----------------------------------------|
| 1 | Backend deployed as main domain (so users get JSON) or frontend not deployed | Check which Railway (or other) service is attached to the main domain; confirm a separate frontend service runs `npm start` and is on that domain. |
| 2 | Frontend build not producing `out` while backend expects it for serving UI | `ls -la callcrew-dashboard/out` after `npm run build` in dashboard; if missing, backend will never serve the app. |
| 3 | CORS or `NEXT_PUBLIC_API_BASE_URL` wrong in prod | Browser Network tab: request to API from frontend origin; check response CORS headers and 4xx; check `NEXT_PUBLIC_API_BASE_URL` in build env. |

---
*(End of diagnostic bundle)*
