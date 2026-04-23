import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { REQUEST_STATUSES } from "@tabang/shared";
import { db } from "../config/firebase";
import { assignWorker } from "./assignment.service";

interface NormalizedLocation {
  latitude: number;
  longitude: number;
}

interface NormalizedSchedule {
  date: string;
  startTime: string;
  endTime: string;
  noSpecifiedTime?: boolean;
}

function readCoordinate(value: any, primaryKey: string, fallbackKey: string): number | null {
  const raw = value?.[primaryKey] ?? value?.[fallbackKey];
  return typeof raw === "number" ? raw : null;
}

function normalizeLocation(location: any): NormalizedLocation | null {
  const latitude = readCoordinate(location, "latitude", "_latitude");
  const longitude = readCoordinate(location, "longitude", "_longitude");

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeDate(dateValue: any): string | null {
  if (!dateValue) return null;

  if (typeof dateValue === "string") {
    return dateValue;
  }

  if (dateValue instanceof Date) {
    return dateValue.toISOString().split("T")[0];
  }

  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toISOString().split("T")[0];
  }

  if (typeof dateValue?.toDate === "function") {
    return dateValue.toDate().toISOString().split("T")[0];
  }

  if (typeof dateValue?._seconds === "number") {
    return new Date(dateValue._seconds * 1000).toISOString().split("T")[0];
  }

  return null;
}

function normalizeSchedule(schedule: any): NormalizedSchedule | null {
  const date = normalizeDate(schedule?.date);
  if (!date) return null;

  const startTime = typeof schedule?.startTime === "string" ? schedule.startTime : null;
  const endTime = typeof schedule?.endTime === "string" ? schedule.endTime : null;

  // "No specified time" — both are intentionally empty
  if (startTime === "" && endTime === "") {
    return { date, startTime: "", endTime: "", noSpecifiedTime: true };
  }

  if (!startTime || !endTime) {
    return null;
  }

  return { date, startTime, endTime };
}

async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  referenceId: string;
}): Promise<void> {
  await db.collection("notifications").add({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    referenceType: "request",
    referenceId: input.referenceId,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function notifyPendingQueue(requestId: string, requestData: any): Promise<void> {
  const residentId =
    typeof requestData?.residentId === "string" ? requestData.residentId : null;

  const notificationBody = requestData?.categoryName
    ? `No worker is currently available for ${requestData.categoryName}. Your request is queued for reassignment.`
    : "No worker is currently available. Your request is queued for reassignment.";

  if (residentId) {
    await createNotification({
      userId: residentId,
      type: "system",
      title: "Request Queued",
      body: notificationBody,
      referenceId: requestId,
    });
  }

  const admins = await db.collection("users").where("role", "==", "admin").get();

  await Promise.all(
    admins.docs.map((adminDoc) =>
      createNotification({
        userId: adminDoc.id,
        type: "system",
        title: "Request Needs Manual Attention",
        body: `Request ${requestId} is still waiting for an eligible worker.`,
        referenceId: requestId,
      })
    )
  );
}

export async function attemptRequestAssignment(
  requestId: string,
  requestData: any
): Promise<"assigned" | "pending_queue" | "skipped"> {
  if (
    requestData?.status !== REQUEST_STATUSES.PENDING ||
    !requestData?.categoryId ||
    requestData?.assignedWorkerId
  ) {
    return "skipped";
  }

  const location = normalizeLocation(requestData.location);
  const schedule = normalizeSchedule(requestData.schedule);
  const excludedWorkerIds = Array.isArray(requestData.excludedWorkerIds)
    ? requestData.excludedWorkerIds.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (!location || !schedule) {
    await db.collection("serviceRequests").doc(requestId).update({
      assignmentError: "Request is missing valid location or schedule data",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "pending_queue";
  }

  const assignment = await assignWorker(
    requestData.categoryId,
    location,
    schedule,
    excludedWorkerIds
  );
  const requestRef = db.collection("serviceRequests").doc(requestId);

  if (assignment.workerId) {
    const workerRef = db.collection("users").doc(assignment.workerId);
    const workerDoc = await workerRef.get();

    if (!workerDoc.exists) {
      await requestRef.update({
        assignmentError: `Assigned worker ${assignment.workerId} was not found`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return "pending_queue";
    }

    const workerData = workerDoc.data()!;

    await requestRef.update({
      status: REQUEST_STATUSES.ASSIGNED,
      assignedWorkerId: assignment.workerId,
      assignedWorkerName: `${workerData.firstName} ${workerData.lastName}`,
      assignmentScore: assignment.score ?? null,
      assignmentAttempts: FieldValue.increment(1),
      assignedAt: FieldValue.serverTimestamp(),
      assignmentError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await workerRef.update({
      "workerData.lastAssignedAt": FieldValue.serverTimestamp(),
      "workerData.totalJobsAssigned": FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return "assigned";
  }

  await requestRef.update({
    assignmentAttempts: FieldValue.increment(1),
    pendingAt: FieldValue.serverTimestamp(),
    assignmentError: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await notifyPendingQueue(requestId, requestData);

  return "pending_queue";
}
