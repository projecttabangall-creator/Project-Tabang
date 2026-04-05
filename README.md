# Project Tabang

A community-driven, role-based worker/service booking platform for Barangay (Philippine local government unit). Connects residents needing services with verified skilled workers, managed by Barangay admin.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend:** Express.js on Firebase Cloud Functions
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication (Phone Auth emulator)
- **Maps:** Leaflet + OpenStreetMap
- **Monorepo:** npm workspaces (shared, backend, frontend)

## Getting Started

### Prerequisites

- Node.js 18+
- Java JDK 21+ (for Firebase emulators)
- Firebase CLI: `npm install -g firebase-tools`

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create `.env` file in project root (see `.env.example`)
   - Copy your Firebase Web App config values from Firebase Console

3. **Start emulators (Terminal 1):**
   ```bash
   npx firebase emulators:start
   ```

4. **Start frontend dev server (Terminal 2):**
   ```bash
   npm run dev:frontend
   ```

5. **Open in browser:**
   - http://localhost:3001

---

## Demo Accounts

Since the emulators auto-accept Firebase Auth registrations, you can create accounts on the fly. However, here are recommended test credentials:

### Resident Demo Account
- **Contact Number:** `09171234567`
- **Password:** `Password123`
- **Name:** Juan Dela Cruz
- **Role:** Resident (submits service requests, pays workers)

### Worker Demo Account
- **Contact Number:** `09281234567`
- **Password:** `Password123`
- **Name:** Maria Santos
- **Specialization:** Plumbing
- **Role:** Worker (receives auto-assigned jobs, completes work)
- **Note:** Must be registered by Admin first, then verified

### Admin Demo Account
- **Contact Number:** `09391234567`
- **Password:** `Password123`
- **Name:** Pedro Admin
- **Role:** Admin (manages categories, workers, payments, disputes)

### How to Create Demo Accounts

**Resident (self-register):**
1. Click **"Register"** on the login page
2. Enter the demo credentials above
3. You'll receive a 6-digit OTP in the console (check browser dev tools or terminal)
4. Enter the OTP on the verification page
5. Login with your contact number and password

**Worker (admin-only):**
1. Login as Admin first
2. Go to **Admin → Register Worker**
3. Fill in worker details (use demo credentials above)
4. Admin sets a temporary password
5. Go to **Admin → Workers → Verify** button to activate the worker
6. Worker can then login with their contact number

**Admin:**
1. Contact the system administrator to register an admin account
2. For development, you can manually create an admin user in Firestore:
   - Go to Firebase Console → Firestore
   - Create a document in `users/{uid}` with:
     ```json
     {
       "role": "admin",
       "firstName": "Pedro",
       "lastName": "Admin",
       "contactNumber": "09391234567",
       "isVerified": true,
       "isActive": true,
       "accountStatus": "active",
       "creditPoints": 5
     }
     ```

---

## Project Structure

```
project-tabang/
├── packages/
│   ├── shared/           # Types, constants, validation schemas
│   ├── backend/          # Express.js API (Firebase Cloud Functions)
│   └── frontend/         # React app (Vite)
├── firebase.json         # Firebase configuration
├── firestore.rules       # Firestore security rules
├── CLAUDE.md             # Architecture & conventions
└── README.md             # This file
```

---

## Landing Page

**Current Status:** No landing page yet (Phase 3+)

**Location:** Will be at `packages/frontend/src/pages/Landing.tsx` (to be created)

**Current Flow:**
- Users go directly to `/login`
- Role-based redirects handle navigation after login

**Future Landing Page Features (Phase 5+):**
- Hero section with project info
- Feature highlights (auto-assignment, dispute resolution, etc.)
- Call-to-action buttons (Register as Resident / Request Worker Registration)
- Responsive design for mobile/desktop
- Link to FAQ, T&Cs, Privacy Policy

To create a landing page now, you would:
1. Create `packages/frontend/src/pages/Landing.tsx`
2. Add it to the router in `App.tsx` at the root `/` path
3. Update `RoleRedirect()` to show landing page for unauthenticated users

---

## Available Commands

```bash
# Development
npm run dev:frontend              # Start frontend dev server
npm run dev:backend               # Start backend (requires emulators)
npx firebase emulators:start      # Start all Firebase emulators

# Building
npm run build                     # Build all packages
npm run build:frontend            # Build frontend for production
npm run build:backend             # Build backend

# Deployment
npm run deploy                    # Deploy to Firebase
```

---

## Key Features (Phase 1 & 2 Complete)

✅ **Authentication:** Registration, OTP verification, login with role-based routing
✅ **Admin Panel:** Dashboard with stats, category management, worker registration, user management
✅ **Data Entry:** Add service categories and items with minimum prices
✅ **Firestore:** Complete data model with security rules and indexes
✅ **Backend API:** Full REST API with middleware (auth, role guard, validation)

📋 **Upcoming (Phase 3-5):**
- Service request form with Leaflet map
- Auto-assignment algorithm
- Worker job acceptance/completion flow
- Payment proof upload & verification
- Dispute resolution system
- Real-time notifications (push, SMS, email)
- Offline mode (Raspberry Pi integration)

---

## Architecture & Conventions

See [CLAUDE.md](./CLAUDE.md) for:
- Database schema details
- API route reference
- Auto-assignment algorithm
- Business logic rules (pricing, credits, disputes)
- Development conventions

---

## Troubleshooting

**Firebase emulators not starting?**
- Ensure Java JDK 21+ is installed: `java -version`
- Check port availability (9099, 8080, 5001, 9199, 5000)

**Frontend won't load?**
- Ensure `.env` file exists in `packages/frontend/` with Firebase config
- Check that emulators are running on localhost
- Clear browser cache and refresh

**Auth not working?**
- Check browser console for Firebase errors
- Ensure Firebase emulators are running (`Auth` emulator on port 9099)
- Try creating a fresh account

---

## Contributing

This is a school/capstone project. Feel free to branch off and add features as needed!

---

## License

Project Tabang — Educational use only
