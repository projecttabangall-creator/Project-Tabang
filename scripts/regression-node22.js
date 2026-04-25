const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const PROJECT_ID = "project-tabang---claude-code";
const FUNCTIONS_BASE_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/api`;
const AUTH_BASE_URL = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const AUTH_API_KEY = "demo-api-key";

process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID, storageBucket: "project-tabang---claude-code.firebasestorage.app" });
}

const db = admin.firestore();
const auth = admin.auth();

const ACCOUNTS = {
  superadmin: {
    contactNumber: "09001234567",
    email: "09001234567@tabang.local",
    password: "Pr0jectTab4ng333",
  },
  admin: {
    contactNumber: "09391234567",
    email: "09391234567@tabang.local",
    password: "Password123",
  },
  resident: {
    contactNumber: "09171234567",
    email: "09171234567@tabang.local",
    password: "Password123",
  },
  worker: {
    contactNumber: "09281234567",
    email: "09281234567@tabang.local",
    password: "Password123",
  },
};

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${FUNCTIONS_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(json)}`
    );
  }

  return json;
}

async function signInWithPassword(email, password) {
  const response = await fetch(
    `${AUTH_BASE_URL}/accounts:signInWithPassword?key=${AUTH_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`signInWithPassword failed for ${email}: ${JSON.stringify(json)}`);
  }

  return {
    idToken: json.idToken,
    localId: json.localId,
  };
}

async function signInWithAnyPassword(email, passwords) {
  let lastError;
  for (const password of passwords) {
    try {
      const authResult = await signInWithPassword(email, password);
      return { ...authResult, password };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function getUserByContact(contactNumber) {
  const snap = await db
    .collection("users")
    .where("contactNumber", "==", contactNumber)
    .limit(1)
    .get();

  assert.equal(snap.empty, false, `Expected user ${contactNumber} to exist`);
  return snap.docs[0];
}

async function ensureCategoryItem(categoryName, itemId, itemName, minPrice) {
  const categorySnap = await db
    .collection("categories")
    .where("name", "==", categoryName)
    .limit(1)
    .get();

  assert.equal(categorySnap.empty, false, `Expected category ${categoryName} to exist`);
  const categoryDoc = categorySnap.docs[0];

  await categoryDoc.ref.collection("items").doc(itemId).set(
    {
      name: itemName,
      minPrice,
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return categoryDoc.id;
}

async function waitFor(check, description, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (lastError) throw lastError;
  throw new Error(`Timed out waiting for ${description}`);
}

async function countNotifications(userId, title) {
  const snap = await db
    .collection("notifications")
    .where("userId", "==", userId)
    .where("title", "==", title)
    .get();
  return snap.size;
}

async function run() {
  log("Starting Node 22 regression tests against Firebase emulators...");

  const superadminDoc = await getUserByContact(ACCOUNTS.superadmin.contactNumber);
  const adminDoc = await getUserByContact(ACCOUNTS.admin.contactNumber);
  const residentDoc = await getUserByContact(ACCOUNTS.resident.contactNumber);
  const workerDoc = await getUserByContact(ACCOUNTS.worker.contactNumber);

  const plumbingCategoryId = await ensureCategoryItem(
    "Plumbing",
    "pipe-repair",
    "Pipe Repair",
    300
  );

  await workerDoc.ref.update({
    "workerData.specialization": plumbingCategoryId,
    "workerData.isAvailable": true,
    isVerified: true,
    isActive: true,
    accountStatus: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const health = await apiFetch("/api/health");
  assert.equal(health.status, "ok");
  log("PASS health check");

  const residentAuth = await signInWithAnyPassword(ACCOUNTS.resident.email, [
    ACCOUNTS.resident.password,
    "Password123!",
  ]);
  ACCOUNTS.resident.password = residentAuth.password;

  const login = await apiFetch("/api/auth/login", {
    method: "POST",
    body: {
      contactNumber: ACCOUNTS.resident.contactNumber,
      password: residentAuth.password,
    },
  });
  assert.equal(login.user.contactNumber, ACCOUNTS.resident.contactNumber);
  assert.equal(login.user.mustChangePassword, false);
  log("PASS public login endpoint");

  const superadminAuth = await signInWithPassword(
    ACCOUNTS.superadmin.email,
    ACCOUNTS.superadmin.password
  );
  const adminAuth = await signInWithPassword(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  const workerAuth = await signInWithPassword(ACCOUNTS.worker.email, ACCOUNTS.worker.password);
  log("PASS auth emulator sign-ins");

  const [dashboard, users, analytics, income] = await Promise.all([
    apiFetch("/api/admin/dashboard", { token: adminAuth.idToken }),
    apiFetch("/api/admin/users", { token: adminAuth.idToken }),
    apiFetch("/api/admin/analytics", { token: adminAuth.idToken }),
    apiFetch("/api/admin/income", { token: adminAuth.idToken }),
  ]);
  assert.ok(Array.isArray(users.users));
  assert.ok(typeof dashboard.totalResidents === "number");
  assert.ok(typeof analytics.requestsByStatus === "object");
  assert.ok(typeof income.summary.totalIncome === "number");
  log("PASS admin dashboard/read endpoints");

  const workerListBefore = await apiFetch("/api/requests/my", { token: workerAuth.idToken });
  assert.ok(Array.isArray(workerListBefore.requests));
  await apiFetch(`/api/workers/${workerDoc.id}`, { token: adminAuth.idToken });
  await apiFetch(`/api/workers/${workerDoc.id}/verify-fingerprint`, {
    method: "POST",
    token: workerAuth.idToken,
    body: { verified: true },
  });
  const workerAfterFingerprint = await workerDoc.ref.get();
  assert.equal(
    workerAfterFingerprint.data().workerData.lastFingerprintVerification.verified,
    true
  );
  log("PASS worker profile and fingerprint logging API");

  const resetRequest = await apiFetch("/api/auth/request-password-reset", {
    method: "POST",
    body: {
      firstName: "Juan",
      lastName: "Dela Cruz",
      role: "resident",
      contactNumber: ACCOUNTS.resident.contactNumber,
      note: "Regression test reset request",
    },
  });
  assert.match(resetRequest.message, /submitted|pending/i);

  const resetRequests = await waitFor(
    async () => {
      const data = await apiFetch("/api/admin/password-reset-requests?status=pending", {
        token: adminAuth.idToken,
      });
      return data.requests.find(
        (request) =>
          request.contactNumber === ACCOUNTS.resident.contactNumber &&
          request.status === "pending"
      );
    },
    "password reset request to appear"
  );

  await waitFor(
    async () =>
      (await countNotifications(adminDoc.id, "Password reset request submitted")) >= 1 &&
      (await countNotifications(superadminDoc.id, "Password reset request submitted")) >= 1,
    "admin and superadmin password reset notifications"
  );
  log("PASS password reset request notifications for admin and superadmin");

  const approvedReset = await apiFetch(
    `/api/admin/password-reset-requests/${resetRequests.id}`,
    {
      method: "PATCH",
      token: adminAuth.idToken,
      body: { action: "approve", resolutionNote: "Regression approval" },
    }
  );
  assert.ok(approvedReset.temporaryPassword);

  const residentAfterApproval = await residentDoc.ref.get();
  assert.equal(Boolean(residentAfterApproval.data().mustChangePassword), true);

  const residentTempAuth = await signInWithPassword(
    ACCOUNTS.resident.email,
    approvedReset.temporaryPassword
  );
  await apiFetch("/api/auth/change-password", {
    method: "POST",
    token: residentTempAuth.idToken,
    body: { newPassword: "Password123!" },
  });

  const residentAfterPasswordChange = await residentDoc.ref.get();
  assert.equal(Boolean(residentAfterPasswordChange.data().mustChangePassword), false);
  const residentAuthAfterPasswordChange = await signInWithPassword(
    ACCOUNTS.resident.email,
    "Password123!"
  );
  ACCOUNTS.resident.password = "Password123!";
  log("PASS password reset approval and forced password change");

  const createdRequest = await apiFetch("/api/requests", {
    method: "POST",
    token: residentAuthAfterPasswordChange.idToken,
    body: {
      categoryId: plumbingCategoryId,
      itemId: "pipe-repair",
      description: "Regression test plumbing leak in kitchen sink.",
      suggestedPrice: 500,
      location: { latitude: 10.3157, longitude: 123.8854 },
      locationAddress: "Regression St, Banilad, Cebu City",
      photoUrls: [],
      schedule: {
        date: "2026-04-24",
        startTime: "09:00",
        endTime: "11:00",
      },
      paymentMethod: "cash",
      tipAmount: 0,
      isSpecialRequest: false,
    },
  });
  assert.ok(createdRequest.id);

  const assignedRequest = await waitFor(
    async () => {
      const snap = await db.collection("serviceRequests").doc(createdRequest.id).get();
      const data = snap.data();
      if (data?.assignedWorkerId) {
        return data;
      }
      return null;
    },
    "auto-assignment of created request"
  );
  assert.equal(assignedRequest.assignedWorkerId, workerDoc.id);

  const workerRequests = await waitFor(
    async () => {
      const data = await apiFetch("/api/requests/my", { token: workerAuth.idToken });
      return data.requests.find((request) => request.id === createdRequest.id) ? data : null;
    },
    "worker my-requests to include assigned request"
  );
  assert.ok(workerRequests.requests.some((request) => request.id === createdRequest.id));

  await apiFetch(`/api/requests/${createdRequest.id}/accept`, {
    method: "PATCH",
    token: workerAuth.idToken,
  });
  await apiFetch(`/api/requests/${createdRequest.id}/arrived`, {
    method: "PATCH",
    token: workerAuth.idToken,
  });
  await apiFetch(`/api/requests/${createdRequest.id}/final-price`, {
    method: "PATCH",
    token: workerAuth.idToken,
    body: {
      finalPrice: 500,
    },
  });
  await apiFetch(`/api/requests/${createdRequest.id}/complete`, {
    method: "PATCH",
    token: workerAuth.idToken,
    body: {
      proofOfWorkPhotoUrls: [],
    },
  });
  log("PASS worker request lifecycle endpoints");

  const payment = await apiFetch("/api/payments", {
    method: "POST",
    token: residentAuthAfterPasswordChange.idToken,
    body: {
      requestId: createdRequest.id,
      proofUrl: "https://example.com/proof.jpg",
      rating: 5,
      ratingComment: "Regression payment submission",
    },
  });
  assert.ok(payment.id);

  const pendingPayments = await apiFetch("/api/payments/pending", {
    token: adminAuth.idToken,
  });
  assert.ok(pendingPayments.payments.some((item) => item.id === payment.id));

  await apiFetch(`/api/payments/${payment.id}/confirm`, {
    method: "PATCH",
    token: adminAuth.idToken,
  });

  const paymentDoc = await db.collection("payments").doc(payment.id).get();
  assert.equal(paymentDoc.data().status, "confirmed");
  log("PASS payment submission and admin confirmation");

  const dispute = await apiFetch("/api/disputes", {
    method: "POST",
    token: residentAuthAfterPasswordChange.idToken,
    body: {
      requestId: createdRequest.id,
      disputeTypes: ["payment", "other"],
      otherDetails: "Regression custom dispute note",
      description: "Regression dispute after payment confirmation.",
      evidenceUrls: [],
    },
  });
  assert.ok(dispute.id);

  const disputes = await apiFetch("/api/disputes", { token: adminAuth.idToken });
  assert.ok(disputes.disputes.some((item) => item.id === dispute.id));

  await apiFetch(`/api/disputes/${dispute.id}/resolve`, {
    method: "PATCH",
    token: adminAuth.idToken,
    body: {
      resolution: "favor_resident",
      resolutionNotes: "Regression resolution notes",
      creditDeductions: [],
    },
  });

  const resolvedDisputeDoc = await db.collection("disputes").doc(dispute.id).get();
  assert.equal(resolvedDisputeDoc.data().status, "resolved");
  log("PASS dispute filing and resolution");

  const emergency = await apiFetch("/api/emergencies", {
    method: "POST",
    token: adminAuth.idToken,
    body: {
      title: "Regression Flood Response",
      requesterName: "Barangay Captain",
      requesterContact: "09171234567",
      categoryIds: [plumbingCategoryId],
      details: "Regression emergency details for active flood response.",
      needsList: ["Water pump", "Hoses"],
      photoUrls: [],
      location: { latitude: 10.3157, longitude: 123.8854 },
      locationAddress: "Flood Zone, Cebu City",
      affectedFamilies: 12,
      durationHours: 4,
      creditReward: 2,
    },
  });
  assert.ok(emergency.id);

  const workerEmergencyList = await apiFetch("/api/emergencies?status=active", {
    token: workerAuth.idToken,
  });
  const workerEmergency = workerEmergencyList.emergencies.find(
    (item) => item.id === emergency.id
  );
  assert.ok(workerEmergency);
  assert.equal(workerEmergency.canApply, true);

  await apiFetch(`/api/emergencies/${emergency.id}/apply`, {
    method: "POST",
    token: workerAuth.idToken,
  });
  await apiFetch(`/api/emergencies/${emergency.id}/applicants/${workerDoc.id}/approve`, {
    method: "PATCH",
    token: adminAuth.idToken,
    body: { approvalStatus: "approved" },
  });
  await apiFetch(`/api/emergencies/${emergency.id}/complete`, {
    method: "PATCH",
    token: adminAuth.idToken,
  });
  await apiFetch(`/api/emergencies/${emergency.id}/applicants/${workerDoc.id}/award`, {
    method: "PATCH",
    token: adminAuth.idToken,
    body: { amount: 2 },
  });

  const workerAfterAward = await workerDoc.ref.get();
  assert.equal(workerAfterAward.data().creditPoints >= 5, true);
  log("PASS emergency create/apply/review/award lifecycle");

  const notificationsForAdmin = await db
    .collection("notifications")
    .where("userId", "==", adminDoc.id)
    .get();
  const notificationsForSuperadmin = await db
    .collection("notifications")
    .where("userId", "==", superadminDoc.id)
    .get();

  assert.ok(notificationsForAdmin.size > 0);
  assert.ok(notificationsForSuperadmin.size > 0);
  log("PASS notification persistence checks");

  log("All regression checks passed on Node 22 candidate.");
}

run().catch((error) => {
  console.error("Regression suite failed:");
  console.error(error);
  process.exit(1);
});
