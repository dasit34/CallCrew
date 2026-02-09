# Frontend-only Railway service (callcrew.ai)

**Goal:** A dedicated **frontend** Railway service that serves only the static Next.js export. Domain callcrew.ai attaches to this service. Backend stays a separate service; no combined service.

---

## 1) Frontend Railway service — build command

From the **frontend** service root (`callcrew-dashboard`):

```bash
npm ci && npm run build
```

- Runs in the service that has **Root Directory** = `callcrew-dashboard`.
- Produces the static export in **`callcrew-dashboard/out`** (Next.js `output: "export"`).

---

## 2) Frontend Railway service — start command

From the **frontend** service root (`callcrew-dashboard`), after the build:

```bash
npx serve out -s
```

- Serves the **`out`** directory (static files only).
- `-s` = SPA fallback (unknown paths → `index.html`).
- Railway sets `PORT`; `serve` uses it automatically.
- No backend process runs in this service.

---

## 3) Which service owns callcrew.ai

**The frontend service** (the one whose Root Directory is `callcrew-dashboard`, using the build and start commands above) owns the production domain.

- Attach **callcrew.ai** and/or **www.callcrew.ai** to this frontend service only.
- Do **not** attach the production domain to the backend service. Backend can use a different domain (e.g. api.callcrew.ai) or its Railway-generated URL.

---

## 4) Verification steps (HTML loads, not JSON)

**Browser**

- Open **https://www.callcrew.ai/** (or https://callcrew.ai/).
- **Success:** CallCrew landing/frontend UI (HTML page) loads.
- **Failure:** Raw JSON (e.g. `{"name":"CallCrew Backend API",...}`) → domain is still on the backend or wrong service.

**curl**

```bash
# Must return 200 and content-type text/html
curl -sI https://www.callcrew.ai/

# Success: HTTP/1.1 200 … and content-type: text/html

# Body must be HTML, not JSON
curl -s https://www.callcrew.ai/ | head -5
# Success: <!DOCTYPE html> or <html ...
```

---

## 5) What is explicitly NOT changed

- **Backend:** No changes. Backend service and its config (`callcrew-backend/railway.json`, `server.js`, env) are unchanged.
- **Backend is not run** in the frontend service; the frontend service runs only `npx serve out -s`.
- **No combined service:** Root `railway.json` was removed; there is no single service that runs both frontend and backend.
- **No backend code or config:** Nothing in `callcrew-backend/` was modified.
- **Frontend app code:** No changes; only `callcrew-dashboard/railway.json` was updated (build + start commands).
- **Domain:** callcrew.ai is attached only to the frontend service, not to the backend.
