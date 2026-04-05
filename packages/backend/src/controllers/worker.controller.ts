import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { auth, db } from "../config/firebase";
import adminSDK from "../config/firebase";
import {
  RegisterWorkerInput,
  DEFAULT_CREDIT_POINTS,
  ROLES,
} from "@tabang/shared";

const usersRef = db.collection("users");

/**
 * POST /api/workers/register
 * Admin registers a new skilled worker.
 */
export async function registerWorker(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as RegisterWorkerInput;

  try {
    // Check if contact number already exists
    const existing = await usersRef
      .where("contactNumber", "==", body.contactNumber)
      .limit(1)
      .get();

    if (!existing.empty) {
      res.status(409).json({ error: "Contact number already registered" });
      return;
    }

    // Create Firebase Auth user
    const email = `${body.contactNumber.replace(/\+/g, "")}@tabang.local`;
    const userRecord = await auth.createUser({
      email,
      password: body.password,
      displayName: `${body.firstName} ${body.lastName}`,
    });

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, { role: ROLES.WORKER });

    // Create user document
    const now = adminSDK.firestore.FieldValue.serverTimestamp();
    await usersRef.doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: ROLES.WORKER,
      firstName: body.firstName,
      lastName: body.lastName,
      middleInitial: body.middleInitial || "",
      birthday: body.birthday,
      contactNumber: body.contactNumber,
      email: body.email || "",
      address: body.address,
      creditPoints: DEFAULT_CREDIT_POINTS,
      isVerified: false,
      isActive: false, // Inactive until admin verifies
      accountStatus: "active",
      otpVerified: false,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      workerData: {
        specialization: body.specialization,
        credentials: [],
        biometricEnrolled: false,
        averageRating: 0,
        completedJobsCount: 0,
        totalJobsAssigned: 0,
        acceptanceRate: 0,
        cancellationRate: 0,
        reportsCount: 0,
        lastAssignedAt: now,
        location: new adminSDK.firestore.GeoPoint(0, 0),
        availability: [],
        isAvailable: false,
      },
    });

    // Log
    await db.collection("systemLogs").add({
      action: "worker_registered",
      performedBy: req.user!.uid,
      targetUserId: userRecord.uid,
      details: `Registered worker: ${body.firstName} ${body.lastName} (${body.specialization})`,
      createdAt: now,
    });

    res.status(201).json({
      uid: userRecord.uid,
      firstName: body.firstName,
      lastName: body.lastName,
      specialization: body.specialization,
      message: "Worker registered. Pending verification.",
    });
  } catch (error: any) {
    console.error("Register worker error:", error);
    if (error.code === "auth/email-already-exists") {
      res.status(409).json({ error: "Contact number already registered" });
      return;
    }
    res.status(500).json({ error: "Failed to register worker" });
  }
}

/**
 * GET /api/workers
 * List all workers (admin).
 */
export async function listWorkers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { category, status, sortBy } = req.query;

    let query: FirebaseFirestore.Query = usersRef.where("role", "==", "worker");

    if (status === "verified") {
      query = query.where("isVerified", "==", true);
    } else if (status === "pending") {
      query = query.where("isVerified", "==", false);
    }

    const snapshot = await query.get();
    let workers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        middleInitial: data.middleInitial,
        contactNumber: data.contactNumber,
        email: data.email,
        creditPoints: data.creditPoints,
        isVerified: data.isVerified,
        isActive: data.isActive,
        accountStatus: data.accountStatus,
        createdAt: data.createdAt,
        workerData: data.workerData,
      };
    });

    // Filter by category client-side (Firestore can't query nested fields + other where)
    if (category) {
      workers = workers.filter(
        (w) => w.workerData?.specialization === category
      );
    }

    // Sort
    if (sortBy === "rating") {
      workers.sort(
        (a, b) =>
          (b.workerData?.averageRating || 0) -
          (a.workerData?.averageRating || 0)
      );
    } else if (sortBy === "jobs") {
      workers.sort(
        (a, b) =>
          (b.workerData?.completedJobsCount || 0) -
          (a.workerData?.completedJobsCount || 0)
      );
    } else if (sortBy === "credit") {
      workers.sort((a, b) => b.creditPoints - a.creditPoints);
    }

    res.json({ workers });
  } catch (error) {
    console.error("List workers error:", error);
    res.status(500).json({ error: "Failed to fetch workers" });
  }
}

/**
 * GET /api/workers/:id
 * Get a single worker's profile.
 */
export async function getWorker(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;

  try {
    // Workers can only view their own profile; admin can view any
    if (req.user!.role === "worker" && req.user!.uid !== id) {
      res.status(403).json({ error: "Cannot view other worker profiles" });
      return;
    }

    const doc = await usersRef.doc(id).get();
    if (!doc.exists || doc.data()!.role !== "worker") {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    const data = doc.data()!;
    const { failedLoginAttempts, lockedUntil, ...safeData } = data;

    res.json({ worker: { id: doc.id, ...safeData } });
  } catch (error) {
    console.error("Get worker error:", error);
    res.status(500).json({ error: "Failed to fetch worker" });
  }
}

/**
 * PATCH /api/workers/:id/verify
 * Admin verifies and activates a worker account.
 */
export async function verifyWorker(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()!.role !== "worker") {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    const now = adminSDK.firestore.FieldValue.serverTimestamp();
    await docRef.update({
      isVerified: true,
      isActive: true,
      updatedAt: now,
    });

    await db.collection("systemLogs").add({
      action: "worker_verified",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Verified and activated worker: ${doc.data()!.firstName} ${doc.data()!.lastName}`,
      createdAt: now,
    });

    res.json({ message: "Worker verified and activated" });
  } catch (error) {
    console.error("Verify worker error:", error);
    res.status(500).json({ error: "Failed to verify worker" });
  }
}

/**
 * PATCH /api/workers/:id/availability
 * Toggle worker availability.
 */
export async function toggleAvailability(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;

  if (req.user!.uid !== id) {
    res.status(403).json({ error: "Can only update your own availability" });
    return;
  }

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    const current = doc.data()!.workerData?.isAvailable || false;
    await docRef.update({
      "workerData.isAvailable": !current,
      updatedAt: adminSDK.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ isAvailable: !current });
  } catch (error) {
    console.error("Toggle availability error:", error);
    res.status(500).json({ error: "Failed to update availability" });
  }
}

/**
 * PATCH /api/workers/:id/schedule
 * Update worker availability schedule.
 */
export async function updateSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { availability } = req.body;

  if (req.user!.uid !== id) {
    res.status(403).json({ error: "Can only update your own schedule" });
    return;
  }

  try {
    await usersRef.doc(id).update({
      "workerData.availability": availability,
      updatedAt: adminSDK.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Schedule updated", availability });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
}

/**
 * PATCH /api/workers/:id/location
 * Update worker GPS coordinates.
 */
export async function updateLocation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { latitude, longitude } = req.body;

  if (req.user!.uid !== id) {
    res.status(403).json({ error: "Can only update your own location" });
    return;
  }

  try {
    await usersRef.doc(id).update({
      "workerData.location": new adminSDK.firestore.GeoPoint(
        latitude,
        longitude
      ),
      updatedAt: adminSDK.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Location updated" });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
}
