# Port Configuration Fix

## ✅ ISSUE IDENTIFIED

**Problem:** Port conflict between frontend and backend
- Backend was defaulting to port **3001**
- Frontend (Next.js) defaults to port **3000**
- Both trying to use the same port causes conflicts

## ✅ SOLUTION

**Standard Setup:**
- **Backend:** `localhost:3000` (API server)
- **Frontend:** `localhost:3001` (Next.js dev server)
- **Frontend API URLs:** Point to `localhost:3000` (backend)

---

## 📋 CHANGES MADE

### 1. Backend Port Configuration
**File:** `callcrew-backend/server.js`
```diff
- const PORT = process.env.PORT || 3001;
+ const PORT = process.env.PORT || 3000;
```

### 2. Frontend Port Configuration
**File:** `callcrew-dashboard/package.json`
```diff
  "scripts": {
-   "dev": "next dev",
+   "dev": "next dev -p 3001",
    "build": "next build",
-   "start": "next start",
+   "start": "next start -p 3001",
    "lint": "eslint"
  },
```

### 3. Frontend API URLs (Already Correct)
**Files:** 
- `src/lib/api.ts` ✅ Points to `localhost:3000`
- `src/components/onboarding/steps.tsx` ✅ Points to `localhost:3000`
- `src/app/dashboard/[id]/page.tsx` ✅ Points to `localhost:3000`

---

## 🚀 HOW TO START

### Start Backend (Terminal 1):
```bash
cd callcrew-backend
npm run dev
```
**Runs on:** `http://localhost:3000`

### Start Frontend (Terminal 2):
```bash
cd callcrew-dashboard
npm run dev
```
**Runs on:** `http://localhost:3001`

---

## ✅ VERIFICATION

### 1. Check Backend is Running:
```bash
curl http://localhost:3000/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "environment": "development"
}
```

### 2. Check Frontend is Running:
- Open browser: `http://localhost:3001`
- Should see the CallCrew landing page

### 3. Check API Connection:
- Open browser DevTools → Network tab
- Navigate to `/onboarding` or `/dashboard`
- API calls should go to `http://localhost:3000/api/...`
- Should see successful responses (200 status)

---

## 📝 PORT SUMMARY

| Service | Port | URL | Command |
|---------|------|-----|---------|
| **Backend** | 3000 | `http://localhost:3000` | `cd callcrew-backend && npm run dev` |
| **Frontend** | 3001 | `http://localhost:3001` | `cd callcrew-dashboard && npm run dev` |

---

## 🔧 ENVIRONMENT VARIABLES

### Backend (`callcrew-backend/.env`):
```env
PORT=3000  # Optional - defaults to 3000 now
```

### Frontend (`callcrew-dashboard/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3000  # Optional - auto-detects localhost
```

**Note:** If `NEXT_PUBLIC_API_URL` is not set, the frontend automatically uses:
- `http://localhost:3000` when running on localhost
- Railway production URL when deployed

---

## ✅ STATUS

- ✅ Backend configured for port 3000
- ✅ Frontend configured for port 3001
- ✅ Frontend API URLs point to backend (3000)
- ✅ No port conflicts
- ✅ Ready to run!
