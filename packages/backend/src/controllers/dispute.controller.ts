import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db, storage } from "../config/firebase";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  DEFAULT_COMMISSION_PERCENT,
  DISPUTE_DEADLINE_HOURS,
  DISPUTE_FILING_WINDOW_HOURS,
  DISPUTE_STATUSES,
  REQUEST_STATUSES,
} from "@tabang/shared";
import { deductCredits } from "../services/credit.service";
import {
  calculateCommission,
  calculateTotalForResident,
} from "../services/pricing.service";

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

const disputesRef = db.collection("disputes");
const requestsRef = db.collection("serviceRequests");

function toDate(value: any): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function canFileDispute(requestData: FirebaseFirestore.DocumentData): {
  allowed: boolean;
  error?: string;
} {
  if (
    [
      REQUEST_STATUSES.IN_PROGRESS,
      REQUEST_STATUSES.PRICE_CONFIRMED,
    ].includes(requestData.status)
  ) {
    return { allowed: true };
  }

  if (
    [
      REQUEST_STATUSES.COMPLETED,
      REQUEST_STATUSES.PAYMENT_SUBMITTED,
      REQUEST_STATUSES.PAYMENT_CONFIRMED,
    ].includes(requestData.status)
  ) {
    const completedAt = toDate(requestData.completedAt);
    if (!completedAt) {
      return {
        allowed: false,
        error: "Completed timestamp is missing for this request",
      };
    }

    const deadline = new Date(
      completedAt.getTime() + DISPUTE_FILING_WINDOW_HOURS * 60 * 60 * 1000
    );

    if (new Date() > deadline) {
      return {
        allowed: false,
        error: "Disputes must be filed within 24 hours of completion",
      };
    }

    return { allowed: true };
  }

  return {
    allowed: false,
    error: "Disputes can only be filed during active work or within 24 hours of completion",
  };
}

/**
 * Upload base64 evidence files to Firebase Storage and return download URLs
 */
async function uploadEvidenceFiles(
  files: string[],
  requestId: string
): Promise<string[]> {
  const bucket = storage.bucket("project-tabang---claude-code.appspot.com");
  return Promise.all(
    files.map(async (dataUrl, i) => {
      // If already a real URL (not base64), pass through
      if (!dataUrl.startsWith("data:")) {
        return dataUrl;
      }

      try {
        // Parse data URL
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn(`Invalid base64 format for evidence ${i}`);
          return "";
        }

        const mimeType = matches[1];
        const base64String = matches[2];
        const ext = mimeType.split("/")[1] ?? "jpg";
        const filename = `disputes/${requestId}/evidence/${Date.now()}_${i}.${ext}`;

        const file = bucket.file(filename);
        await file.save(Buffer.from(base64String, "base64"), {
          contentType: mimeType,
        });

        // Make file publicly readable
        await file.makePublic();

        // Get the public URL
        return file.publicUrl();
      } catch (error) {
        console.error(`Failed to upload evidence file ${i}:`, error);
        return "";
      }
    })
  );
}

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
    const requestDoc = await requestsRef.doc(body.requestId).get();
    if (!requestDoc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const requestData = requestDoc.data()!;

    const isResident = requestData.residentId === userId;
    const isWorker = requestData.assignedWorkerId === userId;
    if (!isResident && !isWorker) {
      res.status(403).json({ error: "You are not part of this request" });
      return;
    }

    const disputeEligibility = canFileDispute(requestData);
    if (!disputeEligibility.allowed) {
      res.status(400).json({
        error: disputeEligibility.error || "This request cannot be disputed at this stage",
      });
      return;
    }

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

    // Upload evidence files to Firebase Storage if any provided
    const uploadedUrls = body.evidenceUrls?.length
      ? (await uploadEvidenceFiles(body.evidenceUrls, body.requestId)).filter(
          (url) => url // Filter out empty strings from failed uploads
        )
      : [];

    const disputeRef = await disputesRef.add({
      requestId: body.requestId,
      filedBy: userId,
      filedAgainst,
      disputeType: body.disputeType,
      description: body.description,
      evidenceUrls: uploadedUrls,
      status: DISPUTE_STATUSES.OPEN,
      creditDeductions: [],
      createdAt: FieldValue.serverTimestamp(),
      deadline: Timestamp.fromDate(deadline),
    });

    await requestsRef.doc(body.requestId).update({
      status: REQUEST_STATUSES.UNDER_DISPUTE,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const admins = await db.collection("users").where("role", "==", "admin").get();
    for (const adminDoc of admins.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "dispute_filed",
        title: "New Dispute Filed",
        body: `${body.disputeType.replace(/_/g, " ")} dispute for ${requestData.categoryName}`,
        referenceType: "dispute",
        referenceId: disputeRef.id,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await db.collection("notifications").add({
      userId: filedAgainst,
      type: "dispute_filed",
      title: "Dispute Filed Against You",
      body: `A ${body.disputeType.replace(/_/g, " ")} dispute has been filed`,
      referenceType: "dispute",
      referenceId: disputeRef.id,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "dispute_filed",
      performedBy: userId,
      targetRequestId: body.requestId,
      targetDisputeId: disputeRef.id,
      details: `Dispute filed: ${body.disputeType} - ${body.description.slice(0, 100)}`,
      createdAt: FieldValue.serverTimestamp(),
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

    if (
      userId !== data.filedBy &&
      userId !== data.filedAgainst &&
      req.user!.role !== "admin"
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

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

    const now = FieldValue.serverTimestamp();
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

    await disputesRef.doc(disputeId).update({
      status: DISPUTE_STATUSES.RESOLVED,
      resolution: body.resolution,
      resolutionNotes: body.resolutionNotes,
      priceAdjustment: body.priceAdjustment ?? null,
      creditDeductions: body.creditDeductions,
      resolvedBy: adminId,
      resolvedAt: now,
    });

    let restoreStatus: string = REQUEST_STATUSES.RESOLVED;
    if (body.priceAdjustment !== undefined) {
      const requestDoc = await requestsRef.doc(dispute.requestId).get();
      const requestData = requestDoc.data() || {};
      const commissionPercent =
        typeof requestData.commissionPercent === "number"
          ? requestData.commissionPercent
          : DEFAULT_COMMISSION_PERCENT;

      await requestsRef.doc(dispute.requestId).update({
        status: REQUEST_STATUSES.COMPLETED,
        finalPrice: body.priceAdjustment,
        commission: calculateCommission(body.priceAdjustment, commissionPercent),
        totalForResident: calculateTotalForResident(
          body.priceAdjustment,
          commissionPercent
        ),
        priceOverrideRequired: false,
        updatedAt: now,
      });
      restoreStatus = REQUEST_STATUSES.COMPLETED;
    } else {
      await requestsRef.doc(dispute.requestId).update({
        status: REQUEST_STATUSES.RESOLVED,
        updatedAt: now,
      });
    }

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
