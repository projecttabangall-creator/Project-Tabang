/**
 * Rotate passwords for existing demo accounts in production Firebase.
 *
 * Use this when:
 *   - The old passwords were leaked / committed in git history.
 *   - You want to change the password without sending a "reset email"
 *     (which doesn't work for fake @tabang.local emails).
 *
 * Usage:
 *   1. Update scripts/.env.seed with the NEW passwords you want
 *      (SUPERADMIN_PASSWORD, ADMIN_PASSWORD, WORKER_PASSWORD, RESIDENT_PASSWORD).
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS to your service-account.json path
 *      (outside the repo recommended).
 *   3. Run: node scripts/rotate-passwords.js
 *
 * The script directly updates each account's password via the Firebase Admin
 * SDK. It does NOT touch Firestore data or roles — only the Auth password.
 *
 * SAFE TO RE-RUN: each call is idempotent. Accounts that don't exist are
 * skipped with a warning rather than failing the whole run.
 */

const path = require("path");
const fs = require("fs");

// Load new passwords from scripts/.env.seed
const envPath = path.resolve(__dirname, ".env.seed");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: scripts/.env.seed not found.");
  console.error(
    "Copy scripts/.env.seed.example to scripts/.env.seed and fill in the NEW passwords you want to set."
  );
  process.exit(1);
}

const envVars = fs
  .readFileSync(envPath, "utf8")
  .split("\n")
  .filter((line) => line.trim() && !line.startsWith("#"))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split("=");
    acc[key.trim()] = rest.join("=").trim();
    return acc;
  }, {});

const NEW_PASSWORDS = {
  "09001234567": envVars.SUPERADMIN_PASSWORD,
  "09391234567": envVars.ADMIN_PASSWORD,
  "09171234567": envVars.RESIDENT_PASSWORD,
  "09281234567": envVars.WORKER_PASSWORD,
};

const missing = Object.entries(NEW_PASSWORDS)
  .filter(([, pw]) => !pw)
  .map(([phone]) => phone);
if (missing.length) {
  console.error(
    `ERROR: missing passwords in scripts/.env.seed for: ${missing.join(", ")}`
  );
  console.error(
    "Required keys: SUPERADMIN_PASSWORD, ADMIN_PASSWORD, RESIDENT_PASSWORD, WORKER_PASSWORD"
  );
  process.exit(1);
}

// Service account key resolution (same as seed-production.js)
const envKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const legacyKeyPath = path.resolve(__dirname, "../service-account.json");
let keyPath;
if (envKeyPath && fs.existsSync(envKeyPath)) {
  keyPath = envKeyPath;
} else if (fs.existsSync(legacyKeyPath)) {
  keyPath = legacyKeyPath;
  console.warn(
    "WARNING: Using service-account.json from project root. Prefer setting"
  );
  console.warn(
    "  GOOGLE_APPLICATION_CREDENTIALS to a path OUTSIDE the repo."
  );
} else {
  console.error(
    "ERROR: service account key not found. Set GOOGLE_APPLICATION_CREDENTIALS or place service-account.json at the project root."
  );
  process.exit(1);
}

const admin = require("firebase-admin");
const serviceAccount = require(keyPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();

async function rotateOne(contactNumber, newPassword) {
  const email = `${contactNumber}@tabang.local`;
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    console.log(`  [ok]    ${contactNumber} (${user.uid}) password updated`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.warn(`  [skip]  ${contactNumber} — no Auth user exists`);
    } else {
      console.error(`  [error] ${contactNumber} —`, err.message);
    }
  }
}

(async () => {
  console.log("Rotating demo account passwords in production Firebase...");
  for (const [contactNumber, newPassword] of Object.entries(NEW_PASSWORDS)) {
    await rotateOne(contactNumber, newPassword);
  }
  console.log("Done.");
  process.exit(0);
})();
