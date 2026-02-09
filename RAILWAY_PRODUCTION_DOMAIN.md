# callcrew.ai — Production domain serving frontend UI

**Goal:** callcrew.ai serves the Next.js frontend UI (static export from `callcrew-dashboard/out`).  
**Approach:** Config-only, minimal diff. One Railway service owns the domain and runs the backend, which serves the static export when present.

---

## 1) Which Railway service should own the production domain

**The backend service** — but that service must be the **single production service** that:

- Uses the **repository root** (`CallCrewMVP` / where this file lives) as the **Root Directory** in Railway (not `callcrew-backend`).
- Runs the **build** from repo root (so `callcrew-dashboard/out` is produced).
- Runs the **start** command that starts the Express server (`callcrew-backend/server.js`), so it can serve both the static UI from `callcrew-dashboard/out` and the API at `/api`, `/webhooks`, `/health`.

So: **one service**, root = repo root, build then start backend. That service should have the production domain (callcrew.ai / www.callcrew.ai) attached. Do **not** point the production domain at a service whose root is only `callcrew-dashboard` or only `callcrew-backend` unless it’s the combined setup above.

---

## 2) Exact build command

From repo root (Railway will run this when Root Directory is repo root):

```bash
npm run build
```

This runs `npm --prefix callcrew-dashboard ci && npm --prefix callcrew-dashboard run build` and produces **`callcrew-dashboard/out`** (Next.js static export).

---

## 3) Exact start command

From repo root:

```bash
cd callcrew-backend && node server.js
```

So the process that listens on `PORT` is the Express app. It will serve the UI from `../callcrew-dashboard/out` (relative to `callcrew-backend/`), which is the `out` produced by the build.

---

## 4) Exact domain binding steps (Railway)

1. In Railway: open the **project** that deploys this repo.
2. Use **one** service for production (the one that uses repo root and the build/start above). If you have two services (e.g. “backend” and “dashboard”), either:
   - Use only one service and set its **Root Directory** to the repo root (e.g. `.` or `CallCrewMVP`), with build/start as in §2–§3, **or**
   - Merge into one service and remove the other from the domain.
3. For that service: **Settings** → **Networking** → **Public Networking** → **Generate Domain** (if needed).
4. **Settings** → **Domains** → **Custom Domain** → add:
   - `www.callcrew.ai`
   - (optional) `callcrew.ai` if you want apex as well.
5. In your DNS provider for callcrew.ai:
   - **CNAME** `www` → Railway’s provided hostname (e.g. `xxx.up.railway.app`), **or**
   - **A** (for apex) per Railway’s instructions.
6. Ensure only this service is linked to the custom domain; no other service should have callcrew.ai / www.callcrew.ai.

---

## 5) Verification steps

**Browser**

- Open **https://www.callcrew.ai/** (or https://callcrew.ai/ if apex is set).
- **Success:** You see the CallCrew landing/frontend UI (HTML page), not a JSON response.
- **Failure:** You see raw JSON (e.g. `{"name":"CallCrew Backend API",...}`) → wrong service on domain or service not built/started as above.

**curl**

```bash
# Should return 200 and HTML (not JSON)
curl -sI https://www.callcrew.ai/

# Success: first line HTTP/1.1 200 …; header content-type: text/html
# Failure: content-type: application/json and body like {"name":"CallCrew Backend API",...}

# Body should start with HTML
curl -s https://www.callcrew.ai/ | head -5
# Success: <!DOCTYPE html> or <html ...
```

```bash
# Health (backend is up)
curl -s https://www.callcrew.ai/health
# Success: {"status":"healthy",...}
```

---

## 6) What NOT to change

- **No app code changes:** Do not change `server.js`, Next.js app code, or API behavior.
- **No refactors or renames:** Do not move folders or rename `callcrew-backend` / `callcrew-dashboard`.
- **No feature work:** Only fix “callcrew.ai not serving frontend UI” via Railway and repo-root config.
- **Next.js config:** Keep `output: "export"` in `callcrew-dashboard/next.config.ts`; do not remove it.
- **Backend env:** Keep existing env vars (e.g. `BASE_URL`, `CORS_ORIGIN`, `PORT`, etc.); only ensure `BASE_URL` / `CORS_ORIGIN` match the domain (e.g. `https://www.callcrew.ai`) if you use custom domain.
- **Other Railway services:** If you keep separate backend/dashboard services for other environments, do not give them the production domain; only the single “repo root + backend start” service should have callcrew.ai / www.callcrew.ai.
