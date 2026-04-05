import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import admin from "../config/firebase";
import {
  REQUEST_STATUSES,
  PAYMENT_STATUSES,
  DEFAULT_COMMISSION_PERCENT,
} from "@tabang/shared";

interface SubmitPaymentBody {
  requestId: string;
  proofUrl: string;
}

const paymentsRef = db.collection("payments");
const requestsRef = db.collection("serviceRequests");

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
    // Get the request
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

    // Check no duplicate payment
    const existing = await paymentsRef
      .where("requestId", "==", body.requestId)
      .where("status", "!=", PAYMENT_STATUSES.REJECTED)
      .limit(1)
      .get();

    if (!existing.empty) {
      res.status(400).json({ error: "Payment already submitted for this request" });
      return;
    }

    const finalPrice = requestData.finalPrice || requestData.suggestedPrice;
    const commissionAmount = Math.round(
      finalPrice * (DEFAULT_COMMISSION_PERCENT / 100)
    );
    const totalAmount = finalPrice + commissionAmount;
    const barangaySharePercent = 100; // all commission goes to barangay
    const barangayShareAmount = commissionAmount;

    const now = admin.firestore.FieldValue.serverTimestamp();

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

    // Update request status
    await requestsRef.doc(body.requestId).update({
      status: REQUEST_STATUSES.PAYMENT_SUBMITTED,
      proofOfPaymentUrl: body.proofUrl,
      updatedAt: now,
    });

    // Notify admin
    const admins = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();
    for (const adminDoc of admins.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "payment_submitted",
        title: "Payment Proof Submitted",
        body: `Payment proof submitted for ${requestData.categoryName} — ₱${totalAmount}`,
        referenceType: "payment",
        referenceId: paymentRef.id,
        isRead: false,
        createdAt: now,
      });
    }

    await db.collection("systemLogs").add({
      action: "payment_submitted",
      performedBy: userId,
      targetRequestId: body.requestId,
      targetPaymentId: paymentRef.id,
      details: `Payment proof submitted: ₱${totalAmount}`,
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
      .orderBy("createdAt", "desc")
      .get();

    const payments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ payments });
  } catch (error) {
    console.error("Get pending payments error:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
}

/**
 * GET /api/payments/:id
 * Get single payment detail
 */
export async function getPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const paymentId = req.params.id as string;

  try {
    const doc = await paymentsRef.doc(paymentId).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    res.json({ payment: { id: doc.id, ...doc.data() } });
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    await paymentsRef.doc(paymentId).update({
      status: PAYMENT_STATUSES.CONFIRMED,
      confirmedBy: adminId,
      confirmedAt: now,
    });

    // Update request status
    await requestsRef.doc(payment.requestId).update({
      status: REQUEST_STATUSES.PAYMENT_CONFIRMED,
      updatedAt: now,
    });

    // Notify resident
    await db.collection("notifications").add({
      userId: payment.residentId,
      type: "payment_confirmed",
      title: "Payment Confirmed",
      body: "Your payment has been confirmed. You can now rate the worker.",
      referenceType: "payment",
      referenceId: paymentId,
      isRead: false,
      createdAt: now,
    });

    // Notify worker
    await db.collection("notifications").add({
      userId: payment.workerId,
      type: "payment_confirmed",
      title: "Payment Received",
      body: `Payment of ₱${payment.workerAmount} has been confirmed`,
      referenceType: "payment",
      referenceId: paymentId,
      isRead: false,
      createdAt: now,
    });

    await db.collection("systemLogs").add({
      action: "payment_confirmed",
      performedBy: adminId,
      targetPaymentId: paymentId,
      details: `Payment confirmed: ₱${payment.totalAmount}`,
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    await paymentsRef.doc(paymentId).update({
      status: PAYMENT_STATUSES.REJECTED,
      rejectedBy: adminId,
      rejectionReason: reason,
      rejectedAt: now,
    });

    // Revert request to completed so resident can resubmit
    await requestsRef.doc(payment.requestId).update({
      status: REQUEST_STATUSES.COMPLETED,
      updatedAt: now,
    });

    // Notify resident
    await db.collection("notifications").add({
      userId: payment.residentId,
      type: "payment_rejected",
      title: "Payment Rejected",
      body: `Your payment proof was rejected: ${reason}. Please resubmit.`,
      referenceType: "payment",
      referenceId: paymentId,
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
