/**
 * Production seed script for Firebase.
 *
 * Usage:
 *   1. Download a service account key from Firebase Console.
 *   2. Save it outside the project directory and set:
 *        GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *   3. Copy scripts/.env.seed.example to scripts/.env.seed and fill in passwords.
 *   4. Run: node scripts/seed-production.js
 *
 * WARNING:
 * - This runs against production Firebase.
 * - Never commit scripts/.env.seed.
 * - Never keep service-account.json inside the repo unless you understand the risk.
 */

const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const envPath = path.resolve(__dirname, ".env.seed");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: scripts/.env.seed not found.");
  console.error("Copy scripts/.env.seed.example to scripts/.env.seed and fill in the passwords.");
  process.exit(1);
}

const envVars = fs.readFileSync(envPath, "utf8")
  .split("\n")
  .filter((line) => line.trim() && !line.startsWith("#"))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split("=");
    acc[key.trim()] = rest.join("=").trim();
    return acc;
  }, {});

const SUPERADMIN_PASSWORD = envVars.SUPERADMIN_PASSWORD;
const ADMIN_PASSWORD = envVars.ADMIN_PASSWORD;
const WORKER_PASSWORD = envVars.WORKER_PASSWORD;
const RESIDENT_PASSWORD = envVars.RESIDENT_PASSWORD;

if (!SUPERADMIN_PASSWORD || !ADMIN_PASSWORD || !WORKER_PASSWORD || !RESIDENT_PASSWORD) {
  console.error("ERROR: Missing one or more required passwords in scripts/.env.seed.");
  console.error("Required keys: SUPERADMIN_PASSWORD, ADMIN_PASSWORD, WORKER_PASSWORD, RESIDENT_PASSWORD");
  process.exit(1);
}

const envKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const legacyKeyPath = path.resolve(__dirname, "../service-account.json");

let keyPath;
if (envKeyPath && fs.existsSync(envKeyPath)) {
  keyPath = envKeyPath;
} else if (fs.existsSync(legacyKeyPath)) {
  keyPath = legacyKeyPath;
  console.warn("WARNING: Using service-account.json from the project root.");
  console.warn("Prefer GOOGLE_APPLICATION_CREDENTIALS pointing to a file outside the repo.");
} else {
  console.error("ERROR: service account key not found.");
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your key path.");
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

const PROJECT_ID = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "your-firebase-project-id";
const HOSTING_URL = process.env.FIREBASE_HOSTING_URL || "https://<your-firebase-hosting-site>.web.app/login";

const DEMO_ACCOUNTS = [
  {
    contactNumber: "09000000001",
    password: SUPERADMIN_PASSWORD,
    firstName: "Sample",
    lastName: "SuperAdmin",
    role: "superadmin",
    email: "superadmin@example.com",
    address: {
      street: "Admin Center",
      houseLot: "1",
      blockNo: "1",
      barangay: "Sample Barangay",
    },
  },
  {
    contactNumber: "09000000002",
    password: ADMIN_PASSWORD,
    firstName: "Sample",
    lastName: "Admin",
    role: "admin",
    address: {
      street: "Main Road",
      houseLot: "2",
      blockNo: "1",
      barangay: "Sample Barangay",
    },
  },
  {
    contactNumber: "09000000003",
    password: RESIDENT_PASSWORD,
    firstName: "Sample",
    lastName: "Resident",
    role: "resident",
    address: {
      street: "Neighborhood Street",
      houseLot: "12",
      blockNo: "3",
      barangay: "Sample Barangay",
    },
  },
  {
    contactNumber: "09000000004",
    password: WORKER_PASSWORD,
    firstName: "Sample",
    lastName: "Worker",
    role: "worker",
    address: {
      street: "Service Street",
      houseLot: "5",
      blockNo: "1",
      barangay: "Sample Barangay",
    },
    workerData: {
      specialization: "Plumbing",
      credentials: [],
      biometricEnrolled: false,
      averageRating: 4.5,
      completedJobsCount: 0,
      totalJobsAssigned: 0,
      acceptanceRate: 1.0,
      cancellationRate: 0,
      reportsCount: 0,
      lastAssignedAt: new Date(),
      location: { latitude: 10.3456, longitude: 123.9132 },
      availability: [
        { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 4, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 5, startTime: "08:00", endTime: "17:00" },
      ],
      isAvailable: true,
    },
  },
];

async function createAccount(account) {
  const email = `${account.contactNumber}@tabang.local`;

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password: account.password,
      displayName: `${account.firstName} ${account.lastName}`,
    });
    console.log(`  Created Auth user for ${account.contactNumber}`);
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      console.log(`  [skip] Auth user already exists for ${account.contactNumber}`);
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: account.role });

  const existingDoc = await db.collection("users").doc(userRecord.uid).get();
  if (existingDoc.exists) {
    console.log(`  [skip] Firestore doc already exists for ${account.contactNumber}`);
    return userRecord.uid;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const userData = {
    uid: userRecord.uid,
    role: account.role,
    firstName: account.firstName,
    lastName: account.lastName,
    middleInitial: "",
    contactNumber: account.contactNumber,
    email: account.email || "",
    address: account.address,
    creditPoints: 5,
    isVerified: true,
    isActive: true,
    accountStatus: "active",
    otpVerified: true,
    failedLoginAttempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (account.workerData) {
    userData.workerData = account.workerData;
  }

  await db.collection("users").doc(userRecord.uid).set(userData);
  return userRecord.uid;
}

async function seedCategories() {
  const categories = [
    { name: "Carpentry", description: "Woodwork, furniture repair, and installation" },
    { name: "Plumbing", description: "Pipe repair, installation, and maintenance" },
    { name: "Electrician", description: "Electrical wiring, repair, and installation" },
    { name: "Masonry", description: "Brickwork, concrete, and stonework" },
    { name: "Appliance Repair", description: "Repair and maintenance of home appliances" },
  ];

  const existing = await db.collection("categories").limit(1).get();
  if (!existing.empty) {
    console.log("  [skip] Categories already exist");
    return;
  }

  for (const cat of categories) {
    await db.collection("categories").add({
      ...cat,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`  Created ${categories.length} service categories`);
}

async function main() {
  console.log("Seeding PRODUCTION Firebase...\n");
  console.log(`Project: ${PROJECT_ID}\n`);

  for (const account of DEMO_ACCOUNTS) {
    console.log(`[${account.role.toUpperCase()}] ${account.firstName} ${account.lastName}`);
    const uid = await createAccount(account);
    console.log(`  Contact: ${account.contactNumber}`);
    console.log(`  UID: ${uid}\n`);
  }

  await seedCategories();

  console.log("\nDone. Demo accounts are ready.");
  console.log(`Login at ${HOSTING_URL}`);
  console.log("Contacts:");
  console.log("  SuperAdmin=09000000001");
  console.log("  Admin=09000000002");
  console.log("  Resident=09000000003");
  console.log("  Worker=09000000004");
  console.log("Passwords come from scripts/.env.seed. Do not share or commit that file.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
