import { FieldValue } from "firebase-admin/firestore";
import { REQUEST_STATUSES } from "@tabang/shared";
import { db } from "../config/firebase";

const requestsRef = db.collection("serviceRequests");
const usersRef = db.collection("users");

const COMPLETED_STATUSES = new Set<string>([
  REQUEST_STATUSES.COMPLETED,
  REQUEST_STATUSES.PAYMENT_SUBMITTED,
  REQUEST_STATUSES.PAYMENT_CONFIRMED,
]);

export async function recomputeWorkerPerformance(workerId: string): Promise<{
  completedJobsCount: number;
  averageRating: number;
  acceptanceRate: number;
}> {
  const [workerDoc, assignedSnapshot] = await Promise.all([
    usersRef.doc(workerId).get(),
    requestsRef.where("assignedWorkerId", "==", workerId).get(),
  ]);

  let completedJobsCount = 0;
  let acceptedAssignments = 0;
  const confirmedRatings: number[] = [];

  for (const doc of assignedSnapshot.docs) {
    const data = doc.data();
    const status =
      typeof data.status === "string" ? data.status : undefined;
    const rating =
      typeof data.rating === "number" && Number.isFinite(data.rating)
        ? data.rating
        : undefined;

    if (
      (status && COMPLETED_STATUSES.has(status)) ||
      data.completedAt
    ) {
      completedJobsCount += 1;
    }

    if (status === REQUEST_STATUSES.PAYMENT_CONFIRMED && rating !== undefined) {
      confirmedRatings.push(rating);
    }

    if (
      data.acceptedAt &&
      status !== REQUEST_STATUSES.ACCEPTANCE_EXPIRED
    ) {
      acceptedAssignments += 1;
    }
  }

  const averageRating =
    confirmedRatings.length > 0
      ? Math.round(
          (confirmedRatings.reduce((sum, value) => sum + value, 0) /
            confirmedRatings.length) *
            10
        ) / 10
      : 0;

  const totalJobsAssigned =
    typeof workerDoc.data()?.workerData?.totalJobsAssigned === "number"
      ? workerDoc.data()!.workerData.totalJobsAssigned
      : assignedSnapshot.size;
  const acceptanceRate =
    totalJobsAssigned > 0 ? acceptedAssignments / totalJobsAssigned : 0;

  await usersRef.doc(workerId).update({
    "workerData.completedJobsCount": completedJobsCount,
    "workerData.averageRating": averageRating,
    "workerData.acceptanceRate": acceptanceRate,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { completedJobsCount, averageRating, acceptanceRate };
}
