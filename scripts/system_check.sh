#!/usr/bin/env bash
# CallCrew System Check — production triage diagnostic script
# Run from repo root. Writes CALLCREW_DIAGNOSTICS.md. Does NOT print secrets.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
OUT="$REPO_ROOT/CALLCREW_DIAGNOSTICS.md"
BUILD_LOG_BACKEND="$REPO_ROOT/.system_check_backend_build.log"
BUILD_LOG_FRONTEND="$REPO_ROOT/.system_check_frontend_build.log"

# --- Helpers: never print env values ---
redact() {
  sed -E 's/([A-Za-z0-9_-]*[Kk]ey|[Tt]oken|[Ss]ecret|[Pp]assword|AUTH|SID)=[^[:space:]]+/\1=***REDACTED***/g' 2>/dev/null || cat
}

env_names_from_template() {
  local f="$1"
  [ -f "$f" ] && grep -E '^[A-Z][A-Z0-9_]*=' "$f" | cut -d= -f1 | sort -u
}

# --- 1) Repo overview ---
section_1() {
  echo "## 1) Repo overview"
  echo ""
  echo "- **Framework detection**:"
  [ -f "$REPO_ROOT/callcrew-dashboard/next.config.ts" ] && echo "  - Frontend: Next.js (next.config.ts present)"
  [ -f "$REPO_ROOT/callcrew-backend/server.js" ]       && echo "  - Backend: Node/Express (server.js)"
  echo "- **Folder structure summary**:"
  echo "  - \`callcrew-backend/\` — Express API, Twilio/OpenAI/MongoDB"
  echo "  - \`callcrew-dashboard/\` — Next.js app (App Router)"
  echo "- **Key entrypoints**:"
  echo "  - Backend: \`callcrew-backend/server.js\`"
  echo "  - Frontend: \`callcrew-dashboard/src/app/layout.tsx\`, \`page.tsx\`"
  echo ""
}

# --- 2) Environment expectations (names only) ---
section_2() {
  echo "## 2) Environment expectations (var NAMES only)"
  echo ""
  echo "**Backend** (from \`callcrew-backend/env.template\` + code):"
  {
    env_names_from_template "$REPO_ROOT/callcrew-backend/env.template"
    echo "CORS_ORIGIN"
    echo "ADMIN_KEY"
    echo "FOUNDER_EMAIL"
    echo "SEND_TO_FOUNDER"
    echo "EMAIL_FROM"
    echo "SMTP_HOST"
    echo "SMTP_PORT"
    echo "SMTP_USER"
    echo "SMTP_PASS"
    echo "WEBHOOK_BASE_URL"
  } | sort -u | sed 's/^/  - /'
  echo ""
  echo "**Frontend** (from code):"
  echo "  - NEXT_PUBLIC_API_BASE_URL"
  echo ""
}

# --- 3) Build sanity ---
section_3() {
  echo "## 3) Build sanity"
  echo ""

  # Root build (dashboard only)
  echo "### Root build (frontend)"
  echo "\`\`\`"
  echo "Command (from repo root): npm run build"
  echo "  → runs: npm --prefix callcrew-dashboard ci && npm --prefix callcrew-dashboard run build"
  echo "\`\`\`"
  if (cd "$REPO_ROOT" && npm run build > "$BUILD_LOG_FRONTEND" 2>&1); then
    echo "- **Result**: PASS"
    echo ""
  else
    echo "- **Result**: FAIL"
    echo "- **Log file**: \`$BUILD_LOG_FRONTEND\`"
    echo "- **Top error** (last 20 lines):"
    echo "\`\`\`"
    tail -20 "$BUILD_LOG_FRONTEND" | redact
    echo "\`\`\`"
    echo "- **Likely cause**: dependency/TypeScript/Next build error."
    echo ""
  fi

  # Backend has no build step (node server.js)
  echo "### Backend build"
  echo "\`\`\`"
  echo "Command: (none — backend is Node, no compile step)"
  echo "\`\`\`"
  echo "- **Result**: N/A"
  echo ""
}

# --- 4) Runtime sanity ---
section_4() {
  echo "## 4) Runtime sanity"
  echo ""
  echo "- **Start frontend locally**: \`cd callcrew-dashboard && npm run dev\` (dev server on port 3001) or \`./start-dev.sh\` from repo root"
  echo "- **Start backend locally**: \`cd callcrew-backend && npm run dev\` (port 3000) or \`node server.js\` with \`.env\` in \`callcrew-backend/\`"
  echo "- **Healthcheck endpoints**:"
  echo "  - Backend: \`GET /health\` → JSON \`{ status: 'healthy', ... }\`"
  echo ""
  BACKEND_HEALTH=""
  if command -v curl >/dev/null 2>&1; then
    BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3000/health 2>/dev/null || true)
  fi
  if [ "$BACKEND_HEALTH" = "200" ]; then
    echo "- **Backend health check (current host)**: GET http://localhost:3000/health → 200 OK"
  else
    echo "- **Backend health check (current host)**: not run or backend not reachable (curl localhost:3000/health)"
  fi
  echo ""
}

# --- 5) Deployment indicators ---
section_5() {
  echo "## 5) Deployment indicators"
  echo ""
  echo "| Config | Location | Notes |"
  echo "|--------|----------|-------|"
  [ -f "$REPO_ROOT/callcrew-backend/railway.json" ] && echo "| Railway | \`callcrew-backend/railway.json\` | builder: NIXPACKS, startCommand: \`node server.js\`, healthcheckPath: \`/health\` |"
  [ -f "$REPO_ROOT/callcrew-dashboard/railway.json" ] && echo "| Railway | \`callcrew-dashboard/railway.json\` | startCommand: \`npm start\` |"
  [ -f "$REPO_ROOT/callcrew-backend/Procfile" ] && echo "| Procfile | \`callcrew-backend/Procfile\` | \`web: node server.js\` |"
  echo ""
  echo "- **Backend (Railway/Nixpacks)**: Build command: (none or \`npm install\`). Output: N/A. Start: \`node server.js\`. Root must be \`callcrew-backend\` or start command must run from that directory."
  echo "- **Frontend (Railway)**: Build command: \`npm run build\`. Output dir: \`.next\` (Next.js). Start: \`npm start\` (runs \`next start -p \$PORT\`)."
  echo "- **Common misconfigs**:"
  echo "  1. **Domain shows JSON or API response**: Frontend not deployed or wrong service; user hit backend root (which returns JSON when \`callcrew-dashboard/out\` is missing)."
  echo "  2. **Blank site**: \`NEXT_PUBLIC_API_BASE_URL\` wrong or missing; CORS_ORIGIN on backend doesn’t match frontend origin; or frontend build failed."
  echo "  3. **Backend serves frontend only when \`callcrew-dashboard/out\` exists**: \`server.js\` expects a static export in \`out\`, but \`next.config.ts\` has no \`output: 'export'\` → no \`out\` dir → backend never serves UI, only API."
  echo ""
}

# --- 6) Minimal fix candidates ---
section_6() {
  echo "## 6) Minimal fix candidates (no code changes yet)"
  echo ""
  echo "| Rank | Likely cause | One command/log/screenshot to confirm |"
  echo "|------|----------------|----------------------------------------|"
  echo "| 1 | Backend deployed as main domain (so users get JSON) or frontend not deployed | Check which Railway (or other) service is attached to the main domain; confirm a separate frontend service runs \`npm start\` and is on that domain. |"
  echo "| 2 | Frontend build not producing \`out\` while backend expects it for serving UI | \`ls -la callcrew-dashboard/out\` after \`npm run build\` in dashboard; if missing, backend will never serve the app. |"
  echo "| 3 | CORS or \`NEXT_PUBLIC_API_BASE_URL\` wrong in prod | Browser Network tab: request to API from frontend origin; check response CORS headers and 4xx; check \`NEXT_PUBLIC_API_BASE_URL\` in build env. |"
  echo ""
}

# --- Main ---
main() {
  {
    echo "# CallCrew system check — diagnostic bundle"
    echo ""
    echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ""
    section_1
    section_2
    section_3
    section_4
    section_5
    section_6
    echo "---"
    echo "*(End of diagnostic bundle)*"
  } > "$OUT"

  # Cleanup temp logs if we want to keep them only on failure
  if [ -f "$BUILD_LOG_FRONTEND" ]; then
    echo "Frontend build log: $BUILD_LOG_FRONTEND"
  fi
  echo "Wrote: $OUT"
}

main "$@"
