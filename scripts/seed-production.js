/**
 * Production seed script for Firebase.
 * Creates demo accounts (SuperAdmin, Admin, Worker, Resident) directly in production Firebase.
 *
 * Usage:
 *   1. Download a service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *   2. Save it as: service-account.json (in the project root)
 *   3. Copy scripts/.env.seed.example to scripts/.env.seed and fill in passwords
 *   4. Run: node scripts/seed-production.js
 *
 * WARNING: This runs against PRODUCTION Firebase. Only run once.
 * NEVER commit .env.seed — it is listed in .gitignore.
 */

const path = require("path");
const fs = require("fs");

// Load seed credentials from .env.seed (never committed to git)
const envPath = path.resolve(__dirname, ".env.seed");
if (!fs.existsSync(envPath)) {
  console.error("ERROR: scripts/.env.seed not found.");
  console.error("Copy scripts/.env.seed.example to scripts/.env.seed and fill in the passwords.");
  process.exit(1);
}

// Minimal env parser (no external dependency needed)
const envVars = fs.readFileSync(envPath, "utf8")
  .split("\n")
  .filter((line) => line.trim() && !line.startsWith("#"))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split("=");
    acc[key.trim()] = rest.join("=").trim();
    return acc;
  }, {});

const SUPERADMIN_PASSWORD = envVars.SUPERADMIN_PASSWORD;
const ADMIN_PASSWORD      = envVars.ADMIN_PASSWORD;
const WORKER_PASSWORD     = envVars.WORKER_PASSWORD;
const RESIDENT_PASSWORD   = envVars.RESIDENT_PASSWORD;

if (!SUPERADMIN_PASSWORD || !ADMIN_PASSWORD || !WORKER_PASSWORD || !RESIDENT_PASSWORD) {
  console.error("ERROR: One or more passwords are missing from scripts/.env.seed.");
  console.error("Required keys: SUPERADMIN_PASSWORD, ADMIN_PASSWORD, WORKER_PASSWORD, RESIDENT_PASSWORD");
  process.exit(1);
}

// Look for service account key in project root
const keyPath = path.resolve(__dirname, "../service-account.json");
if (!fs.existsSync(keyPath)) {
  console.error("ERROR: service-account.json not found at project root.");
  console.error("Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

const admin = require("firebase-admin");
const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

const DEMO_ACCOUNTS = [
  {
    contactNumber: "09001234567",
    password: SUPERADMIN_PASSWORD,
    firstName: "Super",
    lastName: "Admin",
    role: "superadmin",
    email: "projecttabangall@gmail.com",
    address: {
      street: "Tabang HQ",
      houseLot: "1",
      blockNo: "1",
      barangay: "Capitol Site",
    },
  },
  {
    contactNumber: "09391234567",
    password: ADMIN_PASSWORD,
    firstName: "Pedro",
    lastName: "Admin",
    role: "admin",
    address: {
      street: "Osmena Blvd",
      houseLot: "1",
      blockNo: "1",
      barangay: "Capitol Site",
    },
  },
  {
    contactNumber: "09171234567",
    password: RESIDENT_PASSWORD,
    firstName: "Juan",
    lastName: "Dela Cruz",
    role: "resident",
    address: {
      street: "Mango Ave",
      houseLot: "12",
      blockNo: "3",
      barangay: "Banilad",
    },
  },
  {
    contactNumber: "09281234567",
    password: WORKER_PASSWORD,
    firstName: "Maria",
    lastName: "Santos",
    role: "worker",
    address: {
      street: "Colon St",
      houseLot: "5",
      blockNo: "1",
      barangay: "Pardo",
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

  // Set custom claims (role)
  await auth.setCustomUserClaims(userRecord.uid, { role: account.role });

  // Check if Firestore doc already exists
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
  console.log("Project: project-tabang---claude-code\n");

  for (const account of DEMO_ACCOUNTS) {
    console.log(`[${account.role.toUpperCase()}] ${account.firstName} ${account.lastName}`);
    const uid = await createAccount(account);
    console.log(`  Contact: ${account.contactNumber}`);
    console.log(`  UID: ${uid}\n`);
  }

  await seedCategories();

  console.log("\nDone! Demo accounts are ready.");
  console.log("Login at https://project-tabang---claude-code.web.app/login");
  console.log("Contacts: SuperAdmin=09001234567 | Admin=09391234567 | Worker=09281234567 | Resident=09171234567");
  console.log("(Passwords are in scripts/.env.seed — do not share or commit that file)");

  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
