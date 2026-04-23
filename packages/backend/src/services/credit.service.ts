import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import {
  MAX_CREDIT_POINTS,
  MIN_CREDIT_POINTS,
  CREDIT_SUSPENSION_THRESHOLD,
  CREDIT_FLAG_THRESHOLD,
} from "@tabang/shared";

/**
 * Deduct credit points from a user.
 * If credit drops to suspension threshold, suspend the account.
 * Returns the new credit balance and whether the user was suspended.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ newBalance: number; suspended: boolean; flagged: boolean }> {
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }

  const userData = userDoc.data()!;
  const currentCredits = userData.creditPoints ?? MAX_CREDIT_POINTS;
  const newBalance = Math.max(MIN_CREDIT_POINTS, currentCredits - amount);

  const updateData: Record<string, any> = {
    creditPoints: newBalance,
    updatedAt: new Date(),
  };

  const suspended = newBalance <= CREDIT_SUSPENSION_THRESHOLD;
  const flagged = newBalance <= CREDIT_FLAG_THRESHOLD && !suspended;

  if (suspended) {
    updateData.accountStatus = "suspended";
    updateData.isActive = false;
    updateData.suspendReason = `Automatic suspension: credit points dropped to ${newBalance}`;
    updateData.suspendedAt = new Date();
    updateData.suspendUntil = null;
    if (userData.workerData) {
      updateData["workerData.isAvailable"] = false;
    }
  }

  await userRef.update(updateData);

  // Log the deduction
  await db.collection("systemLogs").add({
    action: "credit_deduction",
    performedBy: "system",
    targetUserId: userId,
    details: `Deducted ${amount} credit(s). Reason: ${reason}. New balance: ${newBalance}${suspended ? " — ACCOUNT SUSPENDED" : flagged ? " — ACCOUNT FLAGGED" : ""}`,
    createdAt: new Date(),
  });

  return { newBalance, suspended, flagged };
}

/**
 * Restore credit points to a user (e.g. after dispute resolution in their favor).
 */
export async function restoreCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ newBalance: number }> {
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }

  const userData = userDoc.data()!;
  const currentCredits = userData.creditPoints ?? MAX_CREDIT_POINTS;
  const newBalance = Math.min(MAX_CREDIT_POINTS, currentCredits + amount);

  const updateData: Record<string, any> = {
    creditPoints: newBalance,
    updatedAt: new Date(),
  };

  // Unsuspend if credits restored above threshold
  if (
    userData.accountStatus === "suspended" &&
    newBalance > CREDIT_SUSPENSION_THRESHOLD
  ) {
    updateData.accountStatus = "active";
    updateData.isActive = true;
    updateData.suspendReason = FieldValue.delete();
    updateData.suspendedAt = FieldValue.delete();
    updateData.suspendUntil = FieldValue.delete();
  }

  await userRef.update(updateData);

  await db.collection("systemLogs").add({
    action: "credit_restoration",
    performedBy: "system",
    targetUserId: userId,
    details: `Restored ${amount} credit(s). Reason: ${reason}. New balance: ${newBalance}`,
    createdAt: new Date(),
  });

  return { newBalance };
}

/**
 * Get a user's current credit balance.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) throw new Error(`User ${userId} not found`);
  return userDoc.data()!.creditPoints ?? MAX_CREDIT_POINTS;
}

/**
 * Award bayanihan (emergency) credit points to a worker.
 * Thin wrapper around restoreCredits() so logs reflect the bayanihan context.
 */
export async function awardEmergencyCredits(
  userId: string,
  amount: number,
  emergencyId: string
): Promise<{ newBalance: number }> {
  return restoreCredits(
    userId,
    amount,
    `bayanihan_award: emergency ${emergencyId}`
  );
}
