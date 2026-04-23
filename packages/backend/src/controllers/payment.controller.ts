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

interface SubmitPaymentBody {
  requestId: string;
  proofUrl: string;
  rating: number;
  ratingComment?: string;
}

const paymentsRef = db.collection("payments");
const requestsRef = db.collection("serviceRequests");

type PaymentListItem = FirebaseFirestore.DocumentData & {
  id: string;
  createdAt?: unknown;
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

    // Recalculate worker's average rating if a new rating was added
    if (body.rating && !requestData.rating) {
      const workerId = requestData.assignedWorkerId;
      if (workerId) {
        try {
          const ratedRequests = await requestsRef
            .where("assignedWorkerId", "==", workerId)
            .where("rating", ">", 0)
            .get();

          if (!ratedRequests.empty) {
            const ratings = ratedRequests.docs.map((doc) => {
              const data = doc.data();
              return typeof data.rating === "number" ? data.rating : 0;
            });
            const sum = ratings.reduce((a, b) => a + b, 0);
            const average =
              Math.round((sum / ratings.length) * 10) / 10;

            await db.collection("users").doc(workerId).update({
              "workerData.averageRating": average,
            });
          }
        } catch (ratingError) {
          console.warn("Warning: Failed to update worker average rating:", ratingError);
          // Don't fail the payment submission if rating update fails
        }
      }
    }

    const admins = await db.collection("users").where("role", "==", "admin").get();
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

    const payments: PaymentListItem[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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

    if (role !== "admin" && payment.residentId !== uid && payment.workerId !== uid) {
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
