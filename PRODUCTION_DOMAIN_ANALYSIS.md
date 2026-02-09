# Production domain analysis — why the frontend UI is not served

**Ground truth:** `CALLCREW_DIAGNOSTICS.md`  
**No code or behavior changes; config-only fix proposed.**

---

## 1) Intended frontend framework and build output directory

| Item | Value |
|------|--------|
| **Framework** | Next.js 16 (App Router), per `callcrew-dashboard/next.config.ts` and diagnostics §1. |
| **Intended build output (for backend-to-serve-UI)** | **`callcrew-dashboard/out`** — static HTML/JS/CSS. Backend `server.js` serves from `path.join(__dirname, '..', 'callcrew-dashboard', 'out')` and only serves the UI when that path exists. |
| **Current Next.js build output (no config change)** | **`.next`** — default for `next build` when `output: 'export'` is not set. So `next build` does **not** create `out`. |

*Source: CALLCREW_DIAGNOSTICS.md §1, §5 misconfig #3; `server.js` lines 9–10, 64–78; `RAILWAY_DEPLOY.md` §2.*

---

## 2) Which process/service is currently serving requests at the domain

**Inference from diagnostics and repo:**

- **Service bound to production domain (e.g. www.callcrew.ai):** Almost certainly the **backend** (Express) service.
- **Evidence:** CALLCREW_DIAGNOSTICS.md §5 misconfig #1 and §6 rank #1: “Domain shows JSON or API response” and “Backend deployed as main domain (so users get JSON)”. Backend returns JSON at `/` when `callcrew-dashboard/out` is missing (server.js lines 82–88).
- **Backend deployment:** `callcrew-backend/railway.json` → startCommand `node server.js`, healthcheckPath `/health`. So one Railway service runs from `callcrew-backend/` and has no access to a built frontend; the other service (dashboard) uses `npm start` (Next.js) and is a separate deploy.

**Conclusion:** The process serving the production domain is **Express (backend)** — `node server.js` in `callcrew-backend/`. The frontend (Next.js) is either not deployed on that domain or is a second service not attached to the main domain.

---

## 3) Mismatch between (1) and (2)

| Intended (per RAILWAY_DEPLOY + server.js) | Actual |
|-------------------------------------------|--------|
| One service: build dashboard → produce `out` → run backend → backend serves `out` at `/` and API at `/api`. | Backend service runs alone; it looks for `../callcrew-dashboard/out`; that path does not exist (Next.js never produces `out` because `next.config.ts` has no `output: 'export'`). |
| Domain gets HTML from backend’s static serve of `out`. | Domain gets JSON from backend’s “no frontend” fallback at `/`. |

**Mismatch in one sentence:** The backend is what’s bound to the domain and is written to serve the UI from `callcrew-dashboard/out`, but Next.js is not configured to emit a static export, so `out` is never created and the backend never serves the UI.

---

## 4) Smallest possible configuration-only fix

**Single change:** Make Next.js produce the static export that the backend already expects.

- **File:** `callcrew-dashboard/next.config.ts`
- **Change:** Add `output: 'export'` so `next build` writes to `callcrew-dashboard/out` instead of only `.next`.

**Diff (minimal):**

```diff
 const nextConfig: NextConfig = {
+  output: "export",
   turbopack: {},
   ...
 };
```

**Deploy requirement (no repo refactor):** The service that runs the backend must have run a build that includes the dashboard **and** must run from a directory where `callcrew-dashboard/out` exists relative to the backend (e.g. repo root with start command `cd callcrew-backend && node server.js` after `npm run build` at root). If today only the backend service is deployed (root = `callcrew-backend`), then the build step for that service must also build the dashboard and leave `out` in a path the backend can see (e.g. build at repo root so `callcrew-dashboard/out` exists next to `callcrew-backend/`). That’s a build/deploy pipeline setting, not a code refactor.

---

## 5) Exact verification steps

**A) Confirm which service is on the domain (backend vs Next.js)**

```bash
# If response is JSON with "name":"CallCrew Backend API" → backend is serving the domain.
curl -s https://www.callcrew.ai/ | head -5

# If you get HTML (e.g. <!DOCTYPE html> or <html) → frontend or something else is serving.
curl -sI https://www.callcrew.ai/
```

**B) Confirm `out` is missing today (root cause)**

```bash
cd /path/to/CallCrewMVP
npm run build
ls -la callcrew-dashboard/out
# Without output: 'export': No such file or directory (or directory empty).
```

**C) After adding `output: 'export'` — confirm `out` is produced**

```bash
cd /path/to/CallCrewMVP
npm run build
ls -la callcrew-dashboard/out
# Should show index.html and assets (e.g. _next/, etc.).
```

**D) Confirm backend serves UI when `out` exists (local)**

```bash
# From repo root, after build that produced callcrew-dashboard/out:
cd callcrew-backend && node server.js
# In another terminal:
curl -sI http://localhost:3000/
# Should be 200 with content-type text/html (and body should be HTML, not JSON).
curl -s http://localhost:3000/ | head -3
# Should start with <!DOCTYPE html> or similar.
```

**E) Healthcheck (anytime)**

```bash
curl -s https://www.callcrew.ai/health
# Backend: {"status":"healthy",...}
```

---

## Summary

| Question | Answer |
|----------|--------|
| (1) Intended frontend framework & build output | Next.js; **`callcrew-dashboard/out`** (static export). |
| (2) What is serving the domain now? | **Backend (Express)** — returns JSON at `/` when `out` is missing. |
| (3) Mismatch | Backend expects `out`; Next.js only produces `.next` → no `out` → no UI served. |
| (4) Smallest config-only fix | Add **`output: "export"`** to `callcrew-dashboard/next.config.ts`; ensure deploy builds dashboard and runs backend from a context where `callcrew-dashboard/out` exists. |

No refactors, no feature changes, minimal diff, config-only in repo.
