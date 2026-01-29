# CallCrew – Railway deployment (www.callcrew.ai)

Frontend (Next.js static export) is served by the Express backend at `/`. API stays at `/api/*`, webhooks at `/webhooks/twilio/*`.

## 1. Where the frontend lives

- **`callcrew-dashboard/`** – Next.js 16 app (landing, onboarding, dashboard).
- **`callcrew-backend/`** – Express API + Twilio webhooks.
- No separate `callcrew-frontend`; the dashboard is the frontend.

## 2. Build and run

| Command | Effect |
|--------|--------|
| `npm run build` (repo root) | `cd callcrew-backend && npm install && cd ../callcrew-dashboard && npm ci && npm run build` |
| `npm start` (repo root) | `cd callcrew-backend && node server.js` |

Build output: `callcrew-dashboard/out` (static HTML/JS/CSS). The backend serves it and falls back to `index.html` for SPA routes.

## 3. Railway configuration

Use the **repository root** (`CallCrewMVP` / where `package.json` and `callcrew-backend` live) as the service root.

| Setting | Value |
|--------|--------|
| **Root directory** | `.` (repo root) |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Health check path** | `/health` |

Ensure `callcrew-dashboard` is part of the same repo and included in the build.

## 4. Environment variables (Railway)

- `NODE_ENV=production`
- `PORT=3000`
- `BASE_URL=https://www.callcrew.ai` (or your Railway URL before custom domain)
- `WEBHOOK_BASE_URL` – same as `BASE_URL` for Twilio webhooks
- `MONGODB_URI`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `OPENAI_API_KEY`, etc.

For **www.callcrew.ai**:

- `BASE_URL=https://www.callcrew.ai`
- `WEBHOOK_BASE_URL=https://www.callcrew.ai`

No trailing slash.

## 5. Custom domain (www.callcrew.ai)

1. Railway project → **Settings** → **Domains** → **Custom domain**.
2. Add `www.callcrew.ai`.
3. Set the CNAME record: `www.callcrew.ai` → `web-production-6877d.up.railway.app` (or your Railway host).

## 6. Routes

| URL | Served by |
|-----|-----------|
| `https://www.callcrew.ai/` | Frontend (landing) |
| `https://www.callcrew.ai/onboarding` | Frontend (onboarding) |
| `https://www.callcrew.ai/dashboard/:id` | Frontend (dashboard) |
| `https://www.callcrew.ai/api/*` | Backend API |
| `https://www.callcrew.ai/webhooks/twilio/*` | Twilio webhooks |
| `https://www.callcrew.ai/health` | Backend health |

## 7. Local dev

```bash
# Terminal 1 – backend
cd callcrew-backend && npm run dev

# Terminal 2 – frontend
cd callcrew-dashboard && npm run dev
```

Frontend: `http://localhost:3001`. API: `http://localhost:3000`. The dashboard uses `localhost:3000` for API when `hostname === 'localhost'`.

## 8. Optional: deploy from `callcrew-backend` only

If you deploy only `callcrew-backend` (no dashboard in build):

- Backend won’t serve the frontend; `HAS_FRONTEND` is false.
- `GET /` returns JSON API info.
- To serve the app at www.callcrew.ai, use repo root as above so the frontend build runs.
