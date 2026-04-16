# Raspberry Pi 4 Deployment & Fingerprint Scanner Setup

This document covers running **Project Tabang** fully locally on a Raspberry Pi 4 (4GB RAM) using Firebase emulators, with an AS608 fingerprint scanner for biometric enrollment and checkout verification.

## Hardware Requirements

| Component | Requirement | RPi 4 Status |
|-----------|-------------|-------------|
| **RAM** | 2GB minimum | ✅ 4GB available |
| **CPU** | ARM64 compatible | ✅ Broadcom BCM2711 (ARMv8) |
| **Storage** | 64GB+ microSD | ✅ Recommended |
| **Node.js** | 18.0+ | ✅ Available via nvm |
| **Java** | JDK 11+ (for Firestore emulator) | ✅ Install via apt |
| **Python** | 3.8+ | ✅ Pre-installed on Pi OS |

---

## Fingerprint Sensor: AS608 (GPIO/Serial)

### AS608 Wiring to Raspberry Pi 4

The AS608 connects via **UART (serial)** to the Raspberry Pi's GPIO header.

| AS608 Pin | RPi 4 Pin | GPIO | Wire Color |
|-----------|-----------|------|------------|
| **3V3** | **Pin 1** | 3.3V Power | RED |
| **GND** | **Pin 6** | Ground | BLACK |
| **TXD** | **Pin 10** | GPIO 15 (RXD) | GREEN |
| **RXD** | **Pin 8** | GPIO 14 (TXD) | YELLOW |
| **WAK** | — | Optional, leave unconnected | — |

**Serial Port:** The AS608 communicates on `/dev/ttyS0` at baud rate 57600.

> **More stable alternative:** Disable Bluetooth and use `/dev/ttyAMA0`:
> ```bash
> # Add to /boot/firmware/config.txt:
> dtoverlay=disable-bt
> # Then reboot
> ```

### Test the UART Connection

```bash
pip3 install pyserial
python3 -c "
import serial
ser = serial.Serial('/dev/ttyS0', 57600, timeout=1)
print('✓ UART connection successful')
ser.close()
"
```

---

## Deployment Architecture (Fully Local)

```
┌──────────────────────────────────────────────────────┐
│ Raspberry Pi 4                                       │
│                                                      │
│  ┌─────────────────────┐   ┌──────────────────────┐ │
│  │ Firebase Emulators  │   │ Fingerprint Service  │ │
│  │  Auth   → :9099     │   │  (Python Flask)      │ │
│  │  Firestore → :8080  │   │  localhost:5000       │ │
│  │  Functions → :5001  │   └──────────────────────┘ │
│  │  Hosting → :5002    │            ↑                │
│  │  UI → :4001         │     AS608 Sensor            │
│  └─────────────────────┘     (GPIO UART)             │
│             ↑                                        │
│  ┌──────────────────────┐                            │
│  │ Frontend (React)     │                            │
│  │  localhost:3000      │                            │
│  └──────────────────────┘                            │
└──────────────────────────────────────────────────────┘
```

**Three services run together:**
1. **Firebase Emulators** — handles auth, database, and backend API
2. **Fingerprint Service** — Python app bridging AS608 hardware to the web app
3. **Frontend** — React SPA served locally

---

## Fingerprint Integration Flows

### Flow 1: Admin Enrolls a Worker's Fingerprint

```
Admin clicks "Enroll Fingerprint" on WorkerRegistration page
  ↓ POST http://localhost:5000/fingerprint/enroll  { workerId }
Fingerprint Service prompts sensor — worker places finger twice
  ↓ AS608 captures 2 scans and stores template in memory
Fingerprint Service calls PATCH /api/workers/:id  { biometricEnrolled: true }
  ↓ Firestore updated
Frontend shows "Fingerprint enrolled ✓"
```

### Flow 2: Worker Verifies Fingerprint at Checkout

```
Worker clicks "Verify Fingerprint" on Checkout/Earnings page
  ↓ POST http://localhost:5000/fingerprint/verify  { workerId }
Fingerprint Service prompts sensor — worker places finger
  ↓ AS608 matches scan against stored template
Fingerprint Service returns { success: true/false }
  ↓ If success: checkout proceeds
  ↓ If fail: show error, block withdrawal
```

---

## Current Fingerprint State in the Codebase

- **Data model:** `WorkerData.biometricEnrolled: boolean` in `packages/shared/src/types/user.ts`
- **Admin UI:** Enrollment checkbox exists in `packages/frontend/src/pages/admin/WorkerRegistration.tsx`
  - *Needs to be replaced with a real "Enroll Fingerprint" button (see Phase 3 below)*
- **Backend:** Accepts `biometricEnrolled` field in `packages/backend/src/controllers/worker.controller.ts`

**Missing (to be built):**
- The Python fingerprint service (`fingerprint-service/`)
- Real enrollment button in frontend
- Fingerprint verification step in worker checkout

---

## Step-by-Step Implementation

### Phase 1: Create the Fingerprint Service

Create `fingerprint-service/` in the project root with these files:

**`fingerprint-service/requirements.txt`**
```
pyfingerprint==2.1.0
flask==3.0.3
flask-cors==4.0.1
requests==2.32.3
python-dotenv==1.0.1
pyserial==3.5
```

**`fingerprint-service/.env.example`**
```
FINGERPRINT_PORT=/dev/ttyS0
FINGERPRINT_BAUD=57600
API_BASE_URL=http://localhost:5001/project-tabang---claude-code/us-central1/api
FLASK_PORT=5000
```

**`fingerprint-service/app.py`**
```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from pyfingerprint.pyfingerprint import PyFingerprint
from dotenv import load_dotenv
import os
import requests as http_requests

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow frontend (localhost:3000) to call this service

FINGERPRINT_PORT = os.getenv("FINGERPRINT_PORT", "/dev/ttyS0")
FINGERPRINT_BAUD = int(os.getenv("FINGERPRINT_BAUD", "57600"))
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5001/project-tabang---claude-code/us-central1/api")

# Key: worker Firestore document ID, Value: fingerprint position index on sensor
enrolled_workers = {}

def get_sensor():
    try:
        fp = PyFingerprint(FINGERPRINT_PORT, FINGERPRINT_BAUD, 0xFFFFFFFF, 0x00000000)
        if not fp.verifyPassword():
            raise Exception("Invalid sensor password")
        return fp
    except Exception as e:
        raise Exception(f"Fingerprint sensor not available: {e}")


@app.route("/fingerprint/enroll", methods=["POST"])
def enroll():
    data = request.json
    worker_id = data.get("workerId")
    admin_token = data.get("adminToken")

    if not worker_id:
        return jsonify({"error": "workerId is required"}), 400

    try:
        fp = get_sensor()
    except Exception as e:
        return jsonify({"error": str(e)}), 503

    # Scan 1
    print(f"[ENROLL] Waiting for first scan (worker: {worker_id})...")
    while not fp.readImage():
        pass
    fp.convertImage(0x01)

    result = fp.searchTemplate()
    if result[0] >= 0:
        return jsonify({"error": "Fingerprint already enrolled"}), 409

    # Scan 2
    print("[ENROLL] Remove finger, then place same finger again...")
    while fp.readImage():
        pass
    while not fp.readImage():
        pass
    fp.convertImage(0x02)

    if fp.compareCharacteristics() == 0:
        return jsonify({"error": "Fingerprints did not match. Try again."}), 400

    fp.createTemplate()
    position = fp.storeTemplate()
    enrolled_workers[worker_id] = position
    print(f"[ENROLL] Stored at position {position} for worker {worker_id}")

    # Update backend
    try:
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        resp = http_requests.patch(
            f"{API_BASE_URL}/workers/{worker_id}",
            json={"biometricEnrolled": True},
            headers=headers,
            timeout=10
        )
        if resp.status_code != 200:
            print(f"[ENROLL] Warning: backend update returned {resp.status_code}")
    except Exception as e:
        print(f"[ENROLL] Warning: could not update backend — {e}")

    return jsonify({"success": True, "message": "Fingerprint enrolled successfully"}), 200


@app.route("/fingerprint/verify", methods=["POST"])
def verify():
    data = request.json
    worker_id = data.get("workerId")

    if not worker_id:
        return jsonify({"error": "workerId is required"}), 400

    if worker_id not in enrolled_workers:
        return jsonify({"success": False, "message": "No fingerprint enrolled for this worker"}), 200

    try:
        fp = get_sensor()
    except Exception as e:
        return jsonify({"error": str(e)}), 503

    print(f"[VERIFY] Waiting for scan (worker: {worker_id})...")
    while not fp.readImage():
        pass
    fp.convertImage(0x01)

    result = fp.searchTemplate()
    position = result[0]
    accuracy = result[1]

    if position == enrolled_workers[worker_id]:
        print(f"[VERIFY] Match! Worker {worker_id}, accuracy {accuracy}")
        return jsonify({"success": True, "workerId": worker_id}), 200

    print(f"[VERIFY] No match for worker {worker_id}")
    return jsonify({"success": False, "message": "Fingerprint not recognized"}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"[FINGERPRINT SERVICE] Starting on port {port}")
    print(f"[FINGERPRINT SERVICE] Sensor: {FINGERPRINT_PORT} @ {FINGERPRINT_BAUD} baud")
    app.run(host="0.0.0.0", port=port, debug=False)
```

---

### Phase 2: Backend Changes

**`packages/backend/src/routes/worker.routes.ts`** — Add this route:
```ts
router.post('/:id/verify-fingerprint', roleGuard(['worker', 'admin']), workerController.logFingerprintVerification);
```

**`packages/backend/src/controllers/worker.controller.ts`** — Add the handler:
```ts
export const logFingerprintVerification = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verified } = req.body;

  await db.collection('workers').doc(id).update({
    lastFingerprintVerification: { verified, timestamp: Timestamp.now() }
  });

  res.json({ success: true });
};
```

---

### Phase 3: Frontend Changes

**`packages/frontend/src/pages/admin/WorkerRegistration.tsx`** — Replace the checkbox with a button:

```tsx
const [fpStatus, setFpStatus] = useState<'idle' | 'enrolling' | 'done' | 'error'>('idle');

const handleEnrollFingerprint = async () => {
  setFpStatus('enrolling');
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('http://localhost:5000/fingerprint/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: worker.uid, adminToken: token }),
    });
    const result = await res.json();
    if (result.success) {
      setFpStatus('done');
      setValue('biometricEnrolled', true);
      toast.success('Fingerprint enrolled successfully');
    } else {
      setFpStatus('error');
      toast.error(result.error || 'Enrollment failed');
    }
  } catch {
    setFpStatus('error');
    toast.error('Fingerprint service unavailable. Is it running on port 5000?');
  }
};
```

**`packages/frontend/src/pages/worker/Checkout.tsx`** (or wherever workers withdraw earnings) — Add verification step:

```tsx
const [fpVerified, setFpVerified] = useState(false);
const [verifying, setVerifying] = useState(false);

const handleVerifyFingerprint = async () => {
  setVerifying(true);
  try {
    const res = await fetch('http://localhost:5000/fingerprint/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: currentUser.uid }),
    });
    const result = await res.json();
    if (result.success) {
      setFpVerified(true);
      toast.success('Identity verified');
    } else {
      toast.error(result.message || 'Fingerprint not recognized');
    }
  } catch {
    toast.error('Fingerprint service unavailable');
  } finally {
    setVerifying(false);
  }
};

// In the JSX — block the checkout button until verified:
<Button onClick={handleVerifyFingerprint} disabled={verifying || fpVerified}>
  {fpVerified ? '✓ Identity Verified' : verifying ? 'Scanning...' : 'Verify Fingerprint'}
</Button>

<Button onClick={handleCheckout} disabled={!fpVerified}>
  Withdraw Earnings
</Button>
```

---

## Setup Instructions (Raspberry Pi)

### Step 1: Install Raspberry Pi OS (64-bit)

1. Download **Raspberry Pi Imager** from https://www.raspberrypi.com/software/
2. Write **Raspberry Pi OS Lite (64-bit)** or Desktop to microSD
3. Boot and complete initial setup (Wi-Fi, password, timezone)

### Step 2: Install Dependencies

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Java (required for Firestore emulator)
sudo apt-get install -y default-jdk

# Verify
java -version
python3 --version
pip3 --version
```

### Step 3: Install Node.js 18+

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm use 18
node --version   # Should be v18.x.x
```

### Step 4: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 5: Transfer the Project

**Option A — Git clone (recommended):**
```bash
git clone <your-repo-url> ~/project-tabang
cd ~/project-tabang
```

**Option B — Copy from laptop via SCP:**
```bash
# Run from your laptop:
scp -r /path/to/project-tabang pi@<raspberry-pi-ip>:~/project-tabang
```

### Step 6: Install Node Dependencies & Build

```bash
cd ~/project-tabang
npm install
npm run build
```

> **Tip:** The frontend build takes ~2–3 min on RPi. If you want to save time, build on your laptop and copy just `packages/frontend/dist/` to the RPi.

### Step 7: Set Up Fingerprint Service

```bash
cd ~/project-tabang/fingerprint-service
cp .env.example .env     # Edit FINGERPRINT_PORT if needed
pip3 install -r requirements.txt
```

Test sensor connection:
```bash
python3 -c "
import serial
ser = serial.Serial('/dev/ttyS0', 57600, timeout=1)
print('✓ Sensor connection successful')
ser.close()
"
```

### Step 8: Enable UART on Raspberry Pi

```bash
# Open raspi-config
sudo raspi-config

# Navigate to:
# Interface Options → Serial Port
# "Would you like a login shell over serial?" → No
# "Would you like the serial port hardware to be enabled?" → Yes
# Finish and reboot
```

---

## Running the System

Open 3 terminal windows (or use `tmux`).

**Terminal 1 — Firebase Emulators:**
```bash
cd ~/project-tabang
npx firebase emulators:start \
  --import=./emulator-data \
  --export-on-exit=./emulator-data
```

| Emulator | Port |
|----------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions (API) | 5001 |
| Hosting | 5002 |
| Emulator UI | 4001 |

**Terminal 2 — Fingerprint Service:**
```bash
cd ~/project-tabang/fingerprint-service
python3 app.py
```
Runs on `localhost:5000`

**Terminal 3 — Frontend:**
```bash
# Option A: Use Firebase Hosting emulator (already served on :5002)
# Just open http://localhost:5002

# Option B: Serve built dist on port 3000
npm install -g serve
serve -s packages/frontend/dist -l 3000
```

Open browser to `http://localhost:3000` (or `5002`).

---

## Auto-Start on Boot (Systemd)

### Firebase Emulators (`/etc/systemd/system/tabang-emulators.service`)

```ini
[Unit]
Description=Project Tabang Firebase Emulators
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/project-tabang
ExecStart=/home/pi/.nvm/versions/node/v18.20.0/bin/npx firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Fingerprint Service (`/etc/systemd/system/tabang-fingerprint.service`)

```ini
[Unit]
Description=Project Tabang Fingerprint Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/project-tabang/fingerprint-service
ExecStart=/usr/bin/python3 app.py
Restart=on-failure
RestartSec=10
EnvironmentFile=/home/pi/project-tabang/fingerprint-service/.env

[Install]
WantedBy=multi-user.target
```

### Frontend (`/etc/systemd/system/tabang-frontend.service`)

```ini
[Unit]
Description=Project Tabang Frontend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/project-tabang
ExecStart=/usr/local/bin/serve -s packages/frontend/dist -l 3000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable all services:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable tabang-emulators tabang-fingerprint tabang-frontend
sudo systemctl start tabang-emulators tabang-fingerprint tabang-frontend

# Check status
sudo systemctl status tabang-emulators
sudo systemctl status tabang-fingerprint
```

### Optional: Open Chromium in kiosk mode on boot

Add to `/etc/xdg/autostart/tabang-kiosk.desktop`:
```ini
[Desktop Entry]
Type=Application
Name=Tabang Kiosk
Exec=chromium-browser --kiosk --no-first-run http://localhost:3000
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| **Sensor not found** | UART not enabled | Run `sudo raspi-config` → enable Serial Port hardware |
| **`/dev/ttyS0` permission denied** | User not in dialout group | `sudo usermod -aG dialout pi` then reboot |
| **Firestore emulator fails to start** | Java not installed | `sudo apt-get install default-jdk` |
| **Frontend can't reach Functions** | Wrong API URL | Verify Functions emulator is on port 5001, not 5000 |
| **Fingerprint service CORS error** | Flask CORS not configured | Ensure `flask-cors` is installed and `CORS(app)` is called |
| **Template lost after restart** | In-memory storage | Fingerprint service resets on each run — re-enroll or add disk persistence |
| **`npm install` very slow** | RPi CPU limit | Pre-install on laptop, or run `npm ci` (faster than install) |
| **Build out of memory** | Node heap limit | `NODE_OPTIONS=--max-old-space-size=512 npm run build` |

---

## Performance Notes

| Task | Time on RPi 4 | Notes |
|------|---------------|-------|
| `npm install` | ~3–5 min | Do on laptop if possible |
| `npm run build` | ~2–3 min | Occasional — build on laptop and SCP dist/ |
| Emulator startup | ~20–30 sec | First launch; faster on subsequent runs |
| Fingerprint capture | ~3–8 sec | Two scans for enrollment, one for verify |
| API response time | <200ms | Node.js single process handles it fine |

---

## Port Reference

| Service | Port | Notes |
|---------|------|-------|
| Firebase Auth Emulator | 9099 | |
| Firestore Emulator | 8080 | |
| Functions Emulator (API) | 5001 | API base: `localhost:5001/{projectId}/us-central1/api` |
| Firebase Hosting Emulator | 5002 | Serves built `dist/` |
| Emulator UI Dashboard | 4001 | View data, logs |
| Fingerprint Service | 5000 | Python Flask (AS608 bridge) |
| Frontend Dev Server | 5173 | Vite dev — auto-proxies `/api` to 5001 |
| Frontend Served | 3000 | Via `serve` (production build) |

---

## Next Steps

1. **Wire AS608** to RPi GPIO pins (see wiring table above)
2. **Test UART** connection before running the app
3. **Clone project** to RPi and run `npm install`
4. **Start all 3 services** and verify they're reachable
5. **Test enrollment** — Admin page → "Enroll Fingerprint"
6. **Test checkout verification** — Worker page → "Verify Fingerprint" before withdrawal
7. **Add systemd services** for auto-start when RPi powers on

---

## References

- [Firebase Emulator Suite Docs](https://firebase.google.com/docs/emulator-suite)
- [PyFingerprint Library](https://github.com/bastianraschke/pyfingerprint)
- [Raspberry Pi UART Configuration](https://www.raspberrypi.com/documentation/computers/configuration.html#configure-uarts)
- [AS608 Datasheet](https://cdn.sparkfun.com/datasheets/Sensors/Biometric/ZFM%20user%20manualV15.pdf)
