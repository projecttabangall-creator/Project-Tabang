import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import admin from "../config/firebase";
import {
  REQUEST_STATUSES,
  DISPUTE_STATUSES,
  DISPUTE_DEADLINE_HOURS,
} from "@tabang/shared";

interface FileDisputeBody {
  requestId: string;
  disputeType: string;
  description: string;
  evidenceUrls?: string[];
}

interface ResolveDisputeBody {
  resolution: string;
  resolutionNotes: string;
  priceAdjustment?: number;
  creditDeductions: Array<{ userId: string; amount: number }>;
}
import { deductCredits, restoreCredits } from "../services/credit.service";

const disputesRef = db.collection("disputes");
const requestsRef = db.collection("serviceRequests");

/**
 * POST /api/disputes
 * File a dispute (resident or worker)
 */
export async function fileDispute(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.uid;
  const body = req.body as FileDisputeBody;

  try {
    // Get the request
    const requestDoc = await requestsRef.doc(body.requestId).get();
    if (!requestDoc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const requestData = requestDoc.data()!;

    // Verify the user is part of the request
    const isResident = requestData.residentId === userId;
    const isWorker = requestData.assignedWorkerId === userId;
    if (!isResident && !isWorker) {
      res.status(403).json({ error: "You are not part of this request" });
      return;
    }

    // Check request is in a disputable state
    const disputableStatuses = [
      REQUEST_STATUSES.WORKER_ARRIVED,
      REQUEST_STATUSES.PRICE_CONFIRMED,
      REQUEST_STATUSES.IN_PROGRESS,
      REQUEST_STATUSES.COMPLETED,
      REQUEST_STATUSES.PAYMENT_SUBMITTED,
      REQUEST_STATUSES.PAYMENT_CONFIRMED,
    ];

    if (!disputableStatuses.includes(requestData.status)) {
      res.status(400).json({ error: "This request cannot be disputed at this stage" });
      return;
    }

    // Check for existing open dispute
    const existingDispute = await disputesRef
      .where("requestId", "==", body.requestId)
      .where("status", "!=", DISPUTE_STATUSES.RESOLVED)
      .limit(1)
      .get();

    if (!existingDispute.empty) {
      res.status(400).json({ error: "A dispute is already open for this request" });
      return;
    }

    const filedAgainst = isResident
      ? requestData.assignedWorkerId
      : requestData.residentId;

    const now = new Date();
    const deadline = new Date(
      now.getTime() + DISPUTE_DEADLINE_HOURS * 60 * 60 * 1000
    );

    const disputeRef = await disputesRef.add({
      requestId: body.requestId,
      filedBy: userId,
      filedAgainst,
      disputeType: body.disputeType,
      description: body.description,
      evidenceUrls: body.evidenceUrls || [],
      status: DISPUTE_STATUSES.OPEN,
      creditDeductions: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deadline: admin.firestore.Timestamp.fromDate(deadline),
    });

    // Update request status to under_dispute
    await requestsRef.doc(body.requestId).update({
      status: REQUEST_STATUSES.UNDER_DISPUTE,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify admin
    const admins = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();
    for (const adminDoc of admins.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "dispute_filed",
        title: "New Dispute Filed",
        body: `${body.disputeType.replace(/_/g, " ")} dispute for ${requestData.categoryName}`,
        referenceType: "dispute",
        referenceId: disputeRef.id,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Notify the other party
    await db.collection("notifications").add({
      userId: filedAgainst,
      type: "dispute_filed",
      title: "Dispute Filed Against You",
      body: `A ${body.disputeType.replace(/_/g, " ")} dispute has been filed`,
      referenceType: "dispute",
      referenceId: disputeRef.id,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "dispute_filed",
      performedBy: userId,
      targetRequestId: body.requestId,
      targetDisputeId: disputeRef.id,
      details: `Dispute filed: ${body.disputeType} — ${body.description.slice(0, 100)}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      id: disputeRef.id,
      status: DISPUTE_STATUSES.OPEN,
      deadline: deadline.toISOString(),
    });
  } catch (error) {
    console.error("File dispute error:", error);
    res.status(500).json({ error: "Failed to file dispute" });
  }
}

/**
 * GET /api/disputes
 * List all disputes (admin only)
 */
export async function listDisputes(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { status } = req.query;

    let query: FirebaseFirestore.Query = disputesRef.orderBy("createdAt", "desc");

    if (status && typeof status === "string") {
      query = disputesRef
        .where("status", "==", status)
        .orderBy("createdAt", "desc");
    }

    const snapshot = await query.get();
    const disputes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ disputes });
  } catch (error) {
    console.error("List disputes error:", error);
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
}

/**
 * GET /api/disputes/:id
 * Get dispute detail
 */
export async function getDispute(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const disputeId = req.params.id as string;
  const userId = req.user!.uid;

  try {
    const doc = await disputesRef.doc(disputeId).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }

    const data = doc.data()!;

    // Access control: involved parties or admin
    if (
      userId !== data.filedBy &&
      userId !== data.filedAgainst &&
      req.user!.role !== "admin"
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Get the linked request data for context
    const requestDoc = await requestsRef.doc(data.requestId).get();
    const requestData = requestDoc.exists ? requestDoc.data() : null;

    res.json({
      dispute: { id: doc.id, ...data },
      request: requestData ? { id: requestDoc.id, ...requestData } : null,
    });
  } catch (error) {
    console.error("Get dispute error:", error);
    res.status(500).json({ error: "Failed to fetch dispute" });
  }
}

/**
 * PATCH /api/disputes/:id/resolve
 * Admin resolves a dispute
 */
export async function resolveDispute(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const disputeId = req.params.id as string;
  const adminId = req.user!.uid;
  const body = req.body as ResolveDisputeBody;

  try {
    const disputeDoc = await disputesRef.doc(disputeId).get();
    if (!disputeDoc.exists) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }

    const dispute = disputeDoc.data()!;

    if (dispute.status === DISPUTE_STATUSES.RESOLVED) {
      res.status(400).json({ error: "Dispute is already resolved" });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Apply credit deductions
    const deductionResults: Array<{
      userId: string;
      amount: number;
      newBalance: number;
      suspended: boolean;
    }> = [];

    for (const deduction of body.creditDeductions) {
      const result = await deductCredits(
        deduction.userId,
        deduction.amount,
        `Dispute ${disputeId} resolved: ${body.resolution}`
      );
      deductionResults.push({
        userId: deduction.userId,
        amount: deduction.amount,
        newBalance: result.newBalance,
        suspended: result.suspended,
      });
    }

    // Update dispute
    await disputesRef.doc(disputeId).update({
      status: DISPUTE_STATUSES.RESOLVED,
      resolution: body.resolution,
      resolutionNotes: body.resolutionNotes,
      priceAdjustment: body.priceAdjustment || null,
      creditDeductions: body.creditDeductions,
      resolvedBy: adminId,
      resolvedAt: now,
    });

    // Determine what status to restore the request to
    let restoreStatus: string = REQUEST_STATUSES.RESOLVED;
    if (body.priceAdjustment !== undefined) {
      // Price was adjusted — mark request as completed again so payment can proceed
      await requestsRef.doc(dispute.requestId).update({
        status: REQUEST_STATUSES.COMPLETED,
        finalPrice: body.priceAdjustment,
        updatedAt: now,
      });
      restoreStatus = REQUEST_STATUSES.COMPLETED;
    } else {
      await requestsRef.doc(dispute.requestId).update({
        status: REQUEST_STATUSES.RESOLVED,
        updatedAt: now,
      });
    }

    // Notify both parties
    const notifyUsers = [dispute.filedBy, dispute.filedAgainst];
    for (const uid of notifyUsers) {
      await db.collection("notifications").add({
        userId: uid,
        type: "dispute_resolved",
        title: "Dispute Resolved",
        body: `Dispute has been resolved: ${body.resolution.replace(/_/g, " ")}`,
        referenceType: "dispute",
        referenceId: disputeId,
        isRead: false,
        createdAt: now,
      });
    }

    await db.collection("systemLogs").add({
      action: "dispute_resolved",
      performedBy: adminId,
      targetDisputeId: disputeId,
      details: `Dispute resolved: ${body.resolution}. Notes: ${body.resolutionNotes}. Deductions: ${JSON.stringify(deductionResults)}`,
      createdAt: now,
    });

    res.json({
      message: "Dispute resolved",
      resolution: body.resolution,
      requestStatus: restoreStatus,
      deductionResults,
    });
  } catch (error) {
    console.error("Resolve dispute error:", error);
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
}
