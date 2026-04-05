import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import admin from "../config/firebase";
import { CreateRequestInput, RateWorkerInput, REQUEST_STATUSES } from "@tabang/shared";
import { assignWorker } from "../services/assignment.service";
import {
  calculateCommission,
  calculateTotalForResident,
  validateFinalPrice,
  calculateCancellationPenalty,
} from "../services/pricing.service";

const requestsRef = db.collection("serviceRequests");

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
    // Get category and item details
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
      res.status(404).json({ error: "Category or item not found" });
      return;
    }

    const categoryData = categoryDoc.data()!;
    const itemData = itemDoc.data()!;

    // Validate suggested price >= minimum
    if (body.suggestedPrice < itemData.minPrice) {
      res.status(400).json({
        error: `Suggested price must be at least ₱${itemData.minPrice}`,
      });
      return;
    }

    // Get resident details
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data()!;

    const commission = calculateCommission(body.suggestedPrice);
    const totalForResident = calculateTotalForResident(body.suggestedPrice);

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Create the request
    const requestRef = await requestsRef.add({
      residentId: userId,
      residentName: `${userData.firstName} ${userData.lastName}`,
      residentContact: userData.contactNumber,
      categoryId: body.categoryId,
      categoryName: categoryData.name,
      itemId: body.itemId,
      itemName: itemData.name,
      description: body.description,
      photoUrls: body.photoUrls || [],
      suggestedPrice: body.suggestedPrice,
      minPrice: itemData.minPrice,
      commission,
      totalForResident,
      location: new admin.firestore.GeoPoint(
        body.location.latitude,
        body.location.longitude
      ),
      locationAddress: body.locationAddress || "",
      schedule: {
        date: new admin.firestore.Timestamp(
          new Date(body.schedule.date).getTime() / 1000,
          0
        ),
        startTime: body.schedule.startTime,
        endTime: body.schedule.endTime,
      },
      paymentMethod: body.paymentMethod,
      status: REQUEST_STATUSES.PENDING,
      assignmentAttempts: 0,
      priceOverrideRequired: false,
      isSpecialRequest: body.isSpecialRequest || false,
      specialRequestNote: body.specialRequestNote || "",
      createdAt: now,
      updatedAt: now,
    });

    // Log the action
    await db.collection("systemLogs").add({
      action: "request_created",
      performedBy: userId,
      targetRequestId: requestRef.id,
      details: `Service request created: ${categoryData.name} - ${itemData.name}`,
      createdAt: now,
    });

    // Trigger auto-assignment asynchronously (in production, use Cloud Function)
    // For now, we'll do it synchronously but in real world this should be a trigger
    setTimeout(async () => {
      const assignmentResult = await assignWorker(
        body.categoryId,
        body.location,
        body.schedule
      );

      if (assignmentResult.status === "assigned") {
        // Get worker name
        const workerDoc = await db
          .collection("users")
          .doc(assignmentResult.workerId!)
          .get();
        const workerData = workerDoc.data()!;

        // Update request with assignment
        await requestRef.update({
          status: REQUEST_STATUSES.ASSIGNED,
          assignedWorkerId: assignmentResult.workerId,
          assignedWorkerName: `${workerData.firstName} ${workerData.lastName}`,
          assignmentScore: assignmentResult.score,
          assignmentAttempts: 1,
          assignedAt: now,
          updatedAt: now,
        });

        // Update worker's lastAssignedAt
        await db
          .collection("users")
          .doc(assignmentResult.workerId!)
          .update({
            "workerData.lastAssignedAt": now,
          });

        // Create notification for worker
        await db.collection("notifications").add({
          userId: assignmentResult.workerId,
          type: "assignment",
          title: "New Job Assignment",
          body: `${categoryData.name}: ${itemData.name}`,
          referenceType: "request",
          referenceId: requestRef.id,
          isRead: false,
          createdAt: now,
        });
      } else {
        // Update to pending queue
        await requestRef.update({
          status: REQUEST_STATUSES.PENDING,
          updatedAt: now,
        });
      }
    }, 0);

    res.status(201).json({
      id: requestRef.id,
      status: REQUEST_STATUSES.PENDING,
      suggestedPrice: body.suggestedPrice,
      commission,
      totalForResident,
    });
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({ error: "Failed to create request" });
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
  const { status, role } = req.query;

  try {
    let query: FirebaseFirestore.Query = requestsRef;

    if (role === "resident") {
      query = query.where("residentId", "==", userId);
    } else if (role === "worker") {
      query = query.where("assignedWorkerId", "==", userId);
    }

    if (status && typeof status === "string") {
      query = query.where("status", "==", status);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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

    // Check access: owner, assigned worker, or admin
    if (
      userId !== data.residentId &&
      userId !== data.assignedWorkerId &&
      req.user!.role !== "admin"
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    res.json({ request: { id: doc.id, ...data } });
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.ACCEPTED,
      acceptedAt: now,
      updatedAt: now,
    });

    // Notify resident
    await db.collection("notifications").add({
      userId: data.residentId,
      type: "acceptance",
      title: "Worker Accepted",
      body: `${data.assignedWorkerName} accepted your request`,
      referenceType: "request",
      referenceId: requestId,
      isRead: false,
      createdAt: now,
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Reset to pending, will trigger reassignment
    await docRef.update({
      status: REQUEST_STATUSES.PENDING,
      assignedWorkerId: null,
      assignedWorkerName: null,
      assignmentAttempts: (data.assignmentAttempts || 0) + 1,
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.WORKER_ARRIVED,
      arrivedAt: now,
      updatedAt: now,
    });

    // Notify resident
    await db.collection("notifications").add({
      userId: data.residentId,
      type: "arrival",
      title: "Worker Has Arrived",
      body: `${data.assignedWorkerName} has arrived`,
      referenceType: "request",
      referenceId: requestId,
      isRead: false,
      createdAt: now,
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

    // Validate price
    const { isValid, requiresApproval } = validateFinalPrice(
      data.suggestedPrice,
      finalPrice
    );

    if (!isValid && !requiresApproval) {
      res.status(400).json({
        error: "Final price cannot be lower than suggested price",
      });
      return;
    }

    const commission = calculateCommission(finalPrice);
    const totalForResident = calculateTotalForResident(finalPrice);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const updateData: Record<string, any> = {
      finalPrice,
      commission,
      totalForResident,
      status: REQUEST_STATUSES.PRICE_CONFIRMED,
      priceConfirmedAt: now,
      updatedAt: now,
    };

    if (priceChangeReason) {
      updateData.priceChangeReason = priceChangeReason;
    }

    if (requiresApproval) {
      updateData.priceOverrideRequired = true;
      updateData.status = REQUEST_STATUSES.WORKER_ARRIVED; // Keep in arrived state pending approval
    }

    await docRef.update(updateData);

    res.json({
      finalPrice,
      commission,
      totalForResident,
      requiresAdminApproval: requiresApproval,
    });
  } catch (error) {
    console.error("Set final price error:", error);
    res.status(500).json({ error: "Failed to set final price" });
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

    if (data.status !== REQUEST_STATUSES.PRICE_CONFIRMED) {
      res.status(400).json({ error: "Price must be confirmed first" });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update({
      status: REQUEST_STATUSES.COMPLETED,
      proofOfWorkPhotoUrls: proofOfWorkPhotoUrls || [],
      completedAt: now,
      updatedAt: now,
    });

    // Update worker's completed jobs count
    const workerDoc = await db.collection("users").doc(workerId).get();
    const workerData = workerDoc.data()!;
    const newCount = (workerData.workerData?.completedJobsCount || 0) + 1;

    await db.collection("users").doc(workerId).update({
      "workerData.completedJobsCount": newCount,
    });

    // Notify resident
    await db.collection("notifications").add({
      userId: data.residentId,
      type: "system",
      title: "Job Completed",
      body: `${data.assignedWorkerName} completed the work`,
      referenceType: "request",
      referenceId: requestId,
      isRead: false,
      createdAt: now,
    });

    res.json({ message: "Job completed" });
  } catch (error) {
    console.error("Complete request error:", error);
    res.status(500).json({ error: "Failed to complete request" });
  }
}

/**
 * PATCH /api/requests/:id/cancel
 * Cancel a request (resident or worker)
 */
export async function cancelRequest(
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

    // Only resident or assigned worker can cancel
    if (userId !== data.residentId && userId !== data.assignedWorkerId) {
      res.status(403).json({ error: "Cannot cancel this request" });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    let cancellationPenalty = 0;

    // Apply 20% penalty if worker has already arrived
    if (
      data.status === REQUEST_STATUSES.WORKER_ARRIVED ||
      data.status === REQUEST_STATUSES.PRICE_CONFIRMED ||
      data.status === REQUEST_STATUSES.IN_PROGRESS
    ) {
      cancellationPenalty = calculateCancellationPenalty(
        data.finalPrice || data.suggestedPrice
      );
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update({
      rating: body.rating,
      ratingComment: body.ratingComment || "",
      updatedAt: now,
    });

    // Update worker's average rating (denormalization)
    const workerId = data.assignedWorkerId;
    const workerDoc = await db.collection("users").doc(workerId).get();
    const workerData = workerDoc.data()!;

    const currentTotal =
      (workerData.workerData?.averageRating || 0) *
      (workerData.workerData?.completedJobsCount || 0);
    const newAverage = (currentTotal + body.rating) / (workerData.workerData?.completedJobsCount || 1);

    await db.collection("users").doc(workerId).update({
      "workerData.averageRating": Math.round(newAverage * 10) / 10,
    });

    res.json({ message: "Rating submitted" });
  } catch (error) {
    console.error("Rate worker error:", error);
    res.status(500).json({ error: "Failed to rate worker" });
  }
}
