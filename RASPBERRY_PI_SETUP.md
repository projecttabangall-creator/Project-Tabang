# Raspberry Pi 4 Deployment and Fingerprint Setup

This guide explains how to run Project Tabang locally on a Raspberry Pi 4 using Firebase emulators and an AS608 fingerprint scanner.

## Hardware Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| RAM | 2 GB minimum | 4 GB recommended |
| CPU | ARM64 compatible | Raspberry Pi 4 is supported |
| Storage | 64 GB+ microSD | Recommended for emulator data |
| Node.js | 22+ | Install with `nvm` |
| Java | JDK 11+ | Required for Firebase emulators |
| Python | 3.8+ | Used for fingerprint bridge |

## AS608 Wiring

Connect the AS608 over UART:

| AS608 Pin | Raspberry Pi Pin | GPIO |
|-----------|------------------|------|
| 3V3 | Pin 1 | 3.3V |
| GND | Pin 6 | Ground |
| TXD | Pin 10 | GPIO 15 / RXD |
| RXD | Pin 8 | GPIO 14 / TXD |
| WAK | Leave disconnected | Optional |

The default serial device is `/dev/ttyS0` at `57600` baud.

## Fingerprint Service Env

Create `fingerprint-service/.env`:

```bash
cat > fingerprint-service/.env <<'EOF'
FINGERPRINT_PORT=/dev/ttyS0
FINGERPRINT_BAUD=57600
API_BASE_URL=http://localhost:5001/<your-project-id>/us-central1/api
FLASK_PORT=5000
EOF
```

## Fingerprint Service Overview

The Raspberry Pi runs a local Python service that:

1. talks to the AS608 over UART
2. exposes HTTP endpoints on `http://localhost:5000`
3. updates the local backend API after enrollment or verification

Typical flow:

- Admin enrollment: frontend calls `POST /fingerprint/enroll`
- Worker verification: frontend calls `POST /fingerprint/verify`
- Backend API: local emulator functions receive worker biometric updates on port `5001`

## Install the Raspberry Pi Environment

### 1. Update the OS

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

### 2. Install system packages

```bash
sudo apt-get install -y default-jdk python3 python3-pip python3-venv curl git
```

### 3. Install Node.js 22

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node --version
```

Expected version: `v22.x.x`

### 4. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 5. Copy the project to the Pi

Option A:

```bash
git clone https://github.com/<your-org>/<your-repo>.git ~/project-tabang
cd ~/project-tabang
```

Option B:

```bash
scp -r /path/to/project-tabang pi@<raspberry-pi-ip>:~/project-tabang
```

### 6. Install dependencies and build

```bash
cd ~/project-tabang
npm install
npm run build
```

### 7. Install fingerprint service dependencies

```bash
cd ~/project-tabang/fingerprint-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 8. Enable UART

```bash
sudo raspi-config
```

Go to:

- `Interface Options`
- `Serial Port`
- disable login shell over serial
- enable serial port hardware

Then reboot.

## Run the System

Open three terminal sessions.

### Terminal 1: Firebase emulators

```bash
cd ~/project-tabang
npx firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

### Terminal 2: Fingerprint service

```bash
cd ~/project-tabang/fingerprint-service
source .venv/bin/activate
python3 app.py
```

### Terminal 3: Frontend

```bash
cd ~/project-tabang
npm install -g serve
serve -s packages/frontend/dist -l 3000
```

Open `http://localhost:3000` in Chromium.

## Port Reference

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Fingerprint service | 5000 |
| Functions emulator | 5001 |
| Hosting emulator | 5002 |
| Emulator UI | 4001 |
| Firestore emulator | 8080 |
| Auth emulator | 9099 |

## Optional Systemd Services

Example emulator service:

```ini
[Unit]
Description=Project Tabang Firebase Emulators
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/project-tabang
ExecStart=/home/pi/.nvm/versions/node/v22.0.0/bin/npx firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Example fingerprint service:

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

Example frontend service:

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

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Sensor not found | UART not enabled | Enable serial port hardware in `raspi-config` |
| `/dev/ttyS0` permission denied | Missing permissions | Add user to `dialout` or `chmod` the device |
| Emulator startup fails | Java missing | Install `default-jdk` |
| Frontend cannot reach backend | Wrong API URL | Check the functions emulator on `5001` |
| Fingerprint service unavailable | Python service not running | Start `app.py` and confirm port `5000` |
| Fingerprint template lost | In-memory storage only | Re-enroll or add persistent storage |

## References

- Firebase Emulator Suite docs
- PyFingerprint library
- Raspberry Pi UART configuration docs
- AS608 datasheet
