import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";
import {
  ApprovePriceOverrideInput,
  CreateRequestInput,
  DEFAULT_COMMISSION_PERCENT,
  RateWorkerInput,
  REQUEST_STATUSES,
  ROOKIE_JOB_THRESHOLD,
  SpecialRequestInput,
  UpdateScheduleInput,
} from "@tabang/shared";
import { attemptRequestAssignment } from "../services/requestAssignment.service";
import {
  calculateCancellationPenalty,
  calculateCommission,
  calculateTotalForResident,
  getCommissionPercent,
  validateFinalPrice,
} from "../services/pricing.service";
import { recomputeWorkerPerformance } from "../services/workerPerformance.service";
import { expireAcceptedRequestIfNeeded } from "../services/acceptanceTimeout.service";

const requestsRef = db.collection("serviceRequests");
const usersRef = db.collection("users");

interface CreateRequestOptions {
  residentId: string;
  residentName: string;
  residentContact: string;
  isSpecialRequest: boolean;
  specialRequestNote?: string;
  beneficiary?: SpecialRequestInput["beneficiary"];
  createdByAdminId?: string;
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatFullName(
  data: Record<string, any> | undefined | null
): string | undefined {
  const firstName =
    typeof data?.firstName === "string" ? data.firstName.trim() : "";
  const lastName =
    typeof data?.lastName === "string" ? data.lastName.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || undefined;
}

function isValidDateString(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function getPhilippinesDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeWorkingSchedule(
  schedule: Array<{ date: string; startTime: string; endTime: string }>
): Array<{ date: string; startTime: string; endTime: string }> {
  return schedule
    .map((entry) => ({
      date: entry.date.trim(),
      startTime: entry.startTime,
      endTime: entry.endTime,
    }))
    .sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    );
}

async function replaceWorkerWorkingSchedule(input: {
  workerId: string;
  requestId: string;
  categoryName: string;
  itemName: string;
  workingSchedule: Array<{ date: string; startTime: string; endTime: string }>;
  status: string;
  now: FirebaseFirestore.FieldValue;
}): Promise<void> {
  const workerRef = usersRef.doc(input.workerId);
  const workerDoc = await workerRef.get();
  const workerData = workerDoc.data()?.workerData || {};
  const existingSchedule = Array.isArray(workerData.workingSchedule)
    ? workerData.workingSchedule.filter(
        (entry: any) => entry?.requestId !== input.requestId
      )
    : [];

  await workerRef.update({
    "workerData.workingSchedule": [
      ...existingSchedule,
      ...input.workingSchedule.map((entry) => ({
        requestId: input.requestId,
        categoryName: input.categoryName,
        itemName: input.itemName,
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        status: input.status,
      })),
    ],
    updatedAt: input.now,
  });
}

async function updateWorkerWorkingScheduleStatus(
  workerId: string | undefined | null,
  requestId: string,
  status: string,
  now: FirebaseFirestore.FieldValue
): Promise<void> {
  if (!workerId) {
    return;
  }

  const workerRef = usersRef.doc(workerId);
  const workerDoc = await workerRef.get();
  const workerData = workerDoc.data()?.workerData || {};
  const existingSchedule = Array.isArray(workerData.workingSchedule)
    ? workerData.workingSchedule
    : [];

  if (!existingSchedule.some((entry: any) => entry?.requestId === requestId)) {
    return;
  }

  await workerRef.update({
    "workerData.workingSchedule": existingSchedule.map((entry: any) =>
      entry?.requestId === requestId ? { ...entry, status } : entry
    ),
    updatedAt: now,
  });
}

async function removeWorkerWorkingSchedule(
  workerId: string | undefined | null,
  requestId: string,
  now: FirebaseFirestore.FieldValue
): Promise<void> {
  if (!workerId) {
    return;
  }

  const workerRef = usersRef.doc(workerId);
  const workerDoc = await workerRef.get();
  const workerData = workerDoc.data()?.workerData || {};
  const existingSchedule = Array.isArray(workerData.workingSchedule)
    ? workerData.workingSchedule
    : [];

  await workerRef.update({
    "workerData.workingSchedule": existingSchedule.filter(
      (entry: any) => entry?.requestId !== requestId
    ),
    updatedAt: now,
  });
}

async function fetchUsersByIds(
  userIds: Array<string | undefined | null>
): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const docs = await Promise.all(uniqueIds.map((id) => usersRef.doc(id).get()));
  const usersById = new Map<string, FirebaseFirestore.DocumentData>();

  for (const doc of docs) {
    if (doc.exists) {
      usersById.set(doc.id, doc.data()!);
    }
  }

  return usersById;
}

function buildRequestResponse(
  id: string,
  data: FirebaseFirestore.DocumentData,
  usersById: Map<string, FirebaseFirestore.DocumentData>
): Record<string, any> {
  const assignedWorkerId =
    typeof data.assignedWorkerId === "string" ? data.assignedWorkerId : undefined;
  const residentId =
    typeof data.residentId === "string" ? data.residentId : undefined;
  const assignedWorker = assignedWorkerId
    ? usersById.get(assignedWorkerId)
    : undefined;
  const resident = residentId ? usersById.get(residentId) : undefined;
  const workerName =
    data.assignedWorkerName || formatFullName(assignedWorker) || undefined;
  const residentName = data.residentName || formatFullName(resident) || undefined;
  const beneficiaryName = formatFullName(data.beneficiary);

  return {
    id,
    ...data,
    residentName,
    residentPhone: data.residentContact || resident?.contactNumber || "",
    workerName,
    workerPhone: assignedWorker?.contactNumber || "",
    workerProfilePhotoUrl:
      typeof assignedWorker?.profilePhotoUrl === "string"
        ? assignedWorker.profilePhotoUrl
        : "",
    workerRating: getFiniteNumber(assignedWorker?.workerData?.averageRating),
    yourRating: getFiniteNumber(data.rating),
    commissionPercent:
      getFiniteNumber(data.commissionPercent) ?? DEFAULT_COMMISSION_PERCENT,
    beneficiaryName,
  };
}

async function buildRequestResponses(
  docs: Array<
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot
  >
): Promise<Record<string, any>[]> {
  const allUsers = await fetchUsersByIds(
    docs.flatMap((doc) => {
      const data = doc.data() ?? {};
      return [data.residentId, data.assignedWorkerId];
    })
  );

  return docs.map((doc) => buildRequestResponse(doc.id, doc.data()!, allUsers));
}

async function createRequestNotification(input: {
  userId?: string;
  type: string;
  title: string;
  body: string;
  requestId: string;
}): Promise<void> {
  if (!input.userId) {
    return;
  }

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

async function createRequestRecord(
  body: CreateRequestInput | SpecialRequestInput,
  options: CreateRequestOptions
): Promise<{
  requestId: string;
  commission: number;
  commissionPercent: number;
  totalForResident: number;
}> {
  const [categoryDoc, itemDoc] = await Promise.all([
    db.collection("categories").doc(body.categoryId).get(),
    db
      .collection("categories")
      .doc(body.categoryId)
      .collection("items")
      .doc(body.itemId)
      .get(),
  ]);

  if (!categoryDoc.exists || !itemDoc.exists) {
    throw new Error("Category or item not found");
  }

  const categoryData = categoryDoc.data()!;
  const itemData = itemDoc.data()!;

  if (body.suggestedPrice < itemData.minPrice) {
    throw new Error(`Suggested price must be at least PHP ${itemData.minPrice}`);
  }

  const commissionPercent = await getCommissionPercent();
  const commission = calculateCommission(body.suggestedPrice, commissionPercent);
  const totalForResident = calculateTotalForResident(
    body.suggestedPrice,
    commissionPercent
  );
  const now = FieldValue.serverTimestamp();

  const requestRef = await requestsRef.add({
    residentId: options.residentId,
    residentName: options.residentName,
    residentContact: options.residentContact,
    categoryId: body.categoryId,
    categoryName: categoryData.name,
    itemId: body.itemId,
    itemName: itemData.name,
    description: body.description,
    photoUrls: body.photoUrls || [],
    suggestedPrice: body.suggestedPrice,
    minPrice: itemData.minPrice,
    commission,
    commissionPercent,
    totalForResident,
    location: new GeoPoint(body.location.latitude, body.location.longitude),
    locationAddress: body.locationAddress || "",
    schedule: {
      date: new Timestamp(new Date(body.schedule.date).getTime() / 1000, 0),
      startTime: body.schedule.startTime,
      endTime: body.schedule.endTime,
    },
    paymentMethod: body.paymentMethod,
    tipAmount: body.tipAmount ?? 0,
    status: REQUEST_STATUSES.PENDING,
    assignmentAttempts: 0,
    excludedWorkerIds: [],
    priceOverrideRequired: false,
    isSpecialRequest: options.isSpecialRequest,
    specialRequestNote: options.specialRequestNote || "",
    beneficiary: options.beneficiary || null,
    createdByAdminId: options.createdByAdminId || null,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("systemLogs").add({
    action: options.isSpecialRequest ? "special_request_created" : "request_created",
    performedBy: options.createdByAdminId || options.residentId,
    targetRequestId: requestRef.id,
    details: options.isSpecialRequest
      ? `Special request created for ${options.residentName}: ${categoryData.name} - ${itemData.name}`
      : `Service request created: ${categoryData.name} - ${itemData.name}`,
    createdAt: now,
  });

  return {
    requestId: requestRef.id,
    commission,
    commissionPercent,
    totalForResident,
  };
}

/**
 * POST /api/requests
 * Create a new service request (resident or admin)
 */
export async function createRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as CreateRequestInput;
  const userId = req.user!.uid;

  try {
    const userDoc = await usersRef.doc(userId).get();
    const userData = userDoc.data();

    if (!userDoc.exists || !userData) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }

    const result = await createRequestRecord(body, {
      residentId: userId,
      residentName: `${userData.firstName} ${userData.lastName}`,
      residentContact: userData.contactNumber,
      isSpecialRequest: body.isSpecialRequest || false,
      specialRequestNote: body.specialRequestNote,
    });

    res.status(201).json({
      id: result.requestId,
      status: REQUEST_STATUSES.PENDING,
      suggestedPrice: body.suggestedPrice,
      commission: result.commission,
      commissionPercent: result.commissionPercent,
      totalForResident: result.totalForResident,
    });
  } catch (error) {
    console.error("Create request error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create request";
    const status =
      message === "Category or item not found"
        ? 404
        : message.startsWith("Suggested price")
          ? 400
          : 500;
    res.status(status).json({ error: message });
  }
}

/**
 * POST /api/admin/special-request
 * Create a special request on behalf of a beneficiary.
 */
export async function createSpecialRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as SpecialRequestInput;
  const adminId = req.user!.uid;

  try {
    const beneficiaryName = `${body.beneficiary.firstName} ${body.beneficiary.lastName}`;
    const result = await createRequestRecord(body, {
      residentId: adminId,
      residentName: beneficiaryName,
      residentContact: body.beneficiary.contactNumber,
      isSpecialRequest: true,
      specialRequestNote: body.specialRequestNote,
      beneficiary: body.beneficiary,
      createdByAdminId: adminId,
    });

    res.status(201).json({
      id: result.requestId,
      status: REQUEST_STATUSES.PENDING,
      suggestedPrice: body.suggestedPrice,
      commission: result.commission,
      commissionPercent: result.commissionPercent,
      totalForResident: result.totalForResident,
    });
  } catch (error) {
    console.error("Create special request error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create special request";
    const status =
      message === "Category or item not found"
        ? 404
        : message.startsWith("Suggested price")
          ? 400
          : 500;
    res.status(status).json({ error: message });
  }
}

/**
 * GET /api/requests
 * Admin list of all requests.
 */
export async function listRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { status, categoryId, isSpecialRequest } = req.query;

  try {
    let query: FirebaseFirestore.Query = requestsRef;

    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    if (categoryId && typeof categoryId === "string") {
      query = query.where("categoryId", "==", categoryId);
    }

    if (typeof isSpecialRequest === "string") {
      query = query.where("isSpecialRequest", "==", isSpecialRequest === "true");
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();
    const requests = await buildRequestResponses(snapshot.docs);

    res.json({ requests });
  } catch (error) {
    console.error("List requests error:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
}

/**
 * GET /api/requests/my
 * Get my requests (resident or worker)
 */
export async function getMyRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.uid;
  const { status } = req.query;

  try {
    let query: FirebaseFirestore.Query = requestsRef;

    if (req.user!.role === "resident") {
      query = query.where("residentId", "==", userId);
    } else if (req.user!.role === "worker") {
      query = query.where("assignedWorkerId", "==", userId);
    } else {
      res.status(403).json({ error: "Unsupported role for this endpoint" });
      return;
    }

    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();
    const requests = await buildRequestResponses(snapshot.docs);

    res.json({ requests });
  } catch (error) {
    console.error("Get requests error:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
}

/**
 * GET /api/requests/:id
 * Get request detail
 */
export async function getRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const userId = req.user!.uid;

  try {
    const doc = await requestsRef.doc(requestId).get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    let data = doc.data()!;

    if (await expireAcceptedRequestIfNeeded(requestId, data)) {
      const refreshedDoc = await requestsRef.doc(requestId).get();
      data = refreshedDoc.data()!;
    }

    let canView =
      userId === data.residentId ||
      userId === data.assignedWorkerId ||
      req.user!.role === "admin" ||
      req.user!.role === "superadmin";

    // Workers may also view PENDING, unassigned requests in their specialization
    // (the open pool that rookies can claim).
    if (
      !canView &&
      req.user!.role === "worker" &&
      data.status === REQUEST_STATUSES.PENDING &&
      !data.assignedWorkerId
    ) {
      const workerDoc = await usersRef.doc(userId).get();
      if (workerDoc.exists) {
        const workerData = workerDoc.data()!;
        const v = workerData.workerData?.specialization;
        const specs = Array.isArray(v)
          ? v.filter((s: unknown): s is string => typeof s === "string")
          : typeof v === "string"
            ? [v]
            : [];
        if (specs.includes(data.categoryId)) {
          canView = true;
        }
      }
    }

    if (!canView) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const usersById = await fetchUsersByIds([
      data.residentId,
      data.assignedWorkerId,
    ]);

    res.json({
      request: buildRequestResponse(doc.id, data, usersById),
    });
  } catch (error) {
    console.error("Get request error:", error);
    res.status(500).json({ error: "Failed to fetch request" });
  }
}

/**
 * PATCH /api/requests/:id/accept
 * Worker accepts the assignment
 */
export async function acceptRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const workerId = req.user!.uid;

  try {
    const docRef = requestsRef.doc(requestId);

    // Use a transaction so a rookie claim of a PENDING request is race-safe
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) {
        return { ok: false as const, status: 404, error: "Request not found" };
      }

      const data = doc.data()!;
      const now = FieldValue.serverTimestamp();

      // Path A: Worker was auto-assigned and is now confirming acceptance
      if (data.status === REQUEST_STATUSES.ASSIGNED) {
        if (data.assignedWorkerId !== workerId) {
          return { ok: false as const, status: 403, error: "Not assigned to you" };
        }
        tx.update(docRef, {
          status: REQUEST_STATUSES.ACCEPTED,
          acceptedAt: now,
          updatedAt: now,
        });
        return { ok: true as const };
      }

      // Path B: Rookie worker (< ROOKIE_JOB_THRESHOLD completed jobs) claims
      // an unassigned PENDING request from the open pool
      if (
        data.status === REQUEST_STATUSES.PENDING &&
        !data.assignedWorkerId
      ) {
        const workerDoc = await tx.get(usersRef.doc(workerId));
        if (!workerDoc.exists) {
          return { ok: false as const, status: 404, error: "Worker not found" };
        }
        const workerData = workerDoc.data()!;
        const completedJobsCount =
          workerData.workerData?.completedJobsCount ?? 0;

        if (completedJobsCount >= ROOKIE_JOB_THRESHOLD) {
          return {
            ok: false as const,
            status: 403,
            error:
              "Only workers with fewer than 5 completed jobs may claim pending requests directly",
          };
        }

        const excluded: string[] = Array.isArray(data.excludedWorkerIds)
          ? data.excludedWorkerIds
          : [];
        if (excluded.includes(workerId)) {
          return { ok: false as const, status: 403, error: "Not eligible for this request" };
        }

        const workerSpecs = (() => {
          const v = workerData.workerData?.specialization;
          if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
          if (typeof v === "string") return [v];
          return [];
        })();
        if (!workerSpecs.includes(data.categoryId)) {
          return { ok: false as const, status: 403, error: "Category does not match your specialization" };
        }

        // Rookie claim: PENDING → ASSIGNED (not ACCEPTED). The claim only
        // reserves the request; the worker still goes through the normal
        // Accept / Reject flow from the assigned state.
        tx.update(docRef, {
          status: REQUEST_STATUSES.ASSIGNED,
          assignedWorkerId: workerId,
          assignedWorkerName: `${workerData.firstName} ${workerData.lastName}`,
          assignmentScore: null,
          assignedAt: now,
          updatedAt: now,
        });
        tx.update(usersRef.doc(workerId), {
          "workerData.lastAssignedAt": now,
          "workerData.totalJobsAssigned": FieldValue.increment(1),
          updatedAt: now,
        });
        return { ok: true as const };
      }

      return {
        ok: false as const,
        status: 400,
        error: "Request is not available to accept",
      };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ message: "Request claimed/accepted" });
  } catch (error) {
    console.error("Accept request error:", error);
    res.status(500).json({ error: "Failed to accept request" });
  }
}

/**
 * GET /api/requests/available
 * Rookie workers (< ROOKIE_JOB_THRESHOLD completed jobs) see all PENDING,
 * unassigned requests in their specialization that they aren't excluded from.
 */
export async function getAvailableRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const workerId = req.user!.uid;

  try {
    const workerDoc = await usersRef.doc(workerId).get();
    if (!workerDoc.exists) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }
    const workerData = workerDoc.data()!;
    const completedJobsCount = workerData.workerData?.completedJobsCount ?? 0;
    const rawSpecialization = workerData.workerData?.specialization;
    const workerSpecs = Array.isArray(rawSpecialization)
      ? rawSpecialization.filter((s: unknown): s is string => typeof s === "string")
      : typeof rawSpecialization === "string"
        ? [rawSpecialization]
        : [];

    if (completedJobsCount >= ROOKIE_JOB_THRESHOLD) {
      // Experienced workers don't browse the pool — auto-assignment handles them
      res.json({ requests: [] });
      return;
    }

    if (workerSpecs.length === 0) {
      res.json({ requests: [] });
      return;
    }

    // Filter pending requests in memory so we tolerate either string or string[]
    // shapes for category matching, and avoid requiring a composite Firestore index.
    const snapshot = await requestsRef
      .where("status", "==", REQUEST_STATUSES.PENDING)
      .get();

    const filtered = snapshot.docs.filter((doc) => {
      const data = doc.data();
      if (data.assignedWorkerId) return false;
      if (!workerSpecs.includes(data.categoryId)) return false;
      const excluded: string[] = Array.isArray(data.excludedWorkerIds)
        ? data.excludedWorkerIds
        : [];
      return !excluded.includes(workerId);
    });

    filtered.sort((a, b) => {
      const aTime = a.data().createdAt?.toMillis?.() ?? 0;
      const bTime = b.data().createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });

    const requests = await buildRequestResponses(filtered);
    res.json({ requests });
  } catch (error) {
    console.error("Get available requests error:", error);
    res.status(500).json({ error: "Failed to fetch available requests" });
  }
}

/**
 * PATCH /api/requests/:id/reject
 * Worker rejects the assignment (triggers reassignment)
 */
export async function rejectRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const workerId = req.user!.uid;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.assignedWorkerId !== workerId) {
      res.status(403).json({ error: "Not assigned to you" });
      return;
    }

    if (data.status !== REQUEST_STATUSES.ASSIGNED) {
      res.status(400).json({ error: "Request is not in assigned state" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.PENDING,
      assignedWorkerId: null,
      assignedWorkerName: null,
      assignmentScore: null,
      excludedWorkerIds: FieldValue.arrayUnion(workerId),
      updatedAt: now,
    });

    res.json({ message: "Request rejected, will reassign" });
  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({ error: "Failed to reject request" });
  }
}

/**
 * PATCH /api/requests/:id/worker-cancel
 * Worker cancels after accepting or arriving — returns request to pending queue
 */
export async function workerCancelRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const workerId = req.user!.uid;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.assignedWorkerId !== workerId) {
      res.status(403).json({ error: "Not assigned to you" });
      return;
    }

    const cancellableStatuses = [REQUEST_STATUSES.ACCEPTED, REQUEST_STATUSES.WORKER_ARRIVED];
    if (!cancellableStatuses.includes(data.status)) {
      res.status(400).json({ error: "Cannot cancel at this stage" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.PENDING,
      assignedWorkerId: null,
      assignedWorkerName: null,
      assignmentScore: null,
      excludedWorkerIds: FieldValue.arrayUnion(workerId),
      updatedAt: now,
    });

    await usersRef.doc(workerId).update({
      "workerData.cancellationCount": FieldValue.increment(1),
      updatedAt: now,
    });

    await updateWorkerWorkingScheduleStatus(
      workerId,
      requestId,
      REQUEST_STATUSES.CANCELLED,
      now
    );

    await db.collection("systemLogs").add({
      action: "worker_cancelled_job",
      performedBy: workerId,
      targetRequestId: requestId,
      details: `Worker cancelled after reaching status: ${data.status}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Job cancelled. Request returned to pending." });
  } catch (error) {
    console.error("Worker cancel error:", error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
}

/**
 * PATCH /api/requests/:id/acceptance-timeout
 * Resident resolves a worker acceptance that expired after 24 hours.
 */
export async function resolveAcceptanceTimeout(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const residentId = req.user!.uid;
  const action = req.body?.action as "cancel" | "repost" | undefined;

  if (action !== "cancel" && action !== "repost") {
    res.status(400).json({ error: "Choose cancel or repost" });
    return;
  }

  try {
    const docRef = requestsRef.doc(requestId);
    let doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    let data = doc.data()!;

    if (data.residentId !== residentId) {
      res.status(403).json({ error: "Only the resident can resolve this request" });
      return;
    }

    if (data.status === REQUEST_STATUSES.ACCEPTED) {
      await expireAcceptedRequestIfNeeded(requestId, data);
      doc = await docRef.get();
      data = doc.data()!;
    }

    if (data.status !== REQUEST_STATUSES.ACCEPTANCE_EXPIRED) {
      res.status(400).json({ error: "This request does not need timeout action" });
      return;
    }

    const expiredWorkerId =
      typeof data.acceptanceExpiredWorkerId === "string"
        ? data.acceptanceExpiredWorkerId
        : typeof data.assignedWorkerId === "string"
          ? data.assignedWorkerId
          : null;
    const now = FieldValue.serverTimestamp();

    if (action === "cancel") {
      await docRef.update({
        status: REQUEST_STATUSES.CANCELLED,
        cancelledBy: residentId,
        cancelledAt: now,
        cancellationPenalty: 0,
        acceptanceExpiredResolvedAt: now,
        acceptanceExpiredResolution: "cancelled",
        updatedAt: now,
      });

      if (expiredWorkerId) {
        await recomputeWorkerPerformance(expiredWorkerId);
      }

      res.json({ message: "Request cancelled" });
      return;
    }

    await docRef.update({
      status: REQUEST_STATUSES.PENDING,
      assignedWorkerId: null,
      assignedWorkerName: null,
      assignmentScore: null,
      acceptedAt: null,
      assignedAt: null,
      arrivedAt: null,
      excludedWorkerIds: expiredWorkerId
        ? FieldValue.arrayUnion(expiredWorkerId)
        : data.excludedWorkerIds || [],
      acceptanceExpiredResolvedAt: now,
      acceptanceExpiredResolution: "reposted",
      repostedAt: now,
      updatedAt: now,
    });

    if (expiredWorkerId) {
      await recomputeWorkerPerformance(expiredWorkerId);
    }

    res.json({
      message:
        "Request reposted. The previous worker will not be assigned again.",
    });
  } catch (error) {
    console.error("Resolve acceptance timeout error:", error);
    res.status(500).json({ error: "Failed to resolve timed-out request" });
  }
}

/**
 * PATCH /api/requests/:id/arrived
 * Worker marks arrival at location
 */
export async function markArrived(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const workerId = req.user!.uid;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.assignedWorkerId !== workerId) {
      res.status(403).json({ error: "Not assigned to you" });
      return;
    }

    if (data.status !== REQUEST_STATUSES.ACCEPTED) {
      res.status(400).json({ error: "Request must be accepted first" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.WORKER_ARRIVED,
      arrivedAt: now,
      updatedAt: now,
    });

    res.json({ message: "Arrival recorded" });
  } catch (error) {
    console.error("Mark arrived error:", error);
    res.status(500).json({ error: "Failed to mark arrival" });
  }
}

/**
 * PATCH /api/requests/:id/final-price
 * Worker sets final price and confirms on-site
 */
export async function setFinalPrice(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const workerId = req.user!.uid;
  const { finalPrice, priceChangeReason, finalSchedule } = req.body;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.assignedWorkerId !== workerId) {
      res.status(403).json({ error: "Not assigned to you" });
      return;
    }

    if (data.status !== REQUEST_STATUSES.WORKER_ARRIVED) {
      res.status(400).json({ error: "Worker must arrive first" });
      return;
    }

    const normalizedReason =
      typeof priceChangeReason === "string" ? priceChangeReason.trim() : "";

    if (finalPrice !== data.suggestedPrice && !normalizedReason) {
      res.status(400).json({
        error: "Please provide a reason when changing the suggested price",
      });
      return;
    }

    const { isValid, requiresApproval, error } = validateFinalPrice(
      data.suggestedPrice,
      data.minPrice,
      finalPrice
    );

    if (!isValid && !requiresApproval) {
      res.status(400).json({
        error: error || "Invalid final price",
      });
      return;
    }

    const commissionPercent = await getCommissionPercent();
    const commission = calculateCommission(finalPrice, commissionPercent);
    const totalForResident = calculateTotalForResident(
      finalPrice,
      commissionPercent
    );
    const now = FieldValue.serverTimestamp();

    const workingSchedule = normalizeWorkingSchedule(finalSchedule.workingSchedule);
    const duplicateDates = new Set<string>();
    const today = getPhilippinesDateString();

    for (const entry of workingSchedule) {
      if (!isValidDateString(entry.date)) {
        res.status(400).json({ error: "Working schedule contains an invalid date" });
        return;
      }

      if (entry.date < today) {
        res.status(400).json({ error: "Working schedule cannot include past dates" });
        return;
      }

      if (entry.startTime >= entry.endTime) {
        res.status(400).json({ error: "Working schedule start time must be before end time" });
        return;
      }

      if (duplicateDates.has(entry.date)) {
        res.status(400).json({ error: "Select each working date only once" });
        return;
      }

      duplicateDates.add(entry.date);
    }

    const firstSchedule = workingSchedule[0];
    const scheduleUpdate = {
      "schedule.date": new Timestamp(
        Math.floor(new Date(`${firstSchedule.date}T00:00:00`).getTime() / 1000),
        0
      ),
      "schedule.startTime": firstSchedule.startTime,
      "schedule.endTime": firstSchedule.endTime,
      "schedule.numberOfDays": workingSchedule.length,
      "schedule.workingSchedule": workingSchedule,
    };

    if (requiresApproval) {
      await docRef.update({
        pendingFinalPrice: finalPrice,
        pendingCommission: commission,
        pendingTotalForResident: totalForResident,
        pendingPriceChangeReason: normalizedReason || null,
        commissionPercent,
        priceOverrideRequired: true,
        priceOverrideApproved: null,
        priceOverrideRequestedAt: now,
        priceOverrideRequestedBy: workerId,
        priceOverrideReviewedAt: null,
        priceOverrideReviewedBy: null,
        priceOverrideRejectedReason: null,
        ...scheduleUpdate,
        updatedAt: now,
      });

      await replaceWorkerWorkingSchedule({
        workerId,
        requestId,
        categoryName: data.categoryName,
        itemName: data.itemName,
        workingSchedule,
        status: REQUEST_STATUSES.WORKER_ARRIVED,
        now,
      });

      res.json({
        finalPrice,
        commission,
        commissionPercent,
        totalForResident,
        requiresAdminApproval: true,
        message: error || "Price override submitted for admin approval",
        status: REQUEST_STATUSES.WORKER_ARRIVED,
      });
      return;
    }

    await docRef.update({
      finalPrice,
      commission,
      commissionPercent,
      totalForResident,
      priceChangeReason: normalizedReason || null,
      priceOverrideRequired: false,
      priceOverrideApproved: null,
      pendingFinalPrice: null,
      pendingCommission: null,
      pendingTotalForResident: null,
      pendingPriceChangeReason: null,
      priceOverrideRequestedAt: null,
      priceOverrideRequestedBy: null,
      priceOverrideReviewedAt: null,
      priceOverrideReviewedBy: null,
      priceOverrideRejectedReason: null,
      ...scheduleUpdate,
      status: REQUEST_STATUSES.IN_PROGRESS,
      priceConfirmedAt: now,
      updatedAt: now,
    });

    await updateWorkerWorkingScheduleStatus(
      workerId,
      requestId,
      REQUEST_STATUSES.IN_PROGRESS,
      now
    );

    await replaceWorkerWorkingSchedule({
      workerId,
      requestId,
      categoryName: data.categoryName,
      itemName: data.itemName,
      workingSchedule,
      status: REQUEST_STATUSES.IN_PROGRESS,
      now,
    });

    res.json({
      finalPrice,
      commission,
      commissionPercent,
      totalForResident,
      requiresAdminApproval: false,
      status: REQUEST_STATUSES.IN_PROGRESS,
    });
  } catch (error) {
    console.error("Set final price error:", error);
    res.status(500).json({ error: "Failed to set final price" });
  }
}

/**
 * PATCH /api/requests/:id/approve-price-override
 * Admin approves or rejects a pending price override.
 */
export async function approvePriceOverride(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const adminId = req.user!.uid;
  const body = req.body as ApprovePriceOverrideInput;
  const approved = body.approved !== false;
  const rejectionReason =
    typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;
    const pendingFinalPrice = getFiniteNumber(data.pendingFinalPrice);
    const commissionPercent =
      getFiniteNumber(data.commissionPercent) ?? (await getCommissionPercent());
    const pendingCommission =
      getFiniteNumber(data.pendingCommission) ??
      (pendingFinalPrice !== undefined
        ? calculateCommission(pendingFinalPrice, commissionPercent)
        : undefined);
    const pendingTotalForResident =
      getFiniteNumber(data.pendingTotalForResident) ??
      (pendingFinalPrice !== undefined
        ? calculateTotalForResident(pendingFinalPrice, commissionPercent)
        : undefined);

    if (
      !data.priceOverrideRequired ||
      pendingFinalPrice === undefined ||
      pendingCommission === undefined ||
      pendingTotalForResident === undefined
    ) {
      res.status(400).json({ error: "No pending price override to review" });
      return;
    }

    if (!approved && !rejectionReason) {
      res.status(400).json({ error: "Rejection reason is required" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    if (approved) {
      await docRef.update({
        finalPrice: pendingFinalPrice,
        commission: pendingCommission,
        commissionPercent,
        totalForResident: pendingTotalForResident,
        priceChangeReason: data.pendingPriceChangeReason || null,
        priceOverrideRequired: false,
        priceOverrideApproved: true,
        priceOverrideReviewedAt: now,
        priceOverrideReviewedBy: adminId,
        priceOverrideRejectedReason: null,
        pendingFinalPrice: null,
        pendingCommission: null,
        pendingTotalForResident: null,
        pendingPriceChangeReason: null,
        status: REQUEST_STATUSES.IN_PROGRESS,
        priceConfirmedAt: now,
        updatedAt: now,
      });

      await updateWorkerWorkingScheduleStatus(
        data.assignedWorkerId,
        requestId,
        REQUEST_STATUSES.IN_PROGRESS,
        now
      );

      await createRequestNotification({
        userId: data.assignedWorkerId,
        type: "system",
        title: "Price Override Approved",
        body: "Admin approved the final price. You may continue the job.",
        requestId,
      });

      res.json({
        message: "Price override approved",
        status: REQUEST_STATUSES.IN_PROGRESS,
      });
      return;
    }

    await docRef.update({
      priceOverrideRequired: false,
      priceOverrideApproved: false,
      priceOverrideReviewedAt: now,
      priceOverrideReviewedBy: adminId,
      priceOverrideRejectedReason: rejectionReason,
      pendingFinalPrice: null,
      pendingCommission: null,
      pendingTotalForResident: null,
      pendingPriceChangeReason: null,
      updatedAt: now,
    });

    await Promise.all([
      createRequestNotification({
        userId: data.assignedWorkerId,
        type: "system",
        title: "Price Override Rejected",
        body: `Admin rejected the price override: ${rejectionReason}`,
        requestId,
      }),
      createRequestNotification({
        userId: data.residentId,
        type: "system",
        title: "Price Override Rejected",
        body: "Admin asked the worker to revise the final price.",
        requestId,
      }),
    ]);

    res.json({
      message: "Price override rejected",
      status: data.status,
    });
  } catch (error) {
    console.error("Approve price override error:", error);
    res.status(500).json({ error: "Failed to review price override" });
  }
}

/**
 * PATCH /api/requests/:id/complete
 * Worker completes job and uploads proof
 */
export async function completeRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const workerId = req.user!.uid;
  const { proofOfWorkPhotoUrls } = req.body;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.assignedWorkerId !== workerId) {
      res.status(403).json({ error: "Not assigned to you" });
      return;
    }

    if (
      ![REQUEST_STATUSES.IN_PROGRESS, REQUEST_STATUSES.PRICE_CONFIRMED].includes(
        data.status
      )
    ) {
      res.status(400).json({ error: "Work must be in progress first" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.COMPLETED,
      proofOfWorkPhotoUrls: proofOfWorkPhotoUrls || [],
      completedAt: now,
      updatedAt: now,
    });

    await removeWorkerWorkingSchedule(workerId, requestId, now);

    await recomputeWorkerPerformance(workerId);

    res.json({ message: "Job completed" });
  } catch (error) {
    console.error("Complete request error:", error);
    res.status(500).json({ error: "Failed to complete request" });
  }
}

/**
 * PATCH /api/requests/:id/cancel
 * Cancel a request (resident, special-request admin, or worker)
 */
export async function cancelRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const userId = req.user!.uid;
  const userRole = req.user!.role;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    // Admins can always cancel, residents/workers can only cancel their own
    const canCancel =
      userRole === "admin" ||
      userRole === "superadmin" ||
      userId === data.residentId ||
      userId === data.assignedWorkerId;

    if (!canCancel) {
      res.status(403).json({ error: "Cannot cancel this request" });
      return;
    }

    const cancellableStatuses = [
      REQUEST_STATUSES.PENDING,
      REQUEST_STATUSES.ASSIGNED,
      REQUEST_STATUSES.ACCEPTED,
      REQUEST_STATUSES.WORKER_ARRIVED,
      REQUEST_STATUSES.PRICE_CONFIRMED,
      REQUEST_STATUSES.IN_PROGRESS,
    ];

    if (!cancellableStatuses.includes(data.status)) {
      res.status(400).json({
        error: "This request can no longer be cancelled",
      });
      return;
    }

    const now = FieldValue.serverTimestamp();
    let cancellationPenalty = 0;

    if (
      [
        REQUEST_STATUSES.WORKER_ARRIVED,
        REQUEST_STATUSES.PRICE_CONFIRMED,
        REQUEST_STATUSES.IN_PROGRESS,
      ].includes(data.status)
    ) {
      cancellationPenalty = calculateCancellationPenalty(data.suggestedPrice);
    }

    const rawReasons = Array.isArray(req.body?.reasonCategories)
      ? req.body.reasonCategories.filter(
          (r: unknown): r is string => typeof r === "string"
        )
      : [];
    const reasonOther =
      typeof req.body?.reasonOther === "string"
        ? req.body.reasonOther.trim().slice(0, 500)
        : "";
    const reason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim().slice(0, 500)
        : "";

    await docRef.update({
      status: REQUEST_STATUSES.CANCELLED,
      cancelledBy: userId,
      cancelledAt: now,
      cancellationPenalty,
      cancellationReasonCategories: rawReasons,
      cancellationReasonOther: reasonOther,
      cancellationReason: reason || rawReasons.join(", "),
      updatedAt: now,
    });

    await updateWorkerWorkingScheduleStatus(
      data.assignedWorkerId,
      requestId,
      REQUEST_STATUSES.CANCELLED,
      now
    );

    res.json({ message: "Request cancelled", cancellationPenalty });
  } catch (error) {
    console.error("Cancel request error:", error);
    res.status(500).json({ error: "Failed to cancel request" });
  }
}

/**
 * PATCH /api/requests/:id/repost
 * Resident reposts a request — clears the assigned worker (adding them to
 * excludedWorkerIds), optionally updates the schedule, returns the request
 * to PENDING, and retriggers auto-assignment. The previous worker is never
 * re-assigned. Records the reason on the request doc.
 */
export async function repostRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const userId = req.user!.uid;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (userId !== data.residentId) {
      res.status(403).json({ error: "Only the resident can repost this request" });
      return;
    }

    const repostableStatuses = [
      REQUEST_STATUSES.PENDING,
      REQUEST_STATUSES.ASSIGNED,
      REQUEST_STATUSES.ACCEPTED,
      REQUEST_STATUSES.WORKER_ARRIVED,
    ];
    if (!repostableStatuses.includes(data.status)) {
      res.status(400).json({
        error: "This request can no longer be reposted at its current stage",
      });
      return;
    }

    const previousWorkerId =
      typeof data.assignedWorkerId === "string" ? data.assignedWorkerId : null;

    const rawReasons = Array.isArray(req.body?.reasonCategories)
      ? req.body.reasonCategories.filter(
          (r: unknown): r is string => typeof r === "string"
        )
      : [];
    const reasonOther =
      typeof req.body?.reasonOther === "string"
        ? req.body.reasonOther.trim().slice(0, 500)
        : "";

    const newScheduleInput = req.body?.schedule || {};
    const today = getPhilippinesDateString();
    const update: Record<string, any> = {
      status: REQUEST_STATUSES.PENDING,
      assignedWorkerId: null,
      assignedWorkerName: null,
      assignmentScore: null,
      acceptedAt: null,
      assignedAt: null,
      arrivedAt: null,
      excludedWorkerIds: previousWorkerId
        ? FieldValue.arrayUnion(previousWorkerId)
        : data.excludedWorkerIds || [],
      repostedAt: FieldValue.serverTimestamp(),
      repostReasonCategories: rawReasons,
      repostReasonOther: reasonOther,
      updatedAt: FieldValue.serverTimestamp(),
    };

    let nextSchedule = data.schedule;
    if (newScheduleInput && typeof newScheduleInput === "object") {
      const date =
        typeof newScheduleInput.date === "string" ? newScheduleInput.date : null;
      const startTime =
        typeof newScheduleInput.startTime === "string"
          ? newScheduleInput.startTime
          : "";
      const endTime =
        typeof newScheduleInput.endTime === "string"
          ? newScheduleInput.endTime
          : "";

      if (date) {
        if (!isValidDateString(date)) {
          res.status(400).json({ error: "Invalid schedule date" });
          return;
        }
        if (date < today) {
          res.status(400).json({ error: "Schedule date cannot be in the past" });
          return;
        }
        const noSpecifiedTime = startTime === "" && endTime === "";
        if (!noSpecifiedTime && (!startTime || !endTime)) {
          res.status(400).json({ error: "Provide both start and end time" });
          return;
        }
        if (!noSpecifiedTime && startTime >= endTime) {
          res.status(400).json({ error: "End time must be after start time" });
          return;
        }
        nextSchedule = { ...(data.schedule || {}), date, startTime, endTime };
        update.schedule = nextSchedule;
      }
    }

    await docRef.update(update);

    // Clear out previous worker's working-schedule entry for this request
    if (previousWorkerId) {
      await removeWorkerWorkingSchedule(
        previousWorkerId,
        requestId,
        FieldValue.serverTimestamp()
      );
      await recomputeWorkerPerformance(previousWorkerId);
    }

    // Re-attempt auto-assignment with the previous worker excluded
    const refreshed = await docRef.get();
    await attemptRequestAssignment(requestId, refreshed.data());

    res.json({
      message:
        "Request reposted. The previous worker will not be assigned again.",
    });
  } catch (error) {
    console.error("Repost request error:", error);
    res.status(500).json({ error: "Failed to repost request" });
  }
}

/**
 * POST /api/requests/:id/rate
 * Resident rates the worker
 */
export async function rateWorker(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const residentId = req.user!.uid;
  const body = req.body as RateWorkerInput;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.residentId !== residentId) {
      res.status(403).json({ error: "Only the resident can rate" });
      return;
    }

    if (data.status !== REQUEST_STATUSES.PAYMENT_CONFIRMED) {
      res.status(400).json({
        error: "Can only rate after payment is confirmed",
      });
      return;
    }

    if (getFiniteNumber(data.rating) !== undefined) {
      res.status(400).json({ error: "Worker has already been rated" });
      return;
    }

    if (!data.assignedWorkerId) {
      res.status(400).json({ error: "No worker assigned to this request" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await docRef.update({
      rating: body.rating,
      ratingComment: body.ratingComment || "",
      ratedAt: now,
      updatedAt: now,
    });

    await recomputeWorkerPerformance(data.assignedWorkerId);

    res.json({ message: "Rating submitted" });
  } catch (error) {
    console.error("Rate worker error:", error);
    res.status(500).json({ error: "Failed to rate worker" });
  }
}

/**
 * PATCH /api/requests/:id/schedule
 * Resident updates schedule for pending/assigned requests
 */
export async function updateSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const residentId = req.user!.uid;
  const body = req.body as UpdateScheduleInput;

  try {
    const docRef = requestsRef.doc(requestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const data = doc.data()!;

    if (data.residentId !== residentId) {
      res.status(403).json({ error: "Only the resident can update this request" });
      return;
    }

    const allowedStatuses = [REQUEST_STATUSES.PENDING, REQUEST_STATUSES.ASSIGNED];
    if (!allowedStatuses.includes(data.status)) {
      res.status(400).json({
        error: "Can only update schedule for pending or assigned requests",
      });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await docRef.update({
      schedule: {
        date: new Timestamp(new Date(body.schedule.date).getTime() / 1000, 0),
        startTime: body.schedule.startTime,
        endTime: body.schedule.endTime,
      },
      updatedAt: now,
    });

    // Fetch updated document for response
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data()!;

    // If still pending, attempt assignment with new schedule
    if (updatedData.status === REQUEST_STATUSES.PENDING) {
      await attemptRequestAssignment(requestId, updatedData);
    }

    const usersById = await fetchUsersByIds([data.residentId, data.assignedWorkerId]);
    const responseData = buildRequestResponse(requestId, updatedData, usersById);

    res.json({ request: responseData });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
}
