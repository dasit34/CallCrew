# Restructure Repo: CallCrewMVP Root (Backend + Dashboard)

Run these in a **terminal on your machine** (not in Cursor sandbox).  
**Prereqs:** You’re in `CallCrewMVP`; `callcrew-backend` (current git root) and `callcrew-dashboard` exist as siblings.

---

## 1. Back up `.env`

```bash
cp callcrew-backend/.env /tmp/callcrew-backend.env.bak
```

---

## 2. Move tracked backend files into `backend/` (keeps history)

```bash
cd callcrew-backend
mkdir -p backend
git mv config models routes scripts services webhooks backend/
git mv .gitignore env.template openaiModels.js package.json package-lock.json Procfile railway.json server.js backend/
git mv HARDENING_CHANGES.md IMPLEMENTATION_SUMMARY.md LATENCY_LOGGING.md backend/
cd ..
```

---

## 3. Move `.git` to repo root

```bash
mv callcrew-backend/.git .
```

---

## 4. Move `backend/` to repo root and remove old `callcrew-backend`

```bash
cp -R callcrew-backend/backend .
rm -rf callcrew-backend
```

---

## 5. Rename `backend` → `callcrew-backend` in git

```bash
git mv backend callcrew-backend
```

---

## 6. Root `package.json`

```bash
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
```

---

## 7. Root `railway.json`

```bash
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
```

---

## 8. Root `.gitignore`

```bash
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
```

---

## 9. Stage root files and dashboard

```bash
git add package.json railway.json .gitignore
git add callcrew-dashboard/
```

---

## 10. Verify and commit

```bash
git status
git commit -m "Restructure: CallCrewMVP root, backend + dashboard"
```

---

## 11. Restore `.env`

```bash
cp /tmp/callcrew-backend.env.bak callcrew-backend/.env
```

---

## 12. Reinstall backend deps (optional)

```bash
cd callcrew-backend && npm install && cd ..
```

---

## Resulting layout

```
CallCrewMVP/           # git root
├── .git/
├── package.json       # build + start
├── railway.json
├── .gitignore
├── callcrew-backend/
│   ├── server.js
│   ├── package.json
│   └── ...
└── callcrew-dashboard/
    ├── next.config.ts
    ├── package.json
    └── ...
```

**Railway:** Use `CallCrewMVP` as root; build `npm run build`, start `npm start`.
