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
  SpecialRequestInput,
} from "@tabang/shared";
import {
  calculateCancellationPenalty,
  calculateCommission,
  calculateTotalForResident,
  getCommissionPercent,
  validateFinalPrice,
} from "../services/pricing.service";

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

    const data = doc.data()!;

    if (
      userId !== data.residentId &&
      userId !== data.assignedWorkerId &&
      req.user!.role !== "admin"
    ) {
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
      status: REQUEST_STATUSES.ACCEPTED,
      acceptedAt: now,
      updatedAt: now,
    });

    res.json({ message: "Request accepted" });
  } catch (error) {
    console.error("Accept request error:", error);
    res.status(500).json({ error: "Failed to accept request" });
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
  const { finalPrice, priceChangeReason } = req.body;

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
        updatedAt: now,
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
      status: REQUEST_STATUSES.IN_PROGRESS,
      priceConfirmedAt: now,
      updatedAt: now,
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

    const workerDoc = await usersRef.doc(workerId).get();
    const workerData = workerDoc.data()!;
    const newCount = (workerData.workerData?.completedJobsCount || 0) + 1;

    await usersRef.doc(workerId).update({
      "workerData.completedJobsCount": newCount,
    });

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

    await docRef.update({
      status: REQUEST_STATUSES.CANCELLED,
      cancelledBy: userId,
      cancelledAt: now,
      cancellationPenalty,
      updatedAt: now,
    });

    res.json({ message: "Request cancelled", cancellationPenalty });
  } catch (error) {
    console.error("Cancel request error:", error);
    res.status(500).json({ error: "Failed to cancel request" });
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

    const ratedRequests = await requestsRef
      .where("assignedWorkerId", "==", data.assignedWorkerId)
      .get();

    const ratings = ratedRequests.docs
      .map((requestDoc) => getFiniteNumber(requestDoc.data().rating))
      .filter((rating): rating is number => rating !== undefined);

    const newAverage =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) *
              10
          ) / 10
        : 0;

    await usersRef.doc(data.assignedWorkerId).update({
      "workerData.averageRating": newAverage,
    });

    res.json({ message: "Rating submitted" });
  } catch (error) {
    console.error("Rate worker error:", error);
    res.status(500).json({ error: "Failed to rate worker" });
  }
}
