import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
// When running in Cloud Functions, this uses default credentials automatically
// When running locally with emulators, set FIREBASE_CONFIG or use the emulator
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const messaging = admin.messaging();

export default admin;
