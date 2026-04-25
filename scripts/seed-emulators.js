/**
 * Seed script for Firebase emulators.
 * Creates demo accounts (Resident, Worker, Admin) in Auth + Firestore.
 *
 * Usage:
 *   1. Start emulators: npx firebase emulators:start
 *   2. (Optional) Set passwords via env vars:
 *        EMU_SUPERADMIN_PASSWORD, EMU_DEMO_PASSWORD
 *      Otherwise defaults below are used (emulator-only, not for production).
 *   3. In another terminal: npm run seed
 *
 * SECURITY: These passwords only work against the LOCAL emulator
 * (FIREBASE_AUTH_EMULATOR_HOST is forced below). They are NOT the
 * production passwords — production credentials live in scripts/.env.seed
 * (gitignored) and are read by scripts/seed-production.js.
 */

const admin = require("firebase-admin");

// Point to local emulators (use 127.0.0.1 instead of localhost to avoid IPv6 issues on some systems)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

// Must match the project ID used by the frontend / firebase.json
admin.initializeApp({ projectId: "project-tabang---claude-code" });

const auth = admin.auth();
const db = admin.firestore();

const SUPERADMIN_PASSWORD =
  process.env.EMU_SUPERADMIN_PASSWORD || "EmulatorOnly!Super1";
const DEMO_PASSWORD = process.env.EMU_DEMO_PASSWORD || "EmulatorOnly!Demo1";

const DEMO_ACCOUNTS = [
  {
    contactNumber: "09001234567",
    password: SUPERADMIN_PASSWORD,
    firstName: "Super",
    lastName: "Admin",
    role: "superadmin",
    birthday: "1990-01-01",
    email: "demo-superadmin@example.local",
    address: {
      street: "Tabang HQ",
      houseLot: "1",
      blockNo: "1",
      barangay: "Capitol Site",
    },
  },
  {
    contactNumber: "09171234567",
    password: DEMO_PASSWORD,
    firstName: "Juan",
    lastName: "Dela Cruz",
    role: "resident",
    birthday: "1995-06-15",
    address: {
      street: "Mango Ave",
      houseLot: "12",
      blockNo: "3",
      barangay: "Banilad",
    },
  },
  {
    contactNumber: "09281234567",
    password: DEMO_PASSWORD,
    firstName: "Maria",
    lastName: "Santos",
    role: "worker",
    birthday: "1993-03-22",
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
  {
    contactNumber: "09391234567",
    password: DEMO_PASSWORD,
    firstName: "Pedro",
    lastName: "Admin",
    role: "admin",
    birthday: "1990-01-10",
    address: {
      street: "Osmena Blvd",
      houseLot: "1",
      blockNo: "1",
      barangay: "Capitol Site",
    },
  },
];

async function createAccount(account) {
  const email = `${account.contactNumber}@tabang.local`;

  // 1. Create in Firebase Auth
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password: account.password,
      displayName: `${account.firstName} ${account.lastName}`,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      console.log(`  [skip] Auth user already exists for ${account.contactNumber}`);
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  // 2. Set custom claims
  await auth.setCustomUserClaims(userRecord.uid, { role: account.role });

  // 3. Create Firestore document
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userData = {
    uid: userRecord.uid,
    role: account.role,
    firstName: account.firstName,
    lastName: account.lastName,
    birthday: account.birthday,
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

  await db.collection("users").doc(userRecord.uid).set(userData, { merge: true });

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
  console.log("Seeding Firebase emulators...\n");

  // Create demo accounts
  for (const account of DEMO_ACCOUNTS) {
    const uid = await createAccount(account);
    console.log(`  [${account.role.toUpperCase()}] ${account.firstName} ${account.lastName}`);
    console.log(`    Contact: ${account.contactNumber} | Password: ${account.password}`);
    console.log(`    UID: ${uid}\n`);
  }

  // Seed categories
  await seedCategories();

  console.log("\nDone! Demo accounts are ready to use.");
  console.log("Login at http://localhost:3001/login with any of the credentials above.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
