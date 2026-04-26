const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath = path.resolve(process.cwd(), "service-account.json");

if (!admin.apps.length) {
  try {
    // Local repo-only credential for maintenance tasks.
    // Keep this file out of git.
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } catch {
    admin.initializeApp();
  }
}

const db = admin.firestore();

const COMPLETED_STATUSES = new Set([
  "completed",
  "payment_submitted",
  "payment_confirmed",
]);

async function recomputeWorker(workerId) {
  const requestsSnapshot = await db
    .collection("serviceRequests")
    .where("assignedWorkerId", "==", workerId)
    .get();

  let completedJobsCount = 0;
  const ratings = [];

  for (const doc of requestsSnapshot.docs) {
    const data = doc.data();
    const status = typeof data.status === "string" ? data.status : "";

    if (COMPLETED_STATUSES.has(status) || data.completedAt) {
      completedJobsCount += 1;
    }

    if (
      status === "payment_confirmed" &&
      typeof data.rating === "number" &&
      Number.isFinite(data.rating)
    ) {
      ratings.push(data.rating);
    }
  }

  const averageRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, value) => sum + value, 0) / ratings.length) *
            10
        ) / 10
      : 0;

  await db.collection("users").doc(workerId).update({
    "workerData.completedJobsCount": completedJobsCount,
    "workerData.averageRating": averageRating,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { workerId, completedJobsCount, averageRating };
}

async function main() {
  const workersSnapshot = await db
    .collection("users")
    .where("role", "==", "worker")
    .get();

  for (const workerDoc of workersSnapshot.docs) {
    const result = await recomputeWorker(workerDoc.id);
    console.log(
      `Updated ${result.workerId}: jobs=${result.completedJobsCount}, rating=${result.averageRating}`
    );
  }
}

main()
  .then(() => {
    console.log("Worker performance recompute complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Worker performance recompute failed:", error);
    process.exit(1);
  });
