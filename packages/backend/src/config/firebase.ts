import * as admin from "firebase-admin";

const LOCAL_PROJECT_ID = "project-tabang---claude-code";
const LOCAL_STORAGE_BUCKET = "project-tabang---claude-code.firebasestorage.app";

function getProjectIdFromFirebaseConfig(): string | undefined {
  const rawConfig = process.env.FIREBASE_CONFIG;
  if (!rawConfig) {
    return undefined;
  }

  try {
    const parsed =
      rawConfig.trim().startsWith("{")
        ? JSON.parse(rawConfig)
        : JSON.parse(rawConfig);

    return parsed.projectId || parsed.project_id;
  } catch {
    return undefined;
  }
}

function resolveProjectId(): string | undefined {
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.PROJECT_ID ||
    getProjectIdFromFirebaseConfig() ||
    (process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
      ? LOCAL_PROJECT_ID
      : undefined)
  );
}

function getStorageBucketFromFirebaseConfig(): string | undefined {
  const rawConfig = process.env.FIREBASE_CONFIG;
  if (!rawConfig) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawConfig);
    return parsed.storageBucket || parsed.storage_bucket;
  } catch {
    return undefined;
  }
}

function resolveStorageBucket(): string | undefined {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.STORAGE_BUCKET ||
    getStorageBucketFromFirebaseConfig() ||
    (process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
      ? LOCAL_STORAGE_BUCKET
      : undefined)
  );
}

// Initialize Firebase Admin SDK.
// In deployed Firebase environments, the platform provides project config.
// In local emulator runs, we explicitly fall back to the repo's local project id
// so Firestore/Auth calls do not fail when the emulator shell omits GCLOUD_PROJECT.
if (!admin.apps.length) {
  const projectId = resolveProjectId();
  const storageBucket = resolveStorageBucket();
  admin.initializeApp(
    projectId || storageBucket
      ? {
          ...(projectId ? { projectId } : {}),
          ...(storageBucket ? { storageBucket } : {}),
        }
      : undefined
  );
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const messaging = admin.messaging();

export default admin;
