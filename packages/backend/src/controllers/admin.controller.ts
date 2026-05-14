import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { auth, db } from "../config/firebase";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  getResidentCancellationStats,
} from "../services/residentCancellation.service";
import { deleteFingerprintEnrollment } from "../services/fingerprintCleanup.service";
import { getMonthlyJobsAssigned } from "../utils/assignmentStats";

const usersRef = db.collection("users");
const passwordResetRequestsRef = db.collection("passwordResetRequests");
const nameChangeRequestsRef = db.collection("nameChangeRequests");

function generateTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();

  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date; _seconds?: number };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
    if (typeof maybeTimestamp._seconds === "number") {
      return new Date(maybeTimestamp._seconds * 1000);
    }
  }

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCursor(
  cursor: unknown
): { createdAt: FirebaseFirestore.Timestamp; id: string } | null {
  if (typeof cursor !== "string" || !cursor.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { createdAtMs?: number; id?: string };

    if (
      typeof parsed?.createdAtMs !== "number" ||
      !Number.isFinite(parsed.createdAtMs) ||
      typeof parsed?.id !== "string" ||
      !parsed.id.trim()
    ) {
      return null;
    }

    return {
      createdAt: Timestamp.fromMillis(parsed.createdAtMs),
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function buildCursor(doc: FirebaseFirestore.QueryDocumentSnapshot): string | null {
  const createdAt = doc.data()?.createdAt;
  if (!(createdAt instanceof Timestamp)) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      createdAtMs: createdAt.toMillis(),
      id: doc.id,
    }),
    "utf8"
  ).toString("base64url");
}

function compareCreatedAtAndIdDesc(
  leftCreatedAt: unknown,
  leftId: string,
  rightCreatedAt: Timestamp,
  rightId: string
): number {
  const leftMillis = leftCreatedAt instanceof Timestamp ? leftCreatedAt.toMillis() : 0;
  const rightMillis = rightCreatedAt.toMillis();

  if (leftMillis !== rightMillis) {
    return rightMillis - leftMillis;
  }

  if (leftId === rightId) {
    return 0;
  }

  return leftId < rightId ? 1 : -1;
}

function isListableUserRole(role: unknown): role is "resident" | "worker" | "admin" {
  return role === "resident" || role === "worker" || role === "admin";
}

async function listUsersWithInMemoryPagination({
  role,
  parsedLimit,
  parsedCursor,
}: {
  role?: string;
  parsedLimit: number;
  parsedCursor: { createdAt: FirebaseFirestore.Timestamp; id: string } | null;
}): Promise<{
  docs: FirebaseFirestore.QueryDocumentSnapshot[];
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
}> {
  const snapshot = role ? await usersRef.where("role", "==", role).get() : await usersRef.get();

  const filteredDocs = snapshot.docs
    .filter((doc) => {
      const docRole = doc.data()?.role;
      if (role) {
        return docRole === role;
      }
      return isListableUserRole(docRole);
    })
    .sort((left, right) =>
      compareCreatedAtAndIdDesc(
        left.data()?.createdAt,
        left.id,
        right.data()?.createdAt instanceof Timestamp ? right.data().createdAt : Timestamp.fromMillis(0),
        right.id
      )
    );

  const totalCount = filteredDocs.length;
  let startIndex = 0;

  if (parsedCursor) {
    const cursorIndex = filteredDocs.findIndex(
      (doc) =>
        compareCreatedAtAndIdDesc(
          doc.data()?.createdAt,
          doc.id,
          parsedCursor.createdAt,
          parsedCursor.id
        ) > 0
    );
    startIndex = cursorIndex >= 0 ? cursorIndex : totalCount;
  }

  const docs = filteredDocs.slice(startIndex, startIndex + parsedLimit);
  const hasMore = startIndex + parsedLimit < totalCount;
  const nextCursor = hasMore && docs.length > 0 ? buildCursor(docs[docs.length - 1]) : null;

  return { docs, hasMore, nextCursor, totalCount };
}

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
    const { role, limit, cursor } = req.query;
    const parsedLimit =
      typeof limit === "string" ? Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200) : 25;
    const parsedCursor = parseCursor(cursor);
    let baseQuery: FirebaseFirestore.Query;

    if (role && typeof role === "string") {
      baseQuery = usersRef.where("role", "==", role);
    } else {
      baseQuery = usersRef.where("role", "in", ["resident", "worker", "admin"]);
    }

    const totalCountSnapshot = await baseQuery.count().get();
    const totalCount = totalCountSnapshot.data().count;

    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    let hasMore: boolean;
    let nextCursor: string | null;

    try {
      let query = baseQuery
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc");

      if (parsedCursor) {
        query = query.startAfter(parsedCursor.createdAt, parsedCursor.id);
      }

      query = query.limit(parsedLimit + 1);

      const snapshot = await query.get();
      docs = snapshot.docs.slice(0, parsedLimit);
      hasMore = snapshot.docs.length > parsedLimit;
      nextCursor = hasMore && docs.length > 0 ? buildCursor(docs[docs.length - 1]) : null;
    } catch (error) {
      console.error("List users query fallback:", error);
      const fallbackResult = await listUsersWithInMemoryPagination({
        role: typeof role === "string" ? role : undefined,
        parsedLimit,
        parsedCursor,
      });
      docs = fallbackResult.docs;
      hasMore = fallbackResult.hasMore;
      nextCursor = fallbackResult.nextCursor;
    }

    const users = docs.map((doc) => {
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
        suspendReason: data.suspendReason,
        suspendUntil: data.suspendUntil ? toDate(data.suspendUntil) : null,
        pendingNameChangeRequestId: data.pendingNameChangeRequestId || null,
        createdAt: data.createdAt,
      };
    });

    res.json({ users, nextCursor, hasMore, totalCount });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

export async function getUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = req.params.id as string;
    const doc = await usersRef.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const data = doc.data()!;
    const residentCancellationStats =
      data.role === "resident"
        ? await getResidentCancellationStats(doc.id)
        : null;
    if (data.role === "superadmin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({
      user: {
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
        suspendReason: data.suspendReason,
        suspendUntil: data.suspendUntil ? toDate(data.suspendUntil) : null,
        address: data.address,
        createdAt: data.createdAt ? toDate(data.createdAt) : null,
        biometricEnrolled: data.biometricEnrolled ?? false,
        mustChangePassword: data.mustChangePassword ?? false,
        totalRequests: residentCancellationStats?.totalRequests ?? 0,
        cancelledRequests: residentCancellationStats?.cancelledRequests ?? 0,
        cancellationRate: residentCancellationStats?.cancellationRate ?? 0,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}

export async function listNameChangeRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "pending";
    const snapshot = await nameChangeRequestsRef.get();

    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          role: data.role,
          currentFirstName: data.currentFirstName,
          currentLastName: data.currentLastName,
          requestedFirstName: data.requestedFirstName,
          requestedLastName: data.requestedLastName,
          contactNumber: data.contactNumber || "",
          email: data.email || "",
          idPhotoUrl: data.idPhotoUrl || "",
          status: data.status || "pending",
          requestedAt: toDate(data.requestedAt),
          resolvedAt: toDate(data.resolvedAt),
          resolvedBy: data.resolvedBy || null,
          resolutionNote: data.resolutionNote || "",
        };
      })
      .filter((request) => statusFilter === "all" || request.status === statusFilter)
      .sort(
        (a, b) =>
          (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0)
      );

    res.json({ requests });
  } catch (error) {
    console.error("List name change requests error:", error);
    res.status(500).json({ error: "Failed to fetch name change requests" });
  }
}

export async function resolveNameChangeRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const action = req.body?.action;
  const resolutionNote =
    typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.trim() : "";

  if (!["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  try {
    const requestRef = nameChangeRequestsRef.doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      res.status(404).json({ error: "Name change request not found" });
      return;
    }

    const requestData = requestDoc.data()!;

    if (requestData.status !== "pending") {
      res.status(400).json({ error: "Name change request has already been processed" });
      return;
    }

    const userRef = usersRef.doc(requestData.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({ error: "User account no longer exists" });
      return;
    }

    if (action === "approve") {
      const newFirstName = requestData.requestedFirstName;
      const newLastName = requestData.requestedLastName;

      await userRef.update({
        firstName: newFirstName,
        lastName: newLastName,
        pendingNameChangeRequestId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update denormalized resident name in all service requests
      const requestsSnapshot = await db
        .collection("serviceRequests")
        .where("residentId", "==", requestData.userId)
        .get();

      const batch = db.batch();
      for (const doc of requestsSnapshot.docs) {
        batch.update(doc.ref, {
          residentName: `${newFirstName} ${newLastName}`,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    } else {
      await userRef.update({
        pendingNameChangeRequestId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await requestRef.update({
      status: action === "approve" ? "approved" : "rejected",
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: req.user!.uid,
      resolutionNote,
    });

    await db.collection("systemLogs").add({
      action: action === "approve" ? "name_change_request_approved" : "name_change_request_rejected",
      performedBy: req.user!.uid,
      targetUserId: requestData.userId,
      details: `${action === "approve" ? "Approved" : "Rejected"} name change from ${requestData.currentFirstName} ${requestData.currentLastName} to ${requestData.requestedFirstName} ${requestData.requestedLastName}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: `Name change request ${action === "approve" ? "approved" : "rejected"}` });
  } catch (error) {
    console.error("Resolve name change request error:", error);
    res.status(500).json({ error: "Failed to resolve name change request" });
  }
}

/**
 * GET /api/admin/password-reset-requests
 * List password reset requests, newest first.
 */
export async function listPasswordResetRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "pending";
    const snapshot = await passwordResetRequestsRef.get();

    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: data.fullName,
          role: data.role,
          contactNumber: data.contactNumber,
          note: data.note || "",
          matchedUserId: data.matchedUserId || null,
          matchedUserRole: data.matchedUserRole || null,
          status: data.status || "pending",
          requestedAt: toDate(data.requestedAt),
          resolvedAt: toDate(data.resolvedAt),
          resolvedBy: data.resolvedBy || null,
          resolutionNote: data.resolutionNote || "",
          tempPasswordIssuedAt: toDate(data.tempPasswordIssuedAt),
        };
      })
      .filter((request) => statusFilter === "all" || request.status === statusFilter)
      .sort(
        (a, b) =>
          (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0)
      );

    res.json({ requests });
  } catch (error) {
    console.error("List password reset requests error:", error);
    res.status(500).json({ error: "Failed to fetch password reset requests" });
  }
}

/**
 * PATCH /api/admin/password-reset-requests/:id
 * Approve or reject a pending password reset request.
 */
export async function resolvePasswordResetRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const requestId = req.params.id as string;
  const action = req.body?.action;
  const resolutionNote =
    typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.trim() : "";

  if (!["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  try {
    const requestRef = passwordResetRequestsRef.doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      res.status(404).json({ error: "Password reset request not found" });
      return;
    }

    const requestData = requestDoc.data()!;

    if (requestData.status !== "pending") {
      res.status(400).json({ error: "Password reset request has already been processed" });
      return;
    }

    if (action === "reject") {
      await requestRef.update({
        status: "rejected",
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: req.user!.uid,
        resolutionNote,
      });

      await db.collection("systemLogs").add({
        action: "password_reset_request_rejected",
        performedBy: req.user!.uid,
        targetUserId: requestData.matchedUserId || null,
        details: `Rejected password reset request for ${requestData.fullName || requestData.contactNumber}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json({ message: "Password reset request rejected" });
      return;
    }

    if (!requestData.matchedUserId) {
      res.status(404).json({ error: "No matching user was found for this request" });
      return;
    }

    const userRef = usersRef.doc(requestData.matchedUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({ error: "Matched user account no longer exists" });
      return;
    }

    const temporaryPassword = generateTemporaryPassword();

    await auth.updateUser(requestData.matchedUserId, {
      password: temporaryPassword,
    });

    await userRef.update({
      mustChangePassword: true,
      tempPasswordIssuedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await requestRef.update({
      status: "approved",
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: req.user!.uid,
      resolutionNote,
      tempPasswordIssuedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "password_reset_request_approved",
      performedBy: req.user!.uid,
      targetUserId: requestData.matchedUserId,
      details: `Issued temporary password for ${requestData.fullName || requestData.contactNumber}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({
      message: "Temporary password issued successfully",
      temporaryPassword,
    });
  } catch (error) {
    console.error("Resolve password reset request error:", error);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Update user account status (active, suspended, banned).
 * For suspend: requires reason, durationValue (number), durationUnit ("hours"|"days")
 * For ban: requires reason
 * For active: optional reason (for reactivation notes)
 */
export async function updateUserStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { accountStatus, reason, durationValue, durationUnit } = req.body;

  if (!["active", "suspended", "banned"].includes(accountStatus)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  if (accountStatus === "suspended") {
    if (!reason) {
      res.status(400).json({ error: "Reason is required for suspension" });
      return;
    }
    if (!Number.isInteger(durationValue) || durationValue <= 0) {
      res.status(400).json({ error: "Duration value must be a positive integer" });
      return;
    }
    if (!["hours", "days"].includes(durationUnit)) {
      res.status(400).json({ error: "Duration unit must be 'hours' or 'days'" });
      return;
    }
  }

  if (accountStatus === "banned") {
    if (!reason) {
      res.status(400).json({ error: "Reason is required for ban" });
      return;
    }
  }

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = FieldValue.serverTimestamp();
    const updateData: Record<string, any> = {
      accountStatus,
      isActive: accountStatus === "active",
      updatedAt: now,
    };

    let logDetails = "";

    if (accountStatus === "suspended") {
      const durationMs = durationValue * (durationUnit === "hours" ? 3600000 : 86400000);
      const suspendUntilMs = Date.now() + durationMs;
      const suspendUntil = Timestamp.fromMillis(suspendUntilMs);
      const suspendUntilDate = new Date(suspendUntilMs);

      updateData.suspendReason = reason;
      updateData.suspendedAt = now;
      updateData.suspendUntil = suspendUntil;
      updateData.banReason = FieldValue.delete();
      updateData.bannedAt = FieldValue.delete();

      logDetails = `Suspended for ${durationValue} ${durationUnit} (until ${suspendUntilDate.toISOString()}). Reason: ${reason}`;
    } else if (accountStatus === "banned") {
      updateData.banReason = reason;
      updateData.bannedAt = now;
      updateData.suspendReason = FieldValue.delete();
      updateData.suspendedAt = FieldValue.delete();
      updateData.suspendUntil = FieldValue.delete();

      logDetails = `Permanently banned. Reason: ${reason}`;
    } else if (accountStatus === "active") {
      updateData.suspendReason = FieldValue.delete();
      updateData.suspendedAt = FieldValue.delete();
      updateData.suspendUntil = FieldValue.delete();
      updateData.banReason = FieldValue.delete();
      updateData.bannedAt = FieldValue.delete();

      logDetails = `Reactivated. ${reason ? `Note: ${reason}` : ""}`;
    }

    await docRef.update(updateData);

    await db.collection("systemLogs").add({
      action: "user_status_changed",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: logDetails,
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
      await docRef.update({
        accountStatus: "suspended",
        isActive: false,
        suspendReason: `Automatic suspension: credit points dropped to ${creditPoints}`,
        suspendedAt: now,
        suspendUntil: null,
      });
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
      .get();

    let totalIncome = 0;
    let totalWorkerPayouts = 0;
    let totalCollected = 0;
    let totalTransactions = 0;

    const buckets: Record<
      string,
      { income: number; workerPayouts: number; totalCollected: number; transactions: number }
    > = {};

    const confirmedPayments = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aDate = toDate(a.confirmedAt)?.getTime() ?? 0;
        const bDate = toDate(b.confirmedAt)?.getTime() ?? 0;
        return bDate - aDate;
      });

    for (const data of confirmedPayments) {
      const commission = data.commissionAmount || 0;
      const workerAmount = data.workerAmount || 0;
      const total = data.totalAmount || 0;

      totalIncome += commission;
      totalWorkerPayouts += workerAmount;
      totalCollected += total;
      totalTransactions++;

      // Get the confirmedAt date
      const confirmedAt = toDate(data.confirmedAt);
      if (!confirmedAt) continue;

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

/**
 * GET /api/admin/analytics
 * Aggregated analytics data: requests by status, requests by category, worker performance.
 */
export async function getAnalyticsStats(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const [requestSnapshot, workerSnapshot, residentSnapshot] = await Promise.all([
      db.collection("serviceRequests").get(),
      db.collection("users").where("role", "==", "worker").get(),
      db.collection("users").where("role", "==", "resident").get(),
    ]);

    // Requests by status
    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const residentRequestCounts = new Map<
      string,
      { totalRequests: number; cancelledRequests: number }
    >();

    for (const doc of requestSnapshot.docs) {
      const data = doc.data();

      // Group by status
      const status = data.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Group by category
      const catName = data.categoryName || "Uncategorized";
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;

      const residentId =
        typeof data.residentId === "string" ? data.residentId : null;
      if (residentId) {
        const counts = residentRequestCounts.get(residentId) ?? {
          totalRequests: 0,
          cancelledRequests: 0,
        };

        counts.totalRequests += 1;

        if (status === "cancelled" && data.cancelledBy === residentId) {
          counts.cancelledRequests += 1;
        }

        residentRequestCounts.set(residentId, counts);
      }
    }

    // Top 6 categories by count
    const requestsByCategory = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Worker performance: calculate from request data for each worker
    const workerPerformance = workerSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const wd = data.workerData || {};
        const workerId = doc.id;

        // Count completed jobs and calculate acceptance rate from requests
        const workerRequests = requestSnapshot.docs.filter(
          (req) => req.data().assignedWorkerId === workerId
        );
        const completedJobs = workerRequests.filter(
          (req) => req.data().status === "payment_confirmed"
        ).length;
        const acceptedCount = workerRequests.filter(
          (req) =>
            req.data().status !== "pending" &&
            req.data().status !== "assigned" &&
            req.data().status !== "acceptance_expired"
        ).length;
        const acceptanceRate =
          workerRequests.length > 0
            ? Math.round((acceptedCount / workerRequests.length) * 100)
            : 0;

        return {
          id: workerId,
          name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          averageRating: wd.averageRating || 0,
          monthlyJobsAssigned: getMonthlyJobsAssigned(wd),
          completedJobs,
          acceptanceRate,
        };
      })
      .sort((a, b) => b.averageRating - a.averageRating || b.completedJobs - a.completedJobs)
      .slice(0, 10);

    const residentRates = residentSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const counts = residentRequestCounts.get(doc.id) ?? {
          totalRequests: 0,
          cancelledRequests: 0,
        };
        const cancellationRate =
          counts.totalRequests > 0
            ? Math.round((counts.cancelledRequests / counts.totalRequests) * 1000) / 10
            : 0;

        return {
          id: doc.id,
          name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          totalRequests: counts.totalRequests,
          cancelledRequests: counts.cancelledRequests,
          cancellationRate,
        };
      })
      .filter((resident) => resident.totalRequests > 0)
      .sort(
        (a, b) =>
          b.cancellationRate - a.cancellationRate ||
          b.cancelledRequests - a.cancelledRequests ||
          b.totalRequests - a.totalRequests ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 10);

    const totalResidentRequests = residentSnapshot.docs.reduce((sum, doc) => {
      const counts = residentRequestCounts.get(doc.id);
      return sum + (counts?.totalRequests ?? 0);
    }, 0);
    const residentCancelledRequests = residentSnapshot.docs.reduce((sum, doc) => {
      const counts = residentRequestCounts.get(doc.id);
      return sum + (counts?.cancelledRequests ?? 0);
    }, 0);
    const residentsWithCancellation = residentSnapshot.docs.reduce((sum, doc) => {
      const counts = residentRequestCounts.get(doc.id);
      return sum + ((counts?.cancelledRequests ?? 0) > 0 ? 1 : 0);
    }, 0);
    const overallCancellationRate =
      totalResidentRequests > 0
        ? Math.round((residentCancelledRequests / totalResidentRequests) * 1000) / 10
        : 0;

    res.json({
      requestsByStatus: statusCounts,
      requestsByCategory,
      workerPerformance,
      residentCancellation: {
        totalResidentRequests,
        residentCancelledRequests,
        residentsWithCancellation,
        overallCancellationRate,
        residentRates,
      },
    });
  } catch (error) {
    console.error("Analytics stats error:", error);
    res.status(500).json({ error: "Failed to fetch analytics stats" });
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
 * DELETE /api/admin/users/:id
 * Permanently delete a user account (resident, worker, or admin).
 */
export async function deleteUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;

  if (req.user!.role !== "superadmin") {
    res.status(403).json({ error: "Only superadmin can delete accounts" });
    return;
  }

  if (id === req.user!.uid) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  try {
    const doc = await usersRef.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const data = doc.data()!;

    if (data.role === "superadmin") {
      res.status(403).json({ error: "Superadmin accounts cannot be deleted from here" });
      return;
    }

    const fingerprintCleanup = await deleteFingerprintEnrollment(id);
    if (fingerprintCleanup.attempted && !fingerprintCleanup.success) {
      await db.collection("systemLogs").add({
        action: "fingerprint_cleanup_failed",
        performedBy: req.user!.uid,
        targetUserId: id,
        details: `Could not remove fingerprint enrollment before deleting ${data.role} account: ${fingerprintCleanup.message}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    try {
      await auth.deleteUser(id);
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") throw e;
    }

    await usersRef.doc(id).delete();

    await db.collection("systemLogs").add({
      action: "user_deleted",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Deleted ${data.role} account: ${data.firstName} ${data.lastName} (${data.contactNumber})`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
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
