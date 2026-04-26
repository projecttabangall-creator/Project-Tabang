import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { REQUEST_STATUSES } from "@tabang/shared";
import { db } from "../config/firebase";
import { recomputeWorkerPerformance } from "./workerPerformance.service";

export const ACCEPTANCE_TIMEOUT_HOURS = 24;

const requestsRef = db.collection("serviceRequests");

function timestampToMillis(value: any): number | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value._seconds === "number") return value._seconds * 1000;
  return null;
}

function isAcceptanceTimedOut(requestData: any, nowMs = Date.now()): boolean {
  if (requestData?.status !== REQUEST_STATUSES.ACCEPTED) {
    return false;
  }

  const acceptedAtMs = timestampToMillis(requestData.acceptedAt);
  if (!acceptedAtMs) {
    return false;
  }

  return nowMs - acceptedAtMs >= ACCEPTANCE_TIMEOUT_HOURS * 60 * 60 * 1000;
}

async function createNotification(input: {
  userId?: string;
  type: string;
  title: string;
  body: string;
  requestId: string;
}): Promise<void> {
  if (!input.userId) return;

  await db.collection("notifications").add({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    referenceType: "request",
    referenceId: input.requestId,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function expireAcceptedRequestIfNeeded(
  requestId: string,
  requestData: any
): Promise<boolean> {
  if (!isAcceptanceTimedOut(requestData)) {
    return false;
  }

  const workerId =
    typeof requestData.assignedWorkerId === "string"
      ? requestData.assignedWorkerId
      : undefined;
  const workerName =
    typeof requestData.assignedWorkerName === "string"
      ? requestData.assignedWorkerName
      : undefined;
  const now = FieldValue.serverTimestamp();

  await requestsRef.doc(requestId).update({
    status: REQUEST_STATUSES.ACCEPTANCE_EXPIRED,
    acceptanceExpiredAt: now,
    acceptanceExpiredWorkerId: workerId || null,
    acceptanceExpiredWorkerName: workerName || null,
    acceptanceTimeoutPromptedAt: now,
    updatedAt: now,
  });

  if (workerId) {
    await recomputeWorkerPerformance(workerId);
  }

  await createNotification({
    userId: workerId,
    type: "system",
    title: "Job Acceptance Expired",
    body: "This job was returned to the resident because it was accepted for more than 24 hours without arrival.",
    requestId,
  });

  return true;
}

export async function sweepExpiredAcceptedRequests(): Promise<number> {
  const snapshot = await requestsRef
    .where("status", "==", REQUEST_STATUSES.ACCEPTED)
    .get();

  let expiredCount = 0;
  for (const doc of snapshot.docs) {
    const didExpire = await expireAcceptedRequestIfNeeded(doc.id, doc.data());
    if (didExpire) expiredCount += 1;
  }

  return expiredCount;
}
