# Project Tabang

## Quick Reference
- **Stack:** React 18 + Vite + TailwindCSS + shadcn/ui | Express.js + Firebase Cloud Functions | Firestore + Firebase Auth + Firebase Storage
- **Monorepo:** npm workspaces — packages/shared, packages/backend, packages/frontend
- **Node version:** 18+ (required by Firebase Cloud Functions)

## Commands
- `npm install` — install all workspace dependencies from root
- `npm run dev -w packages/frontend` — start frontend dev server
- `npm run build -w packages/backend` — build backend
- `npm run build -w packages/frontend` — build frontend for production
- `npm run deploy` — deploy to Firebase (Hosting + Functions)
- `npx firebase emulators:start` — start all Firebase emulators locally

## Project Structure
- `packages/shared/` — shared TypeScript types, Zod validation schemas, constants (roles, statuses)
- `packages/backend/` — Express.js API deployed as Firebase Cloud Functions
- `packages/frontend/` — React SPA deployed to Firebase Hosting

## Architecture Rules
- All business logic (pricing, assignment, credit points) goes through the Express API — never directly from the client
- Firestore security rules are the last line of defense, not the primary access control
- Denormalize frequently-read data (worker stats, request names) to avoid extra reads
- Use Firestore real-time listeners (onSnapshot) for status updates on the frontend
- Auto-assignment algorithm lives in `packages/backend/src/services/assignment.service.ts`

## Conventions
- TypeScript strict mode everywhere
- Zod schemas in shared package for API request/response validation
- shadcn/ui components in `packages/frontend/src/components/ui/`
- All API routes prefixed with `/api/`
- Firebase Auth ID token required in Authorization header for all protected routes
- Role-based access via roleGuard middleware: "resident", "worker", "admin"
- Timestamps use Firestore Timestamp, dates formatted with date-fns
- File uploads go to Firebase Storage under structured paths: `requests/{id}/photos/`, `payments/{id}/proof/`

## Three User Roles
1. **Resident** — self-registers, submits service requests, pays workers
2. **Worker** — registered by Admin only, receives auto-assigned jobs, completes work
3. **Admin** — full system control: worker verification, payment confirmation, disputes, config

## Key Business Logic
- Commission: always 10% on top of worker's price, paid by resident
- Credit points: 5 (max) to 1 (min). <= 2 = suspension. >= 3 required to receive jobs
- Auto-assignment: Frequency (50%) + Rating (35%) + Location/Haversine (15%)
- Cancellation after worker arrives: 20% penalty to resident
- Price cap: final price cannot exceed 2x suggested price without admin approval
