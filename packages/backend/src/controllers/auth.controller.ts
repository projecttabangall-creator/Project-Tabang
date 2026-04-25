import { Request, Response } from "express";
import { auth, db } from "../config/firebase";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  buildAuthEmailCandidates,
  buildPreferredAuthEmail,
  ChangePasswordInput,
  DEFAULT_CREDIT_POINTS,
  getPhilippinePhoneCandidates,
  LoginInput,
  normalizePhilippinePhoneNumber,
  RequestPasswordResetInput,
  RegisterResidentInput,
  ROLES,
} from "@tabang/shared";
import { FieldValue } from "firebase-admin/firestore";

async function findUserByContactNumber(contactNumber: string) {
  const candidates = getPhilippinePhoneCandidates(contactNumber);

  if (candidates.length > 1) {
    const snapshot = await db
      .collection("users")
      .where("contactNumber", "in", candidates)
      .limit(1)
      .get();

    return snapshot.empty ? null : snapshot.docs[0];
  }

  const snapshot = await db
    .collection("users")
    .where("contactNumber", "==", candidates[0] || contactNumber.trim())
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0];
}

async function getAuthUserByAnyEmail(contactNumber: string) {
  for (const email of buildAuthEmailCandidates(contactNumber)) {
    try {
      return await auth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  return null;
}

export async function registerResident(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as RegisterResidentInput;
  const normalizedContactNumber = normalizePhilippinePhoneNumber(
    body.contactNumber,
    "local"
  );

  if (!normalizedContactNumber) {
    res.status(400).json({ error: "Contact number is required" });
    return;
  }

  try {
    const existingUser = await findUserByContactNumber(normalizedContactNumber);
    if (existingUser) {
      res.status(409).json({ error: "Contact number already registered" });
      return;
    }

    const existingAuthUser = await getAuthUserByAnyEmail(normalizedContactNumber);
    if (existingAuthUser) {
      const linkedFirestoreUser = await db
        .collection("users")
        .doc(existingAuthUser.uid)
        .get();

      if (linkedFirestoreUser.exists) {
        res.status(409).json({ error: "Contact number already registered" });
        return;
      }
    }

    const email = buildPreferredAuthEmail(normalizedContactNumber);
    const userRecord = existingAuthUser
      ? await auth.updateUser(existingAuthUser.uid, {
          email,
          password: body.password,
          displayName: `${body.firstName} ${body.lastName}`,
        })
      : await auth.createUser({
          email,
          password: body.password,
          displayName: `${body.firstName} ${body.lastName}`,
        });

    await auth.setCustomUserClaims(userRecord.uid, { role: ROLES.RESIDENT });

    const now = FieldValue.serverTimestamp();
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: ROLES.RESIDENT,
      firstName: body.firstName,
      lastName: body.lastName,
      middleInitial: body.middleInitial || "",
      contactNumber: normalizedContactNumber,
      address: body.address,
      creditPoints: DEFAULT_CREDIT_POINTS,
      isVerified: true,
      isActive: true,
      accountStatus: "active",
      otpVerified: true,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      message: "Registration successful. You can now sign in.",
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error.code === "auth/email-already-exists") {
      res.status(409).json({ error: "Contact number already registered" });
      return;
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Registration failed",
    });
  }
}

export async function verifyOtp(_req: Request, res: Response): Promise<void> {
  res.status(410).json({
    error: "OTP verification is no longer available.",
  });
}

export async function resendOtp(_req: Request, res: Response): Promise<void> {
  res.status(410).json({
    error: "OTP resend is no longer available.",
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as LoginInput;
  const normalizedContactNumber = normalizePhilippinePhoneNumber(
    body.contactNumber,
    "local"
  );

  if (!normalizedContactNumber) {
    res.status(400).json({ error: "Contact number is required" });
    return;
  }

  try {
    const userDoc = await findUserByContactNumber(normalizedContactNumber);

    if (!userDoc) {
      res.status(401).json({ error: "Invalid contact number or password" });
      return;
    }

    const userData = userDoc.data();

    if (userData.accountStatus === "suspended") {
      if (userData.suspendUntil) {
        const suspendUntil = userData.suspendUntil.toDate
          ? userData.suspendUntil.toDate()
          : new Date(userData.suspendUntil);
        if (new Date() >= suspendUntil) {
          await userDoc.ref.update({
            accountStatus: "active",
            isActive: true,
            suspendReason: FieldValue.delete(),
            suspendedAt: FieldValue.delete(),
            suspendUntil: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          res.status(403).json({
            error: "Account is suspended",
            suspendUntil: suspendUntil.toISOString(),
            suspendReason: userData.suspendReason ?? null,
          });
          return;
        }
      } else {
        res.status(403).json({
          error: "Account is suspended",
          suspendReason: userData.suspendReason ?? null,
        });
        return;
      }
    }

    if (userData.accountStatus === "banned") {
      res.status(403).json({ error: "Account is banned" });
      return;
    }

    if (userData.lockedUntil) {
      const lockExpiry = userData.lockedUntil.toDate
        ? userData.lockedUntil.toDate()
        : new Date(userData.lockedUntil);
      if (new Date() < lockExpiry) {
        res.status(423).json({
          error: "Account temporarily locked due to too many failed attempts",
        });
        return;
      }
    }

    const customToken = await auth.createCustomToken(userDoc.id, {
      role: userData.role,
    });

    res.json({
      token: customToken,
      user: {
        uid: userDoc.id,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isVerified: userData.isVerified,
        contactNumber: userData.contactNumber,
        mustChangePassword: Boolean(userData.mustChangePassword),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}

export async function requestPasswordReset(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as RequestPasswordResetInput;
  const normalizedContactNumber = normalizePhilippinePhoneNumber(
    body.contactNumber,
    "local"
  );

  try {
    const matchedUser = await findUserByContactNumber(normalizedContactNumber);
    const existingPending = await db
      .collection("passwordResetRequests")
      .where("contactNumber", "==", normalizedContactNumber)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingPending.empty) {
      res.json({
        message: "Your password reset request is already pending review.",
      });
      return;
    }

    const requestRef = await db.collection("passwordResetRequests").add({
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      fullName: `${body.firstName.trim()} ${body.lastName.trim()}`.trim(),
      role: body.role,
      contactNumber: normalizedContactNumber,
      note: body.note?.trim() || "",
      matchedUserId: matchedUser?.id || null,
      matchedUserRole: matchedUser?.data().role || null,
      status: "pending",
      requestedAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: "",
      tempPasswordIssuedAt: null,
    });

    const adminSnapshot = await db
      .collection("users")
      .where("role", "in", ["admin", "superadmin"])
      .get();

    const notificationBatch = db.batch();
    const fullName = `${body.firstName.trim()} ${body.lastName.trim()}`.trim();
    const notificationBody = `${fullName} (${body.role}) requested a password reset for ${normalizedContactNumber}.`;

    for (const adminDoc of adminSnapshot.docs) {
      const adminData = adminDoc.data();
      if (adminData.accountStatus && adminData.accountStatus !== "active") {
        continue;
      }

      const notificationRef = db.collection("notifications").doc();
      notificationBatch.set(notificationRef, {
        userId: adminDoc.id,
        type: "system",
        title: "Password reset request submitted",
        body: notificationBody,
        referenceType: "password_reset",
        referenceId: requestRef.id,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await notificationBatch.commit();

    res.json({
      message:
        "Your password reset request has been submitted for admin review.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ error: "Failed to submit password reset request" });
  }
}

export async function resetPassword(
  _req: Request,
  res: Response
): Promise<void> {
  res.status(410).json({
    error:
      "Password reset by SMS is currently unavailable. Please contact an administrator.",
  });
}

export async function confirmResetPassword(
  _req: Request,
  res: Response
): Promise<void> {
  res.status(410).json({
    error:
      "Password reset by SMS is currently unavailable. Please contact an administrator.",
  });
}

export async function changePassword(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as ChangePasswordInput;

  try {
    await auth.updateUser(req.user!.uid, { password: body.newPassword });

    await db.collection("users").doc(req.user!.uid).update({
      mustChangePassword: false,
      passwordChangedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "password_changed",
      performedBy: req.user!.uid,
      targetUserId: req.user!.uid,
      details: "User changed password after login",
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { profilePhotoUrl, email } = req.body;

  try {
    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (profilePhotoUrl !== undefined) updates.profilePhotoUrl = profilePhotoUrl;
    if (email !== undefined) updates.email = email;

    await db.collection("users").doc(req.user!.uid).update(updates);

    res.json({ message: "Profile updated" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userDoc = await db.collection("users").doc(req.user!.uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userData = userDoc.data()!;
    const { failedLoginAttempts, lockedUntil, ...safeData } = userData;

    res.json({ user: { id: userDoc.id, ...safeData } });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}
