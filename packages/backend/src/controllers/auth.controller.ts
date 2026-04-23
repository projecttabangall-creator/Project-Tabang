import { Request, Response } from "express";
import { createHash } from "crypto";
import { auth, db } from "../config/firebase";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  RegisterResidentInput,
  LoginInput,
  VerifyOtpInput,
  DEFAULT_CREDIT_POINTS,
  ROLES,
} from "@tabang/shared";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

/**
 * POST /api/auth/register
 * Register a new resident account.
 */
export async function registerResident(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as RegisterResidentInput;

  if (!body.contactNumber || body.contactNumber.trim() === "") {
    res.status(400).json({ error: "Contact number is required" });
    return;
  }

  try {
    // Check if contact number already exists
    const existingUser = await db
      .collection("users")
      .where("contactNumber", "==", body.contactNumber)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      res.status(409).json({ error: "Contact number already registered" });
      return;
    }

    // Create Firebase Auth user
    // Using email format as workaround: contactNumber@tabang.local
    const email = `${body.contactNumber.replace(/\+/g, "")}@tabang.local`;
    const userRecord = await auth.createUser({
      email,
      password: body.password,
      displayName: `${body.firstName} ${body.lastName}`,
    });

    // Set custom claims for role
    await auth.setCustomUserClaims(userRecord.uid, { role: ROLES.RESIDENT });

    // Create user document in Firestore (auto-verified — OTP skipped)
    const now = FieldValue.serverTimestamp();
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: ROLES.RESIDENT,
      firstName: body.firstName,
      lastName: body.lastName,
      middleInitial: body.middleInitial || "",
      contactNumber: body.contactNumber,
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
      message: "Registration successful.",
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error.code === "auth/email-already-exists") {
      res.status(409).json({ error: "Contact number already registered" });
      return;
    }
    res.status(500).json({ error: "Registration failed" });
  }
}

/**
 * POST /api/auth/verify-otp
 * Verify OTP and activate account.
 */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const body = req.body as VerifyOtpInput;

  try {
    // Find user by contact number
    const userQuery = await db
      .collection("users")
      .where("contactNumber", "==", body.contactNumber)
      .limit(1)
      .get();

    if (userQuery.empty) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;

    // Get stored OTP
    const otpDoc = await db.collection("otps").doc(userId).get();
    if (!otpDoc.exists) {
      res.status(400).json({ error: "No OTP found. Please request a new one." });
      return;
    }

    const otpData = otpDoc.data()!;

    // Check expiry
    const expiresAt = otpData.expiresAt.toDate
      ? otpData.expiresAt.toDate()
      : new Date(otpData.expiresAt);
    if (new Date() > expiresAt) {
      res.status(400).json({ error: "OTP has expired. Please request a new one." });
      return;
    }

    // Check OTP match against stored hash
    if (otpData.otpHash !== hashOtp(body.otp)) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    // Activate account
    await db.collection("users").doc(userId).update({
      isVerified: true,
      otpVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Clean up OTP
    await db.collection("otps").doc(userId).delete();

    res.json({ message: "Account verified successfully" });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
}

/**
 * POST /api/auth/login
 * Login with contact number and password.
 * Returns a custom token for the client to exchange for an ID token.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as LoginInput;

  if (!body.contactNumber || body.contactNumber.trim() === "") {
    res.status(400).json({ error: "Contact number is required" });
    return;
  }

  try {
    // Find user by contact number
    const userQuery = await db
      .collection("users")
      .where("contactNumber", "==", body.contactNumber)
      .limit(1)
      .get();

    if (userQuery.empty) {
      res.status(401).json({ error: "Invalid contact number or password" });
      return;
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Check account status
    if (userData.accountStatus === "suspended") {
      // Check if timed suspension has expired
      if (userData.suspendUntil) {
        const suspendUntil = userData.suspendUntil.toDate
          ? userData.suspendUntil.toDate()
          : new Date(userData.suspendUntil);
        if (new Date() >= suspendUntil) {
          // Auto-lift expired suspension
          await userDoc.ref.update({
            accountStatus: "active",
            isActive: true,
            suspendReason: FieldValue.delete(),
            suspendedAt: FieldValue.delete(),
            suspendUntil: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          // Fall through to allow login
        } else {
          res.status(403).json({
            error: "Account is suspended",
            suspendUntil: suspendUntil.toISOString(),
            suspendReason: userData.suspendReason ?? null,
          });
          return;
        }
      } else {
        // Indefinite suspension (credit-system or manual without duration)
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

    // Check if account is locked
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

    // Note: Password verification is handled by Firebase Auth on the client side
    // using signInWithEmailAndPassword. The backend generates a custom token
    // that the client can use if needed, but the primary auth flow uses
    // Firebase client SDK directly.

    // Create custom token with role claim
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
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}

/**
 * POST /api/auth/reset-password
 * Send OTP for password reset.
 */
export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  const { contactNumber } = req.body;

  try {
    const userQuery = await db
      .collection("users")
      .where("contactNumber", "==", contactNumber)
      .limit(1)
      .get();

    if (userQuery.empty) {
      // Don't reveal whether the number exists
      res.json({ message: "If the number is registered, an OTP has been sent." });
      return;
    }

    const userId = userQuery.docs[0].id;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection("otps").doc(userId).set({
      otpHash: hashOtp(otp),
      expiresAt: otpExpiry,
      contactNumber,
      type: "password_reset",
      createdAt: new Date(),
    });

    console.log(`[DEV] Password reset OTP for ${contactNumber}: ${otp}`);

    res.json({
      message: "If the number is registered, an OTP has been sent.",
      ...(process.env.FUNCTIONS_EMULATOR === "true" && { devOtp: otp }),
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Password reset failed" });
  }
}

/**
 * POST /api/auth/reset-password/confirm
 * Confirm password reset with OTP.
 */
export async function confirmResetPassword(
  req: Request,
  res: Response
): Promise<void> {
  const { contactNumber, otp, newPassword } = req.body;

  try {
    const userQuery = await db
      .collection("users")
      .where("contactNumber", "==", contactNumber)
      .limit(1)
      .get();

    if (userQuery.empty) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userId = userQuery.docs[0].id;
    const otpDoc = await db.collection("otps").doc(userId).get();

    if (!otpDoc.exists) {
      res.status(400).json({ error: "No OTP found" });
      return;
    }

    const otpData = otpDoc.data()!;
    const expiresAt = otpData.expiresAt.toDate
      ? otpData.expiresAt.toDate()
      : new Date(otpData.expiresAt);

    if (new Date() > expiresAt) {
      res.status(400).json({ error: "OTP has expired" });
      return;
    }

    if (otpData.otpHash !== hashOtp(otp)) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    // Update password in Firebase Auth
    await auth.updateUser(userId, { password: newPassword });

    // Clean up OTP
    await db.collection("otps").doc(userId).delete();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Confirm reset password error:", error);
    res.status(500).json({ error: "Password reset failed" });
  }
}

/**
 * PATCH /api/auth/profile
 * Update current user's profile (profilePhotoUrl, email).
 */
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

/**
 * GET /api/auth/me
 * Get current authenticated user's profile.
 */
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
    // Remove sensitive fields
    const { failedLoginAttempts, lockedUntil, ...safeData } = userData;

    res.json({ user: { id: userDoc.id, ...safeData } });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}
