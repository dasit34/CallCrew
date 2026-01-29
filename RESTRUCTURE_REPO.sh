#!/usr/bin/env bash
# Restructure git repo: CallCrewMVP as root, backend -> callcrew-backend/,
# add callcrew-dashboard, root package.json + railway.json + .gitignore.
# Preserves git history. Run from CallCrewMVP (parent of callcrew-backend).
# Usage: bash RESTRUCTURE_REPO.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo "→ Restructure from $REPO_ROOT"
echo "→ Back up .env if needed: cp callcrew-backend/.env /tmp/callcrew-backend.env.bak"
echo ""

# 1. Sanity checks
if [[ ! -d callcrew-backend/.git ]]; then
  echo "❌ callcrew-backend/.git not found. Is callcrew-backend the git root?"
  exit 1
fi
if [[ ! -d callcrew-dashboard ]]; then
  echo "❌ callcrew-dashboard not found."
  exit 1
fi

# 2. Move all tracked backend files into backend/ (keeps history)
echo "→ Moving backend files into backend/..."
cd callcrew-backend
mkdir -p backend
git mv config models routes scripts services webhooks backend/
git mv .gitignore env.template openaiModels.js package.json package-lock.json Procfile railway.json server.js backend/
git mv HARDENING_CHANGES.md IMPLEMENTATION_SUMMARY.md LATENCY_LOGGING.md backend/
cd "$REPO_ROOT"

# 3. Move .git to root
echo "→ Moving .git to root..."
mv callcrew-backend/.git .

# 4. Copy backend/ to root, then remove from callcrew-backend
echo "→ Moving backend/ to repo root..."
cp -R callcrew-backend/backend .
rm -rf callcrew-backend

# 5. git mv backend -> callcrew-backend
echo "→ Renaming backend -> callcrew-backend in git..."
git mv backend callcrew-backend

# 6. Root package.json
echo "→ Writing root package.json..."
cat > package.json << 'EOF'
{
  "name": "callcrew-mvp",
  "private": true,
  "scripts": {
    "build": "cd callcrew-backend && npm install && cd ../callcrew-dashboard && npm ci && npm run build",
    "start": "cd callcrew-backend && node server.js"
  }
}
EOF

# 7. Root railway.json
echo "→ Writing root railway.json..."
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
EOF

# 8. Root .gitignore
echo "→ Writing root .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
**/node_modules/

# Environment
.env
.env.*
!.env.example

# Build / output
dist/
build/
.next/
out/

# Logs & temp
logs/
*.log
tmp/
temp/
.DS_Store

# IDE
.idea/
.vscode/
*.swp
*.swo
EOF

# 9. Stage root files and dashboard
echo "→ Staging root files and callcrew-dashboard..."
git add package.json railway.json .gitignore
git add callcrew-dashboard/

echo ""
echo "✅ Restructure done. Verify: git status"
echo "   Commit: git commit -m 'Restructure: CallCrewMVP root, backend + dashboard'"
echo "   Restore .env: cp /tmp/callcrew-backend.env.bak callcrew-backend/.env (if you backed it up)"
