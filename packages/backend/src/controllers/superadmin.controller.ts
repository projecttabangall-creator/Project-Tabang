import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db, auth } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { deleteFingerprintEnrollment } from "../services/fingerprintCleanup.service";

const usersRef = db.collection("users");

/**
 * POST /api/superadmin/register-admin
 * Register a new admin account.
 */
export async function registerAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const {
    firstName,
    lastName,
    middleInitial,
    contactNumber,
    password,
    assignedBarangay,
    email,
  } = req.body;

  if (!firstName || !lastName || !contactNumber || !password) {
    res.status(400).json({ error: "firstName, lastName, contactNumber, and password are required" });
    return;
  }

  // Normalize contact number
  const normalized = contactNumber.replace(/\D/g, "");
  if (normalized.length < 10) {
    res.status(400).json({ error: "Invalid contact number" });
    return;
  }

  try {
    // Check for duplicate contact number across all roles
    const existing = await usersRef.where("contactNumber", "==", normalized).get();
    if (!existing.empty) {
      res.status(409).json({ error: "Contact number already in use" });
      return;
    }

    const firebaseEmail = `${normalized}@tabang.local`;

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: firebaseEmail,
        password,
        displayName: `${firstName} ${lastName}`,
      });
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === "auth/email-already-exists") {
        res.status(409).json({ error: "An account with this contact number already exists in Auth" });
        return;
      }
      throw err;
    }

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, { role: "admin" });

    // Create Firestore document
    const now = FieldValue.serverTimestamp();
    await usersRef.doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: "admin",
      firstName,
      lastName,
      middleInitial: middleInitial || "",
      contactNumber: normalized,
      email: email || "",
      assignedBarangay: assignedBarangay || "",
      creditPoints: 5,
      isVerified: true,
      isActive: true,
      accountStatus: "active",
      otpVerified: true,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Log the action
    await db.collection("systemLogs").add({
      action: "admin_registered",
      performedBy: req.user!.uid,
      targetUserId: userRecord.uid,
      details: `Admin account created for ${firstName} ${lastName} (${normalized})`,
      createdAt: now,
    });

    res.status(201).json({
      message: "Admin account created successfully",
      adminId: userRecord.uid,
    });
  } catch (error) {
    console.error("Register admin error:", error);
    res.status(500).json({ error: "Failed to create admin account" });
  }
}

/**
 * GET /api/superadmin/admins
 * List all admin accounts.
 */
export async function listAdmins(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const snapshot = await usersRef.where("role", "==", "admin").get();

    const admins = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : null;
      return {
        id: doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        contactNumber: data.contactNumber,
        email: data.email,
        accountStatus: data.accountStatus,
        isActive: data.isActive,
        createdAt,
      };
    });

    res.json({ admins });
  } catch (error) {
    console.error("List admins error:", error);
    res.status(500).json({ error: "Failed to fetch admin accounts" });
  }
}

/**
 * PATCH /api/superadmin/admins/:id/status
 * Activate or suspend an admin account.
 */
export async function updateAdminStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { accountStatus, reason } = req.body;

  if (!["active", "suspended"].includes(accountStatus)) {
    res.status(400).json({ error: "Status must be 'active' or 'suspended'" });
    return;
  }

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.role !== "admin") {
      res.status(404).json({ error: "Admin account not found" });
      return;
    }

    const now = FieldValue.serverTimestamp();
    await docRef.update({
      accountStatus,
      isActive: accountStatus === "active",
      updatedAt: now,
    });

    await db.collection("systemLogs").add({
      action: "admin_status_changed",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Admin status changed to ${accountStatus}. Reason: ${reason || "N/A"}`,
      createdAt: now,
    });

    res.json({ message: `Admin account ${accountStatus === "active" ? "reactivated" : "suspended"}` });
  } catch (error) {
    console.error("Update admin status error:", error);
    res.status(500).json({ error: "Failed to update admin status" });
  }
}

/**
 * DELETE /api/superadmin/admins/:id
 * Permanently delete an admin account.
 */
export async function deleteAdmin(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.role !== "admin") {
      res.status(404).json({ error: "Admin account not found" });
      return;
    }

    const data = doc.data()!;

    const fingerprintCleanup = await deleteFingerprintEnrollment(id);
    if (fingerprintCleanup.attempted && !fingerprintCleanup.success) {
      await db.collection("systemLogs").add({
        action: "fingerprint_cleanup_failed",
        performedBy: req.user!.uid,
        targetUserId: id,
        details: `Could not remove fingerprint enrollment before deleting admin account: ${fingerprintCleanup.message}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Delete from Firebase Auth
    try {
      await auth.deleteUser(id);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code !== "auth/user-not-found") {
        throw err;
      }
    }

    // Delete Firestore document
    await docRef.delete();

    // Log the action
    await db.collection("systemLogs").add({
      action: "admin_deleted",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Admin account deleted: ${data.firstName} ${data.lastName} (${data.contactNumber})`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Admin account deleted" });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ error: "Failed to delete admin account" });
  }
}
