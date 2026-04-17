# Raspberry Pi: Build and Run Guide

This guide assumes you already have the main branch files cloned into `~/project-tabang` on your Raspberry Pi.

---

## Quick Setup (First Time Only)

### Step 0: Create `.env` file for Firebase configuration

The `.env` file is **not in git** (it's gitignored for security). You must manually create it on the Raspberry Pi before building.

Create `~/project-tabang/packages/frontend/.env`:

```bash
cat > ~/project-tabang/packages/frontend/.env <<'EOF'
VITE_FIREBASE_API_KEY=AIzaSyDaJO7gYNrw5t8h_qliXLlWbUA_V4yIRT0
VITE_FIREBASE_AUTH_DOMAIN=project-tabang---claude-code.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-tabang---claude-code
VITE_FIREBASE_STORAGE_BUCKET=project-tabang---claude-code.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=140297914184
VITE_FIREBASE_APP_ID=1:140297914184:web:292d48a65e4185c302d57d
VITE_USE_EMULATOR=true
EOF
```

⚠️ **Important**: `VITE_USE_EMULATOR=true` tells the app to connect to local emulators instead of production Firebase. This must be `true` for the Pi.

### Step 1: Install dependencies (if not done yet)

```bash
cd ~/project-tabang
npm install
```

---

## Build Process

### Step 1: Build Backend

```bash
cd ~/project-tabang
npm run build -w packages/backend
```

**Expected output:**
```
> packages/backend build
[build output...]
✓ Build successful
```

### Step 2: Build Frontend

```bash
npm run build -w packages/frontend
```

**Expected output:**
```
> packages/frontend build
[build output...]
✓ Built successfully
```

---

## Seeding Test Data (One Time Setup)

After starting the Firebase emulators for the first time, you need to seed test accounts and data.

**In a 4th terminal:**

```bash
cd ~/project-tabang
npm run seed
```

This creates 3 test accounts:
- **Admin**: Contact `09391234567` | Password `Password123`
- **Worker**: Contact `09281234567` | Password `Password123`
- **Resident**: Contact `09171234567` | Password `Password123`

> Run this once after starting the emulators. It only needs to be done once unless you delete the emulator data.

---

## Running the System (3 Terminals Required)

You need **3 separate terminal windows/sessions** running simultaneously.

### Terminal 1: Firebase Emulators

```bash
cd ~/project-tabang
npx firebase emulators:start --import=./emulator-data
```

**Expected output:**
```
⚠️  Emulator UI logging to ui-debug.log
i  Running emulator suite from /home/pi/project-tabang
i  Shutting down emulators.
i  Starting emulators...
✔  All emulators started successfully.
```

**Ports:**
- Firebase Auth: `9099`
- Firestore: `8080`
- Cloud Functions: `5001`
- Hosting: `5002`
- Emulator UI: `4001`

### Terminal 2: Fingerprint Service (Python)

```bash
cd ~/project-tabang/fingerprint-service
python3 app.py
```

**Expected output:**
```
[FINGERPRINT SERVICE] Starting on port 5000
[FINGERPRINT SERVICE] Sensor: /dev/ttyS0 @ 57600 baud
```

**Port:** `5000`

### Terminal 3: Frontend Server

```bash
cd ~/project-tabang
serve -s packages/frontend/dist -l 3000
```

**Expected output:**
```
   ┌────────────────────────────────────────┐
   │   Accepting connections at:            │
   │   http://localhost:3000                │
   └────────────────────────────────────────┘
```

**Port:** `3000`

---

## Full Startup Checklist

- [ ] Terminal 1 running: Firebase Emulators (port 9099, 8080, 5001, 5002, 4001)
- [ ] Terminal 2 running: Fingerprint Service (port 5000)
- [ ] Terminal 3 running: Frontend Server (port 3000)
- [ ] Terminal 4 (once): Run `npm run seed` to create test accounts
- [ ] All three services show "started successfully" or equivalent
- [ ] Access the app at `http://localhost:3000` on the Pi's Chromium browser
- [ ] Log in with admin account: `09391234567` / `Password123`

---

## Troubleshooting

### "Port 5001 already in use"
Firebase emulator is still running from before. Kill it:
```bash
pkill -f firebase
```

### "Address already in use" on port 5000
Kill the fingerprint service:
```bash
pkill -f "python.*app.py"
```

### "Permission denied" on fingerprint service
The UART device needs permissions. Run once:
```bash
sudo chmod 666 /dev/ttyS0
```

### Frontend shows blank screen
Check browser console (F12) for errors. Verify emulator is running on port 5001.

---

## After Making Code Changes

If you pull new changes from git:

```bash
cd ~/project-tabang
git pull origin main
npm run build -w packages/backend
npm run build -w packages/frontend
sudo systemctl restart tabang-emulators tabang-fingerprint tabang-frontend
```

Or manually restart the three terminals.

---

## Port Reference

| Service | Port | Terminal |
|---------|------|----------|
| Frontend | 3000 | Terminal 3 |
| Fingerprint Service | 5000 | Terminal 2 |
| Firebase Auth Emulator | 9099 | Terminal 1 |
| Firestore Emulator | 8080 | Terminal 1 |
| Cloud Functions Emulator | 5001 | Terminal 1 |
| Hosting Emulator | 5002 | Terminal 1 |
| Emulator UI | 4001 | Terminal 1 |

---

## Running as Services (Optional: Auto-start on Boot)

If you want the three services to start automatically on Raspberry Pi boot, see `RASPBERRY_PI_SETUP.md` for systemd service configuration.

To start services manually:
```bash
sudo systemctl start tabang-emulators
sudo systemctl start tabang-fingerprint
sudo systemctl start tabang-frontend
```

To check status:
```bash
sudo systemctl status tabang-emulators tabang-fingerprint tabang-frontend
```
