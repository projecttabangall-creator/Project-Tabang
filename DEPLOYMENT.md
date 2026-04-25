# Deployment Guide

This guide covers deploying Project Tabang to **Firebase** (production) and to a **Raspberry Pi** (local/offline). Choose the path that matches your environment.

---

## Prerequisites (Both Paths)

- Node.js 22 or higher
- Firebase CLI: `npm install -g firebase-tools`
- Git repository cloned locally

---

## Path 1: Deploy to Firebase (Production)

This publishes the frontend to Firebase Hosting and the backend as a Cloud Function. The app will be live on the internet using real Firebase Auth, Firestore, and Storage.

### Step 1: Log in to Firebase

```bash
firebase login
```

Sign in with the Google account that owns your Firebase project.

### Step 2: Set the Firebase project

```bash
firebase use <your-firebase-project-id>
```

If prompted to add the project, choose **Add** and select it from the list.

### Step 3: Set up the frontend `.env` file

Create `packages/frontend/.env` with your production Firebase web app config:

```bash
cat > packages/frontend/.env <<'EOF'
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_USE_EMULATOR=false
EOF
```

> `VITE_USE_EMULATOR=false` — the app connects to real Firebase, not local emulators.

### Step 4: Install dependencies

```bash
cd ~/project-tabang   # or wherever you cloned it
npm install
```

### Step 5: Deploy everything

```bash
npm run deploy
```

This single command:
1. Builds `packages/shared`
2. Builds `packages/backend` (TypeScript → JavaScript)
3. Builds `packages/frontend` (Vite production build)
4. Deploys Cloud Functions + Hosting + Firestore rules + Storage rules

**Expected output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/<your-firebase-project-id>
Hosting URL: https://<your-firebase-hosting-site>.web.app
```

### Step 6: Deploy Firestore indexes (first time only)

```bash
firebase deploy --only firestore:indexes
```

This creates the composite indexes needed for queries (e.g. status + createdAt sorting). Only needed once — or after changes to `firestore.indexes.json`.

---

### Deploy Individual Parts

If you only changed one layer, you can deploy just that part:

| What changed | Command |
|---|---|
| Backend only (Cloud Functions) | `npm run build:shared && npm run build:backend && firebase deploy --only functions` |
| Frontend only (Hosting) | `npm run build:frontend && firebase deploy --only hosting` |
| Firestore rules only | `firebase deploy --only firestore:rules` |
| Storage rules only | `firebase deploy --only storage` |
| Firestore indexes only | `firebase deploy --only firestore:indexes` |

---

## Path 2: Deploy to Raspberry Pi (Local / Offline)

The Pi runs Firebase **emulators** locally — no internet required after setup. The fingerprint sensor connects via a Python service.

See [RASPI_BUILD_AND_RUN.md](RASPI_BUILD_AND_RUN.md) for the full Pi setup guide.

The short version after pulling changes:

```bash
cd ~/project-tabang
git pull origin main
npm install
npm run build -w packages/backend
npm run build -w packages/frontend
```

Then restart the three services (emulators, fingerprint service, frontend server) — see the Pi guide for details.

---

## After Deploying

### First-time production setup

The first time you deploy to a fresh Firebase project, you may need to:

1. **Enable Firebase Auth** — go to the Firebase Console → Authentication → Sign-in method → enable Phone
2. **Set Firestore rules** — already deployed by `firebase deploy`
3. **Create the first admin user** — use the Firebase Console or seed script (emulator only)

### Verify the deployment

1. Open the Hosting URL (e.g. `https://<your-firebase-hosting-site>.web.app`)
2. Log in with an admin account
3. Check the Admin Dashboard loads correctly
4. Create a test service request to verify Firestore writes work
5. Check Firebase Console → Functions → Logs for any errors

---

## Rollback

To roll back to the previous deployment:

```bash
# List recent hosting releases
firebase hosting:releases:list

# Roll back hosting to the previous release
firebase hosting:rollback
```

For functions, redeploy from the previous git commit:

```bash
git checkout <previous-commit-hash>
npm run build:shared && npm run build:backend
firebase deploy --only functions
```

---

## Port Reference (Emulators / Pi only)

| Service | Port |
|---|---|
| Frontend | 3000 |
| Fingerprint Service (Python) | 5000 |
| Cloud Functions Emulator | 5001 |
| Firebase Hosting Emulator | 5002 |
| Firestore Emulator | 8080 |
| Firebase Auth Emulator | 9099 |
| Emulator UI | 4001 |
