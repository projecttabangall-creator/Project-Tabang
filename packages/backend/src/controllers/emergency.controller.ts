import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";
import {
  EMERGENCY_STATUSES,
  APPLICANT_STATUSES,
  CreateEmergencyInput,
  AwardCreditInput,
  ApproveApplicantInput,
} from "@tabang/shared";
import {
  uploadEmergencyPhotos,
  broadcastEmergency,
} from "../services/emergency.service";
import { awardEmergencyCredits } from "../services/credit.service";

const emergenciesRef = db.collection("emergencies");
const categoriesRef = db.collection("categories");
const usersRef = db.collection("users");

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
}

function getApplicantArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function workerMatchesEmergency(
  specialization: unknown,
  categoryIds: unknown
): boolean {
  const workerCategories = toStringArray(specialization);
  const emergencyCategories = toStringArray(categoryIds);

  return workerCategories.some((categoryId) =>
    emergencyCategories.includes(categoryId)
  );
}

function stripRewardForNonAdmin(
  role: string,
  data: FirebaseFirestore.DocumentData
): FirebaseFirestore.DocumentData {
  if (role === "admin") return data;
  const { creditReward, ...rest } = data;
  return rest;
}

function applicantVisibleToWorker(
  workerUid: string,
  data: FirebaseFirestore.DocumentData
): FirebaseFirestore.DocumentData {
  const mine = getApplicantArray(data.applicants).find(
    (a: any) => a.workerId === workerUid
  );
  // Workers only see their own application record, not the full applicant list.
  return { ...data, applicants: mine ? [mine] : [] };
}

/**
 * POST /api/emergencies
 * Admin creates a new emergency/bayanihan broadcast.
 */
export async function createEmergency(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const adminId = req.user!.uid;
  const body = req.body as CreateEmergencyInput;

  try {
    console.log("Creating emergency with body:", { ...body, photoUrls: body.photoUrls?.map(u => u.substring(0, 50) + "...") });

    // Look up category names for denormalization
    const categoryDocs = await Promise.all(
      body.categoryIds.map((id) => categoriesRef.doc(id).get())
    );
    const missing = categoryDocs.find((d) => !d.exists);
    if (missing) {
      res.status(400).json({ error: "One or more categoryIds are invalid" });
      return;
    }
    const categoryNames = categoryDocs.map((d) => d.data()!.name as string);
    console.log("Category names:", categoryNames);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + body.durationHours * 60 * 60 * 1000
    );
    console.log("Calculated expiry time:", expiresAt);

    // Create the doc first (so we have an ID for the photo path), then attach photos.
    const docRef = await emergenciesRef.add({
      createdByAdminId: adminId,
      title: body.title,
      requesterName: body.requesterName,
      requesterContact: body.requesterContact,
      categoryIds: body.categoryIds,
      categoryNames,
      details: body.details,
      needsList: body.needsList ?? [],
      photoUrls: [],
      location: new GeoPoint(body.location.latitude, body.location.longitude),
      locationAddress: body.locationAddress,
      affectedFamilies: body.affectedFamilies,
      durationHours: body.durationHours,
      expiresAt: Timestamp.fromDate(expiresAt),
      creditReward: body.creditReward,
      status: EMERGENCY_STATUSES.ACTIVE,
      applicants: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log("Created emergency doc:", docRef.id);

    const photoUrls = await uploadEmergencyPhotos(
      body.photoUrls ?? [],
      docRef.id
    );
    console.log("Uploaded photos:", photoUrls);

    if (photoUrls.length) {
      await docRef.update({ photoUrls });
    }

    const { residents, workers } = await broadcastEmergency({
      emergencyId: docRef.id,
      title: body.title,
      categoryIds: body.categoryIds,
      locationAddress: body.locationAddress,
    });
    console.log("Broadcast complete:", { residents, workers });

    await db.collection("systemLogs").add({
      action: "emergency_created",
      performedBy: adminId,
      targetEmergencyId: docRef.id,
      details: `Broadcast "${body.title}" to ${residents} residents, ${workers} workers`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      id: docRef.id,
      status: EMERGENCY_STATUSES.ACTIVE,
      broadcastedTo: { residents, workers },
    });
  } catch (error) {
    console.error("Create emergency error:", error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to create emergency" });
    }
  }
}

/**
 * GET /api/emergencies
 * List emergencies. Query `?status=active|completed|cancelled`.
 * Workers see only emergencies whose categoryIds intersect their specialization.
 * Residents/workers never see creditReward.
 */
export async function listEmergencies(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const role = req.user!.role;
  const uid = req.user!.uid;
  const { status } = req.query;

  try {
    let query: FirebaseFirestore.Query = emergenciesRef.orderBy(
      "createdAt",
      "desc"
    );
    if (status && typeof status === "string") {
      query = emergenciesRef
        .where("status", "==", status)
        .orderBy("createdAt", "desc");
    }

    const snap = await query.get();
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    if (role === "worker") {
      // Show all emergencies to workers, but mark whether they can apply
      const userDoc = await usersRef.doc(uid).get();
      const specialization = userDoc.data()?.workerData?.specialization;
      docs = docs.map((d) => ({
        ...applicantVisibleToWorker(uid, d),
        canApply: workerMatchesEmergency(specialization, d.categoryIds),
      }));
    }

    if (role !== "admin") {
      docs = docs.map((d) => stripRewardForNonAdmin(role, d)) as any;
    }

    res.json({ emergencies: docs });
  } catch (error) {
    console.error("List emergencies error:", error);
    res.status(500).json({ error: "Failed to fetch emergencies" });
  }
}

/**
 * GET /api/emergencies/:id
 */
export async function getEmergency(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const role = req.user!.role;
  const uid = req.user!.uid;
  const id = req.params.id as string;

  try {
    const doc = await emergenciesRef.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Emergency not found" });
      return;
    }
    let data: any = { id: doc.id, ...doc.data() };

    if (role === "worker") {
      const userDoc = await usersRef.doc(uid).get();
      const specialization = userDoc.data()?.workerData?.specialization;
      data = applicantVisibleToWorker(uid, data);
      data.canApply = workerMatchesEmergency(specialization, data.categoryIds);
    }

    if (role !== "admin") {
      data = stripRewardForNonAdmin(role, data);
    }

    res.json({ emergency: data });
  } catch (error) {
    console.error("Get emergency error:", error);
    res.status(500).json({ error: "Failed to fetch emergency" });
  }
}

/**
 * PATCH /api/emergencies/:id/cancel
 */
export async function cancelEmergency(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const adminId = req.user!.uid;
  const id = req.params.id as string;

  try {
    const doc = await emergenciesRef.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Emergency not found" });
      return;
    }
    if (doc.data()!.status !== EMERGENCY_STATUSES.ACTIVE) {
      res.status(400).json({ error: "Only active emergencies can be cancelled" });
      return;
    }

    await emergenciesRef.doc(id).update({
      status: EMERGENCY_STATUSES.CANCELLED,
      cancelledAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "emergency_cancelled",
      performedBy: adminId,
      targetEmergencyId: id,
      details: `Emergency cancelled`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Emergency cancelled" });
  } catch (error) {
    console.error("Cancel emergency error:", error);
    res.status(500).json({ error: "Failed to cancel emergency" });
  }
}

/**
 * PATCH /api/emergencies/:id/complete
 */
export async function completeEmergency(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const adminId = req.user!.uid;
  const id = req.params.id as string;

  try {
    const doc = await emergenciesRef.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Emergency not found" });
      return;
    }
    if (doc.data()!.status !== EMERGENCY_STATUSES.ACTIVE) {
      res.status(400).json({ error: "Only active emergencies can be completed" });
      return;
    }

    await emergenciesRef.doc(id).update({
      status: EMERGENCY_STATUSES.COMPLETED,
      completedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "emergency_completed",
      performedBy: adminId,
      targetEmergencyId: id,
      details: `Emergency marked completed`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Emergency completed" });
  } catch (error) {
    console.error("Complete emergency error:", error);
    res.status(500).json({ error: "Failed to complete emergency" });
  }
}

/**
 * POST /api/emergencies/:id/apply
 * Worker applies to help.
 */
export async function applyToEmergency(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const workerUid = req.user!.uid;
  const id = req.params.id as string;

  try {
    const emergencyDoc = await emergenciesRef.doc(id).get();
    if (!emergencyDoc.exists) {
      res.status(404).json({ error: "Emergency not found" });
      return;
    }
    const data = emergencyDoc.data()!;
    if (data.status !== EMERGENCY_STATUSES.ACTIVE) {
      res.status(400).json({ error: "This emergency is no longer accepting applications" });
      return;
    }

    const userDoc = await usersRef.doc(workerUid).get();
    const userData = userDoc.data();
    const specialization = userData?.workerData?.specialization;
    if (!workerMatchesEmergency(specialization, data.categoryIds)) {
      res.status(403).json({ error: "Your specialization does not match this emergency" });
      return;
    }

    const applicants = getApplicantArray(data.applicants);
    if (applicants.some((a) => a.workerId === workerUid)) {
      res.status(400).json({ error: "You have already applied to this emergency" });
      return;
    }

    const workerName = `${userData?.firstName ?? ""} ${userData?.lastName ?? ""}`.trim();

    const newApplicant = {
      workerId: workerUid,
      workerName,
      appliedAt: Timestamp.now(),
      approvalStatus: APPLICANT_STATUSES.PENDING,
    };

    await emergenciesRef.doc(id).update({
      applicants: FieldValue.arrayUnion(newApplicant),
    });

    // Notify all admins so they can review
    const admins = await usersRef.where("role", "==", "admin").get();
    for (const adminDoc of admins.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "system",
        title: "New Emergency Applicant",
        body: `${workerName || "A worker"} applied to "${data.title}"`,
        referenceType: "emergency",
        referenceId: id,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    res.status(201).json({ message: "Application submitted", approvalStatus: APPLICANT_STATUSES.PENDING });
  } catch (error) {
    console.error("Apply to emergency error:", error);
    res.status(500).json({ error: "Failed to apply to emergency" });
  }
}

/**
 * PATCH /api/emergencies/:id/applicants/:workerId/approve
 */
export async function reviewApplicant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const adminId = req.user!.uid;
  const { id, workerId } = req.params as { id: string; workerId: string };
  const body = req.body as ApproveApplicantInput;

  try {
    const emergencyDoc = await emergenciesRef.doc(id).get();
    if (!emergencyDoc.exists) {
      res.status(404).json({ error: "Emergency not found" });
      return;
    }
    const data = emergencyDoc.data()!;
    const applicants = getApplicantArray(data.applicants);
    const idx = applicants.findIndex((a) => a.workerId === workerId);
    if (idx === -1) {
      res.status(404).json({ error: "Applicant not found" });
      return;
    }

    const updatedApplicants = applicants.map((applicant, applicantIndex) =>
      applicantIndex === idx
        ? {
            ...applicant,
            approvalStatus: body.approvalStatus,
            approvedAt: Timestamp.now(),
          }
        : applicant
    );

    await emergenciesRef.doc(id).update({
      applicants: updatedApplicants,
    });

    await db.collection("notifications").add({
      userId: workerId,
      type: "system",
      title:
        body.approvalStatus === "approved"
          ? "Emergency Application Approved"
          : "Emergency Application Rejected",
      body: `Your application for "${data.title}" has been ${body.approvalStatus}.`,
      referenceType: "emergency",
      referenceId: id,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "emergency_applicant_reviewed",
      performedBy: adminId,
      targetEmergencyId: id,
      targetUserId: workerId,
      details: `Applicant ${workerId} marked ${body.approvalStatus}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: `Applicant ${body.approvalStatus}` });
  } catch (error) {
    console.error("Review applicant error:", error);
    res.status(500).json({ error: "Failed to review applicant" });
  }
}

/**
 * PATCH /api/emergencies/:id/applicants/:workerId/award
 */
export async function awardApplicantCredits(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const adminId = req.user!.uid;
  const { id, workerId } = req.params as { id: string; workerId: string };
  const body = req.body as AwardCreditInput;

  try {
    const emergencyDoc = await emergenciesRef.doc(id).get();
    if (!emergencyDoc.exists) {
      res.status(404).json({ error: "Emergency not found" });
      return;
    }
    const data = emergencyDoc.data()!;
    if (data.status !== EMERGENCY_STATUSES.COMPLETED) {
      res.status(400).json({ error: "Credits can only be awarded after the emergency is completed" });
      return;
    }
    const applicants = getApplicantArray(data.applicants);
    const idx = applicants.findIndex((a) => a.workerId === workerId);
    if (idx === -1) {
      res.status(404).json({ error: "Applicant not found" });
      return;
    }
    if (applicants[idx].approvalStatus !== APPLICANT_STATUSES.APPROVED) {
      res.status(400).json({ error: "Only approved applicants can be awarded credits" });
      return;
    }

    const { newBalance } = await awardEmergencyCredits(workerId, body.amount, id);

    const updatedApplicants = applicants.map((applicant, applicantIndex) =>
      applicantIndex === idx
        ? {
            ...applicant,
            creditAwarded: body.amount,
            awardedAt: Timestamp.now(),
          }
        : applicant
    );

    await emergenciesRef.doc(id).update({
      applicants: updatedApplicants,
    });

    await db.collection("notifications").add({
      userId: workerId,
      type: "system",
      title: "Bayanihan Credits Awarded",
      body: `You received ${body.amount} credit point(s) for helping with "${data.title}".`,
      referenceType: "emergency",
      referenceId: id,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("systemLogs").add({
      action: "emergency_credit_awarded",
      performedBy: adminId,
      targetEmergencyId: id,
      targetUserId: workerId,
      details: `Awarded ${body.amount} credit(s). New balance: ${newBalance}`,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Credits awarded", newBalance });
  } catch (error) {
    console.error("Award credits error:", error);
    res.status(500).json({ error: "Failed to award credits" });
  }
}
