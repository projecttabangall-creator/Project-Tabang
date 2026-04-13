import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

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
    const [residentSnapshot, workerSnapshot, requestSnapshot, disputeSnapshot, paymentSnapshot] =
      await Promise.all([
        usersRef.where("role", "==", "resident").get(),
        usersRef.where("role", "==", "worker").get(),
        db.collection("serviceRequests").get(),
        db.collection("disputes").get(),
        db.collection("payments").get(),
      ]);

    const totalResidents = residentSnapshot.size;
    const totalWorkers = workerSnapshot.size;
    const totalRequests = requestSnapshot.size;
    const pendingVerifications = workerSnapshot.docs.filter(
      (doc) => doc.data().isVerified === false
    ).length;
    const activeRequests = requestSnapshot.docs.filter((doc) =>
      [
        "pending",
        "assigned",
        "accepted",
        "worker_arrived",
        "price_confirmed",
        "in_progress",
      ].includes(doc.data().status)
    ).length;
    const completedJobs = requestSnapshot.docs.filter(
      (doc) => doc.data().status === "payment_confirmed"
    ).length;
    const pendingPayments = paymentSnapshot.docs.filter(
      (doc) => doc.data().status === "pending"
    ).length;
    const openDisputes = disputeSnapshot.docs.filter(
      (doc) => doc.data().status !== "resolved"
    ).length;

    res.json({
      totalResidents,
      totalWorkers,
      pendingVerifications,
      totalRequests,
      activeRequests,
      completedJobs,
      pendingPayments,
      openDisputes,
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

    const now = FieldValue.serverTimestamp();
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

    const now = FieldValue.serverTimestamp();
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
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Configuration updated" });
  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({ error: "Failed to update config" });
  }
}

/**
 * GET /api/admin/income
 * Aggregated income stats from confirmed payments.
 * Query params: period = "daily" | "weekly" | "monthly" (default "monthly")
 */
export async function getIncomeStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const period = (req.query.period as string) || "monthly";

    if (!["daily", "weekly", "monthly"].includes(period)) {
      res.status(400).json({ error: "Invalid period. Use daily, weekly, or monthly." });
      return;
    }

    const snapshot = await db
      .collection("payments")
      .where("status", "==", "confirmed")
      .orderBy("confirmedAt", "desc")
      .get();

    let totalIncome = 0;
    let totalWorkerPayouts = 0;
    let totalCollected = 0;
    let totalTransactions = 0;

    const buckets: Record<
      string,
      { income: number; workerPayouts: number; totalCollected: number; transactions: number }
    > = {};

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const commission = data.commissionAmount || 0;
      const workerAmount = data.workerAmount || 0;
      const total = data.totalAmount || 0;

      totalIncome += commission;
      totalWorkerPayouts += workerAmount;
      totalCollected += total;
      totalTransactions++;

      // Get the confirmedAt date
      const confirmedAt = data.confirmedAt?.toDate?.() ?? new Date(data.confirmedAt);
      if (isNaN(confirmedAt.getTime())) continue;

      const key = getBucketKey(confirmedAt, period);

      if (!buckets[key]) {
        buckets[key] = { income: 0, workerPayouts: 0, totalCollected: 0, transactions: 0 };
      }
      buckets[key].income += commission;
      buckets[key].workerPayouts += workerAmount;
      buckets[key].totalCollected += total;
      buckets[key].transactions++;
    }

    // Convert buckets to sorted array (most recent first)
    const breakdown = Object.entries(buckets)
      .map(([label, stats]) => ({ label, ...stats }))
      .sort((a, b) => b.label.localeCompare(a.label));

    res.json({
      period,
      summary: { totalIncome, totalWorkerPayouts, totalCollected, totalTransactions },
      breakdown,
    });
  } catch (error) {
    console.error("Income stats error:", error);
    res.status(500).json({ error: "Failed to fetch income stats" });
  }
}

function getBucketKey(date: Date, period: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  if (period === "daily") {
    return `${y}-${m}-${d}`;
  }
  if (period === "weekly") {
    // ISO week: find Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const wm = String(monday.getMonth() + 1).padStart(2, "0");
    const wd = String(monday.getDate()).padStart(2, "0");
    return `${monday.getFullYear()}-${wm}-${wd}`;
  }
  // monthly
  return `${y}-${m}`;
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
