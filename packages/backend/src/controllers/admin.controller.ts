import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import adminSDK from "../config/firebase";

const usersRef = db.collection("users");

/**
 * GET /api/admin/dashboard
 * Aggregated dashboard stats.
 */
export async function getDashboardStats(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [residents, workers, requests, disputes, payments] =
      await Promise.all([
        usersRef.where("role", "==", "resident").count().get(),
        usersRef.where("role", "==", "worker").count().get(),
        db.collection("serviceRequests").count().get(),
        db
          .collection("disputes")
          .where("status", "!=", "resolved")
          .count()
          .get(),
        db
          .collection("payments")
          .where("status", "==", "pending")
          .count()
          .get(),
      ]);

    // Pending worker verifications
    const pendingVerifications = await usersRef
      .where("role", "==", "worker")
      .where("isVerified", "==", false)
      .count()
      .get();

    // Active requests
    const activeRequests = await db
      .collection("serviceRequests")
      .where("status", "in", [
        "pending",
        "assigned",
        "accepted",
        "worker_arrived",
        "price_confirmed",
        "in_progress",
      ])
      .count()
      .get();

    // Completed jobs
    const completedJobs = await db
      .collection("serviceRequests")
      .where("status", "==", "payment_confirmed")
      .count()
      .get();

    res.json({
      totalResidents: residents.data().count,
      totalWorkers: workers.data().count,
      pendingVerifications: pendingVerifications.data().count,
      totalRequests: requests.data().count,
      activeRequests: activeRequests.data().count,
      completedJobs: completedJobs.data().count,
      pendingPayments: payments.data().count,
      openDisputes: disputes.data().count,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
}

/**
 * GET /api/admin/users
 * List all users with optional role filter.
 */
export async function listUsers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { role } = req.query;
    let query: FirebaseFirestore.Query = usersRef;

    if (role && typeof role === "string") {
      query = query.where("role", "==", role);
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        contactNumber: data.contactNumber,
        email: data.email,
        creditPoints: data.creditPoints,
        isVerified: data.isVerified,
        isActive: data.isActive,
        accountStatus: data.accountStatus,
        createdAt: data.createdAt,
      };
    });

    res.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Update user account status (active, suspended, banned).
 */
export async function updateUserStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { accountStatus, reason } = req.body;

  if (!["active", "suspended", "banned"].includes(accountStatus)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = adminSDK.firestore.FieldValue.serverTimestamp();
    await docRef.update({
      accountStatus,
      isActive: accountStatus === "active",
      updatedAt: now,
    });

    await db.collection("systemLogs").add({
      action: "user_status_changed",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Changed status to ${accountStatus}. Reason: ${reason || "N/A"}`,
      createdAt: now,
    });

    res.json({ message: `User status updated to ${accountStatus}` });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
}

/**
 * PATCH /api/admin/users/:id/credit
 * Adjust user credit points.
 */
export async function adjustCreditPoints(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { creditPoints, reason } = req.body;

  if (typeof creditPoints !== "number" || creditPoints < 1 || creditPoints > 5) {
    res.status(400).json({ error: "Credit points must be between 1 and 5" });
    return;
  }

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = adminSDK.firestore.FieldValue.serverTimestamp();
    const oldCredits = doc.data()!.creditPoints;

    await docRef.update({
      creditPoints,
      updatedAt: now,
    });

    // Auto-flag/suspend based on credit threshold
    if (creditPoints <= 2) {
      await docRef.update({ accountStatus: "suspended", isActive: false });
    } else if (creditPoints === 3 && oldCredits > 3) {
      // Flag — just log for now
      await db.collection("systemLogs").add({
        action: "user_flagged",
        performedBy: "system",
        targetUserId: id,
        details: `User credit dropped to ${creditPoints} — flagged for review`,
        createdAt: now,
      });
    }

    await db.collection("systemLogs").add({
      action: "credit_adjusted",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Credits changed from ${oldCredits} to ${creditPoints}. Reason: ${reason || "N/A"}`,
      createdAt: now,
    });

    res.json({ message: `Credit points updated to ${creditPoints}` });
  } catch (error) {
    console.error("Adjust credit error:", error);
    res.status(500).json({ error: "Failed to adjust credit points" });
  }
}

/**
 * GET /api/admin/config
 * Get system configuration.
 */
export async function getConfig(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [pricingDoc, generalDoc] = await Promise.all([
      db.collection("systemConfig").doc("pricing").get(),
      db.collection("systemConfig").doc("general").get(),
    ]);

    res.json({
      pricing: pricingDoc.exists ? pricingDoc.data() : null,
      general: generalDoc.exists ? generalDoc.data() : null,
    });
  } catch (error) {
    console.error("Get config error:", error);
    res.status(500).json({ error: "Failed to fetch config" });
  }
}

/**
 * PATCH /api/admin/config
 * Update system configuration.
 */
export async function updateConfig(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { pricing, general } = req.body;

  try {
    const batch = db.batch();

    if (pricing) {
      batch.set(
        db.collection("systemConfig").doc("pricing"),
        pricing,
        { merge: true }
      );
    }
    if (general) {
      batch.set(
        db.collection("systemConfig").doc("general"),
        general,
        { merge: true }
      );
    }

    await batch.commit();

    await db.collection("systemLogs").add({
      action: "config_updated",
      performedBy: req.user!.uid,
      details: "System configuration updated",
      createdAt: adminSDK.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Configuration updated" });
  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({ error: "Failed to update config" });
  }
}

/**
 * GET /api/admin/logs
 * Get system logs.
 */
export async function getSystemLogs(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const snapshot = await db
      .collection("systemLogs")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ logs });
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
}
