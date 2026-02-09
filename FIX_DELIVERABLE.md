# Fix deliverable: Frontend UI not served at domain (JSON at /)

**Symptom (one sentence):** The production domain returns JSON (backend API payload) at `/` instead of the frontend UI.

---

## 1) Root cause hypothesis

The backend (Express) is what’s bound to the production domain. It is written to serve the frontend only when the path `callcrew-dashboard/out` exists (static export). Next.js was not configured for static export, so `next build` only produced `.next` (Node server bundle), never `out`. So at runtime the backend finds no `out` and falls back to returning JSON at `/`. Enabling static export in Next.js makes the build emit `out`, so after a normal build the backend can serve the UI from that directory.

---

## 2) Confirmation steps (before fix)

Run from repo root:

```bash
# A) Domain returns JSON → backend is serving the domain
curl -s https://www.callcrew.ai/ | head -3

# B) No static export → backend has nothing to serve
npm run build
ls -la callcrew-dashboard/out
# Without the fix: "No such file or directory" (or empty).
```

---

## 3) Patch (smallest possible)

**File:** `callcrew-dashboard/next.config.ts`

**Change:** Add `output: "export"` so `next build` produces `callcrew-dashboard/out`.

```diff
 const nextConfig: NextConfig = {
+  output: "export",
   turbopack: {},
   ...
 };
```

(Already applied.)

---

## 4) Verification steps (exact commands + success)

Run from repo root:

```bash
# 1) Build must complete and produce out/
npm run build
# Success: build finishes without error.

# 2) Static export directory must exist with index.html
ls -la callcrew-dashboard/out
# Success: directory exists; contains index.html and e.g. _next/.

# 3) Backend serves HTML at / when out exists
cd callcrew-backend && node server.js
# In another terminal:
curl -sI http://localhost:3000/
# Success: HTTP/1.1 200, content-type contains text/html.

curl -s http://localhost:3000/ | head -5
# Success: output starts with <!DOCTYPE html> or <html (not {"name":"CallCrew Backend API"}).
```

After deploy (build at root, then start backend from repo root so it sees `callcrew-dashboard/out`):

```bash
curl -sI https://www.callcrew.ai/
# Success: 200 and content-type text/html (not JSON).
```

---

## 5) Risks / what was NOT changed

- **Risks:** Static export disables some Next.js features (e.g. server components that need a Node server, ISR, certain image optimizations). This app already expected a static export (backend serves `out`), so behavior is aligned.
- **Not changed:** No refactors, renames, or folder moves. No new features. No changes to backend code, env, or Railway config. No change to how the backend finds `out` (still `../callcrew-dashboard/out`). Deploy pipeline must still run `npm run build` from repo root and start the backend from a context where `callcrew-dashboard/out` exists (e.g. start command `cd callcrew-backend && node server.js` from repo root).
