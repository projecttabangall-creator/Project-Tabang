import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { PAYMENT_STATUSES, REQUEST_STATUSES } from "@tabang/shared";
import {
  calculateCommission,
  calculateTotalForResident,
  getCommissionPercent,
} from "../services/pricing.service";
import { recomputeWorkerPerformance } from "../services/workerPerformance.service";
import { createSurveysForPayment } from "./feedbackSurvey.controller";

interface SubmitPaymentBody {
  requestId: string;
  proofUrl: string;
  rating: number;
  ratingComment?: string;
}

const paymentsRef = db.collection("payments");
const requestsRef = db.collection("serviceRequests");
const usersRef = db.collection("users");

type PaymentListItem = FirebaseFirestore.DocumentData & {
  id: string;
  createdAt?: unknown;
};

type PaymentPartySummary = {
  userId: string;
  fullName: string;
  role: string;
  contactNumber: string;
};

type PaymentRequestSummary = {
  id: string;
  categoryName: string;
  description: string;
  status: string;
  locationAddress: string;
  beneficiaryName: string;
  finalPrice: number | null;
  totalForResident: number | null;
  commission: number | null;
  paymentMethod: string;
  rating: number | null;
  ratingComment: string;
  createdAt: unknown;
  completedAt: unknown;
};

function timestampMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  return 0;
}

function buildPartySummary(
  userId: string,
  data: FirebaseFirestore.DocumentData | undefined
): PaymentPartySummary {
  const firstName =
    typeof data?.firstName === "string" ? data.firstName.trim() : "";
  const lastName =
    typeof data?.lastName === "string" ? data.lastName.trim() : "";

  return {
    userId,
    fullName: `${firstName} ${lastName}`.trim() || `User ${userId.slice(-6)}`,
    role: typeof data?.role === "string" ? data.role : "unknown",
    contactNumber:
      typeof data?.contactNumber === "string" ? data.contactNumber : "",
  };
}

function buildRequestSummary(
  requestId: string,
  data: FirebaseFirestore.DocumentData | undefined
): PaymentRequestSummary {
  return {
    id: requestId,
    categoryName:
      typeof data?.categoryName === "string" ? data.categoryName : "",
    description:
      typeof data?.description === "string" ? data.description : "",
    status: typeof data?.status === "string" ? data.status : "",
    locationAddress:
      typeof data?.locationAddress === "string" ? data.locationAddress : "",
    beneficiaryName:
      typeof data?.beneficiaryName === "string" ? data.beneficiaryName : "",
    finalPrice: typeof data?.finalPrice === "number" ? data.finalPrice : null,
    totalForResident:
      typeof data?.totalForResident === "number" ? data.totalForResident : null,
    commission: typeof data?.commission === "number" ? data.commission : null,
    paymentMethod:
      typeof data?.paymentMethod === "string" ? data.paymentMethod : "",
    rating: typeof data?.rating === "number" ? data.rating : null,
    ratingComment:
      typeof data?.ratingComment === "string" ? data.ratingComment : "",
    createdAt: data?.createdAt ?? null,
    completedAt: data?.completedAt ?? null,
  };
}

/**
 * POST /api/payments
 * Resident submits proof of payment
 */
export async function submitPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.uid;
  const body = req.body as SubmitPaymentBody;

  try {
    const requestDoc = await requestsRef.doc(body.requestId).get();
    if (!requestDoc.exists) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const requestData = requestDoc.data()!;

    if (requestData.residentId !== userId) {
      res.status(403).json({ error: "Only the resident can submit payment" });
      return;
    }

    if (requestData.status !== REQUEST_STATUSES.COMPLETED) {
      res.status(400).json({ error: "Job must be completed before payment" });
      return;
    }

    const existing = await paymentsRef
      .where("requestId", "==", body.requestId)
      .get();

    const hasActivePayment = existing.docs.some(
      (doc) => doc.data().status !== PAYMENT_STATUSES.REJECTED
    );

    if (hasActivePayment) {
      res.status(400).json({ error: "Payment already submitted for this request" });
      return;
    }

    const commissionPercent =
      typeof requestData.commissionPercent === "number"
        ? requestData.commissionPercent
        : await getCommissionPercent();
    const finalPrice =
      typeof requestData.finalPrice === "number"
        ? requestData.finalPrice
        : requestData.suggestedPrice;
    const commissionAmount =
      typeof requestData.commission === "number"
        ? requestData.commission
        : calculateCommission(finalPrice, commissionPercent);
    const totalAmount =
      typeof requestData.totalForResident === "number"
        ? requestData.totalForResident
        : calculateTotalForResident(finalPrice, commissionPercent);
    const barangaySharePercent = commissionPercent;
    const barangayShareAmount = commissionAmount;

    const now = FieldValue.serverTimestamp();

    const paymentRef = await paymentsRef.add({
      requestId: body.requestId,
      residentId: userId,
      workerId: requestData.assignedWorkerId,
      workerAmount: finalPrice,
      commissionAmount,
      totalAmount,
      barangaySharePercent,
      barangayShareAmount,
      paymentMethod: requestData.paymentMethod,
      proofUrl: body.proofUrl,
      status: PAYMENT_STATUSES.PENDING,
      createdAt: now,
    });

    // Update request status and proof, and add rating if provided
    const requestUpdate: any = {
      status: REQUEST_STATUSES.PAYMENT_SUBMITTED,
      proofOfPaymentUrl: body.proofUrl,
      updatedAt: now,
    };

    // Add rating if provided and not already rated
    if (body.rating && !requestData.rating) {
      requestUpdate.rating = body.rating;
      requestUpdate.ratingComment = body.ratingComment || "";
      requestUpdate.ratedAt = now;
    }

    await requestsRef.doc(body.requestId).update(requestUpdate);

    const admins = await db
      .collection("users")
      .where("role", "in", ["admin", "superadmin"])
      .get();
    for (const adminDoc of admins.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "payment_submitted",
        title: "Payment Proof Submitted",
        body: `Payment proof submitted for ${requestData.categoryName} - PHP ${totalAmount}`,
        referenceType: "request",
        referenceId: body.requestId,
        isRead: false,
        createdAt: now,
      });
    }

    await db.collection("systemLogs").add({
      action: "payment_submitted",
      performedBy: userId,
      targetRequestId: body.requestId,
      targetPaymentId: paymentRef.id,
      details: `Payment proof submitted: PHP ${totalAmount}`,
      createdAt: now,
    });

    res.status(201).json({
      id: paymentRef.id,
      totalAmount,
      workerAmount: finalPrice,
      commissionAmount,
      status: PAYMENT_STATUSES.PENDING,
    });
  } catch (error) {
    console.error("Submit payment error:", error);
    res.status(500).json({ error: "Failed to submit payment" });
  }
}

/**
 * GET /api/payments/pending
 * Admin lists payments pending review
 */
export async function getPendingPayments(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const snapshot = await paymentsRef
      .where("status", "==", PAYMENT_STATUSES.PENDING)
      .get();

    const rawPayments: PaymentListItem[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const requestIds = Array.from(
      new Set(
        rawPayments
          .map((payment) => payment.requestId)
          .filter((requestId): requestId is string => typeof requestId === "string")
      )
    );
    const requestDocs = await Promise.all(
      requestIds.map((requestId) => requestsRef.doc(requestId).get())
    );
    const requestMap = new Map(
      requestDocs.map((doc) => [doc.id, doc.exists ? doc.data() : undefined])
    );

    const userIds = Array.from(
      new Set(
        rawPayments.flatMap((payment) =>
          [payment.residentId, payment.workerId].filter(
            (userId): userId is string => typeof userId === "string"
          )
        )
      )
    );
    const userDocs = await Promise.all(
      userIds.map((userId) => usersRef.doc(userId).get())
    );
    const userMap = new Map(
      userDocs.map((doc) => [doc.id, doc.exists ? doc.data() : undefined])
    );

    const payments = rawPayments.map((payment) => ({
      ...payment,
      resident: buildPartySummary(
        payment.residentId,
        userMap.get(payment.residentId)
      ),
      worker: buildPartySummary(payment.workerId, userMap.get(payment.workerId)),
      request: buildRequestSummary(
        payment.requestId,
        requestMap.get(payment.requestId)
      ),
    }));

    payments.sort(
      (a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt)
    );

    res.json({ payments });
  } catch (error) {
    console.error("Get pending payments error:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
}

/**
 * GET /api/payments/:id
 * Get single payment detail — admin always allowed; resident/worker only if they own the payment.
 */
export async function getPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const paymentId = req.params.id as string;
  const { uid, role } = req.user!;

  try {
    const doc = await paymentsRef.doc(paymentId).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    const payment = doc.data()!;

    if (role !== "admin" && role !== "superadmin" && payment.residentId !== uid && payment.workerId !== uid) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    res.json({ payment: { id: doc.id, ...payment } });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
}

/**
 * PATCH /api/payments/:id/confirm
 * Admin confirms payment
 */
export async function confirmPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const paymentId = req.params.id as string;
  const adminId = req.user!.uid;

  try {
    const paymentDoc = await paymentsRef.doc(paymentId).get();
    if (!paymentDoc.exists) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    const payment = paymentDoc.data()!;

    if (payment.status !== PAYMENT_STATUSES.PENDING) {
      res.status(400).json({ error: "Payment is not pending" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await paymentsRef.doc(paymentId).update({
      status: PAYMENT_STATUSES.CONFIRMED,
      confirmedBy: adminId,
      confirmedAt: now,
    });

    await requestsRef.doc(payment.requestId).update({
      status: REQUEST_STATUSES.PAYMENT_CONFIRMED,
      updatedAt: now,
    });

    if (payment.workerId) {
      await recomputeWorkerPerformance(payment.workerId);
    }

    await db.collection("notifications").add({
      userId: payment.residentId,
      type: "payment_confirmed",
      title: "Payment Confirmed",
      body: "Your payment has been confirmed. You can now rate the worker.",
      referenceType: "request",
      referenceId: payment.requestId,
      isRead: false,
      createdAt: now,
    });

    await db.collection("notifications").add({
      userId: payment.workerId,
      type: "payment_confirmed",
      title: "Payment Received",
      body: `Payment of PHP ${payment.workerAmount} has been confirmed`,
      referenceType: "request",
      referenceId: payment.requestId,
      isRead: false,
      createdAt: now,
    });

    await db.collection("systemLogs").add({
      action: "payment_confirmed",
      performedBy: adminId,
      targetPaymentId: paymentId,
      details: `Payment confirmed: PHP ${payment.totalAmount}`,
      createdAt: now,
    });

    // Send the post-payment feedback survey to the resident & worker
    try {
      const requestSnap = await requestsRef.doc(payment.requestId).get();
      const requestData = requestSnap.exists ? requestSnap.data()! : {};
      await createSurveysForPayment({
        requestId: payment.requestId,
        paymentId,
        residentId: payment.residentId,
        workerId: payment.workerId,
        categoryName:
          typeof requestData?.categoryName === "string"
            ? requestData.categoryName
            : "",
        finalPrice:
          typeof payment.workerAmount === "number" ? payment.workerAmount : undefined,
      });
    } catch (surveyError) {
      console.error("Failed to create feedback surveys:", surveyError);
    }

    res.json({ message: "Payment confirmed" });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
}

/**
 * PATCH /api/payments/:id/reject
 * Admin rejects payment proof
 */
export async function rejectPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const paymentId = req.params.id as string;
  const adminId = req.user!.uid;
  const { reason } = req.body;

  try {
    const paymentDoc = await paymentsRef.doc(paymentId).get();
    if (!paymentDoc.exists) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    const payment = paymentDoc.data()!;

    if (payment.status !== PAYMENT_STATUSES.PENDING) {
      res.status(400).json({ error: "Payment is not pending" });
      return;
    }

    const now = FieldValue.serverTimestamp();

    await paymentsRef.doc(paymentId).update({
      status: PAYMENT_STATUSES.REJECTED,
      rejectedBy: adminId,
      rejectionReason: reason,
      rejectedAt: now,
    });

    await requestsRef.doc(payment.requestId).update({
      status: REQUEST_STATUSES.COMPLETED,
      updatedAt: now,
    });

    if (payment.workerId) {
      await recomputeWorkerPerformance(payment.workerId);
    }

    await db.collection("notifications").add({
      userId: payment.residentId,
      type: "payment_rejected",
      title: "Payment Rejected",
      body: `Your payment proof was rejected: ${reason}. Please resubmit.`,
      referenceType: "request",
      referenceId: payment.requestId,
      isRead: false,
      createdAt: now,
    });

    await db.collection("systemLogs").add({
      action: "payment_rejected",
      performedBy: adminId,
      targetPaymentId: paymentId,
      details: `Payment rejected: ${reason}`,
      createdAt: now,
    });

    res.json({ message: "Payment rejected" });
  } catch (error) {
    console.error("Reject payment error:", error);
    res.status(500).json({ error: "Failed to reject payment" });
  }
}
