import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { auth, db } from "../config/firebase";
import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";
import {
  canUploadMultipleWorkerCredentials,
  DEFAULT_CREDIT_POINTS,
  getWorkerCredentialLabel,
  isWorkerCredentialType,
  RegisterWorkerInput,
  ROLES,
} from "@tabang/shared";
import { attemptRequestAssignment } from "../services/requestAssignment.service";

const usersRef = db.collection("users");
const CONTACT_ALREADY_REGISTERED_ERROR = "Contact number already registered";

function buildAuthEmail(contactNumber: string): string {
  return `${contactNumber.trim().replace(/\+/g, "")}@tabang.local`;
}

interface WorkerCredentialInput {
  type: string;
  name?: string;
  fileUrl: string;
  uploadedAt?: unknown;
}

function normalizeCredentialName(type: string, name?: string): string {
  const trimmedName = name?.trim();
  return trimmedName || getWorkerCredentialLabel(type);
}

function buildCredentialKey(credential: Partial<WorkerCredentialInput>): string {
  return [
    credential.type?.trim() || "",
    normalizeCredentialName(credential.type?.trim() || "", credential.name),
    credential.fileUrl?.trim() || "",
  ].join("::");
}

function parseWorkerCredentials(
  credentials: unknown,
  existingCredentials: WorkerCredentialInput[] = []
):
  | {
      ok: true;
      credentials: Array<{
        type: string;
        name: string;
        fileUrl: string;
        uploadedAt: unknown;
      }>;
    }
  | { ok: false; error: string } {
  if (!Array.isArray(credentials)) {
    return { ok: false, error: "credentials must be an array" };
  }

  const counts = new Map<string, number>();
  const normalizedInputs: Array<{
    type: string;
    name: string;
    fileUrl: string;
  }> = [];

  for (const credential of credentials) {
    if (!credential || typeof credential !== "object") {
      return { ok: false, error: "Each credential must be an object" };
    }

    const type =
      typeof (credential as WorkerCredentialInput).type === "string"
        ? (credential as WorkerCredentialInput).type.trim()
        : "";
    const fileUrl =
      typeof (credential as WorkerCredentialInput).fileUrl === "string"
        ? (credential as WorkerCredentialInput).fileUrl.trim()
        : "";
    const name = normalizeCredentialName(
      type,
      typeof (credential as WorkerCredentialInput).name === "string"
        ? (credential as WorkerCredentialInput).name
        : undefined
    );

    if (!type || !isWorkerCredentialType(type)) {
      return { ok: false, error: "Invalid credential type" };
    }

    if (!fileUrl) {
      return { ok: false, error: "Credential file URL is required" };
    }

    counts.set(type, (counts.get(type) || 0) + 1);
    normalizedInputs.push({ type, name, fileUrl });
  }

  for (const [type, count] of counts) {
    if (!canUploadMultipleWorkerCredentials(type) && count > 1) {
      return {
        ok: false,
        error: `${getWorkerCredentialLabel(type)} can only be uploaded once`,
      };
    }
  }

  const existingByFullKey = new Map(
    existingCredentials.map((credential) => [
      buildCredentialKey(credential),
      credential.uploadedAt,
    ])
  );
  const existingByTypeAndUrl = new Map(
    existingCredentials.map((credential) => [
      `${credential.type?.trim() || ""}::${credential.fileUrl?.trim() || ""}`,
      credential.uploadedAt,
    ])
  );

  return {
    ok: true,
    credentials: normalizedInputs.map((credential) => {
      const preservedUploadedAt =
        existingByFullKey.get(buildCredentialKey(credential)) ??
        existingByTypeAndUrl.get(
          `${credential.type}::${credential.fileUrl}`
        ) ??
        Timestamp.now();

      return {
        ...credential,
        uploadedAt: preservedUploadedAt,
      };
    }),
  };
}

function buildWorkerUserData(
  body: RegisterWorkerInput,
  uid: string,
  now: FirebaseFirestore.FieldValue,
  credentials: Array<{
    type: string;
    name: string;
    fileUrl: string;
    uploadedAt: unknown;
  }>
) {
  return {
    uid,
    role: ROLES.WORKER,
    firstName: body.firstName,
    lastName: body.lastName,
    middleInitial: body.middleInitial || "",
    birthday: body.birthday,
    contactNumber: body.contactNumber.trim(),
    email: body.email || "",
    address: body.address,
    creditPoints: DEFAULT_CREDIT_POINTS,
    isVerified: false,
    isActive: false,
    accountStatus: "active",
    otpVerified: false,
    failedLoginAttempts: 0,
    createdAt: now,
    updatedAt: now,
    termsAcceptedAt: body.termsAcceptedAt || null,
    workerData: {
      specialization: body.specialization,
      credentials,
      biometricEnrolled: body.biometricEnrolled || false,
      averageRating: 0,
      completedJobsCount: 0,
      totalJobsAssigned: 0,
      acceptanceRate: 0,
      cancellationRate: 0,
      reportsCount: 0,
      lastAssignedAt: now,
      location: new GeoPoint(0, 0),
      availability: [],
      isAvailable: false,
    },
  };
}

async function getAuthUserByEmail(email: string) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return null;
    }
    throw error;
  }
}

/**
 * POST /api/workers/register
 * Admin registers a new skilled worker.
 */
export async function registerWorker(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as RegisterWorkerInput;
  const normalizedContactNumber = body.contactNumber.trim();
  const email = buildAuthEmail(normalizedContactNumber);
  const displayName = `${body.firstName} ${body.lastName}`;
  const normalizedCredentials = parseWorkerCredentials(body.credentials || []);

  if (!normalizedCredentials.ok) {
    res.status(400).json({ error: normalizedCredentials.error });
    return;
  }

  try {
    const existingFirestore = await usersRef
      .where("contactNumber", "==", normalizedContactNumber)
      .limit(1)
      .get();

    if (!existingFirestore.empty) {
      const existingDoc = existingFirestore.docs[0];
      const existingData = existingDoc.data();

      if (existingData.role !== ROLES.WORKER) {
        res.status(409).json({ error: CONTACT_ALREADY_REGISTERED_ERROR });
        return;
      }

      try {
        await auth.getUser(existingDoc.id);
        res.status(409).json({ error: CONTACT_ALREADY_REGISTERED_ERROR });
        return;
      } catch (error: any) {
        if (error.code !== "auth/user-not-found") {
          throw error;
        }
      }

      const recreatedUser = await auth.createUser({
        uid: existingDoc.id,
        email,
        password: body.password,
        displayName,
      });

      await auth.setCustomUserClaims(recreatedUser.uid, { role: ROLES.WORKER });

      const now = FieldValue.serverTimestamp();
      await usersRef.doc(recreatedUser.uid).set(
        {
          ...buildWorkerUserData(
            {
              ...body,
              contactNumber: normalizedContactNumber,
            },
            recreatedUser.uid,
            now,
            normalizedCredentials.credentials
          ),
          createdAt: existingData.createdAt || now,
        },
        { merge: true }
      );

      await db.collection("systemLogs").add({
        action: "worker_registration_recovered",
        performedBy: req.user!.uid,
        targetUserId: recreatedUser.uid,
        details: `Recovered missing Auth record for worker: ${body.firstName} ${body.lastName} (${body.specialization})`,
        createdAt: now,
      });

      res.status(201).json({
        uid: recreatedUser.uid,
        firstName: body.firstName,
        lastName: body.lastName,
        specialization: body.specialization,
        message: "Worker account recovered and updated. Pending verification.",
      });
      return;
    }

    let userRecord = null as Awaited<ReturnType<typeof auth.createUser>> | null;
    let recoveredOrphanAuth = false;

    try {
      userRecord = await auth.createUser({
        email,
        password: body.password,
        displayName,
      });
    } catch (error: any) {
      if (error.code !== "auth/email-already-exists") {
        throw error;
      }

      const existingAuthUser = await getAuthUserByEmail(email);
      if (!existingAuthUser) {
        throw error;
      }

      const linkedFirestoreDoc = await usersRef.doc(existingAuthUser.uid).get();
      if (linkedFirestoreDoc.exists) {
        res.status(409).json({ error: CONTACT_ALREADY_REGISTERED_ERROR });
        return;
      }

      await auth.updateUser(existingAuthUser.uid, {
        password: body.password,
        displayName,
      });

      userRecord = existingAuthUser;
      recoveredOrphanAuth = true;
    }

    if (!userRecord) {
      throw new Error("Worker registration did not produce an auth user");
    }

    await auth.setCustomUserClaims(userRecord.uid, { role: ROLES.WORKER });

    const now = FieldValue.serverTimestamp();
    await usersRef.doc(userRecord.uid).set(
      buildWorkerUserData(
        {
          ...body,
          contactNumber: normalizedContactNumber,
        },
        userRecord.uid,
        now,
        normalizedCredentials.credentials
      )
    );

    await db.collection("systemLogs").add({
      action: recoveredOrphanAuth
        ? "worker_registration_recovered"
        : "worker_registered",
      performedBy: req.user!.uid,
      targetUserId: userRecord.uid,
      details: recoveredOrphanAuth
        ? `Recovered orphan Auth account for worker: ${body.firstName} ${body.lastName} (${body.specialization})`
        : `Registered worker: ${body.firstName} ${body.lastName} (${body.specialization})`,
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
      res.status(409).json({ error: CONTACT_ALREADY_REGISTERED_ERROR });
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

    if (category) {
      workers = workers.filter(
        (worker) => worker.workerData?.specialization === category
      );
    }

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

    const now = FieldValue.serverTimestamp();
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
 * If toggling ON, scan for pending requests in the worker's category and attempt assignment.
 */
export async function toggleAvailability(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { latitude, longitude } = req.body as {
    latitude?: number;
    longitude?: number;
  };

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
    const newAvailability = !current;

    // If toggling ON and location provided, update workerData.location
    const updateData: Record<string, any> = {
      "workerData.isAvailable": newAvailability,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (
      newAvailability &&
      typeof latitude === "number" &&
      typeof longitude === "number"
    ) {
      updateData["workerData.location"] = new GeoPoint(latitude, longitude);
    }

    await docRef.update(updateData);

    // If turning availability ON, scan for pending requests in this worker's category
    if (newAvailability) {
      const workerData = doc.data()!.workerData;
      const categoryId = workerData?.specialization;

      if (categoryId) {
        // Find all pending requests in this category
        const pendingRequests = await db
          .collection("serviceRequests")
          .where("categoryId", "==", categoryId)
          .where("status", "==", "pending")
          .where("assignedWorkerId", "==", null)
          .get();

        // Attempt assignment for each pending request
        for (const requestDoc of pendingRequests.docs) {
          try {
            await attemptRequestAssignment(requestDoc.id, requestDoc.data());
          } catch (assignmentError) {
            console.error(
              `Failed to reassign pending request ${requestDoc.id}:`,
              assignmentError
            );
          }
        }
      }
    }

    res.json({ isAvailable: newAvailability });
  } catch (error) {
    console.error("Toggle availability error:", error);
    res.status(500).json({ error: "Failed to update availability" });
  }
}

/**
 * PATCH /api/workers/:id/schedule
 * Update worker availability schedule.
 * After updating, scan for pending requests and attempt assignment.
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
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    await docRef.update({
      "workerData.availability": availability,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Respond immediately — the save succeeded
    res.json({ message: "Schedule updated", availability });

    // Fire-and-forget: scan for pending requests in the background
    // Errors here must not affect the response already sent above
    const workerData = doc.data()!.workerData;
    const categoryId = workerData?.specialization;
    const isWorkerAvailable = workerData?.isAvailable;

    if (categoryId && isWorkerAvailable) {
      db.collection("serviceRequests")
        .where("categoryId", "==", categoryId)
        .where("status", "==", "pending")
        .where("assignedWorkerId", "==", null)
        .get()
        .then((pendingRequests) => {
          for (const requestDoc of pendingRequests.docs) {
            attemptRequestAssignment(requestDoc.id, requestDoc.data()).catch(
              (assignmentError) =>
                console.error(
                  `Failed to reassign pending request ${requestDoc.id}:`,
                  assignmentError
                )
            );
          }
        })
        .catch((err) =>
          console.error("Schedule scan for pending requests failed:", err)
        );
    }
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
}

/**
 * PATCH /api/workers/:id/credentials
 * Admin updates worker credentials (add/replace uploaded documents).
 */
export async function updateCredentials(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { credentials } = req.body;

  try {
    const docRef = usersRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()!.role !== "worker") {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    const now = FieldValue.serverTimestamp();
    const existingCredentials =
      (doc.data()!.workerData?.credentials as WorkerCredentialInput[] | undefined) ||
      [];
    const parsedCredentials = parseWorkerCredentials(
      credentials,
      existingCredentials
    );

    if (!parsedCredentials.ok) {
      res.status(400).json({ error: parsedCredentials.error });
      return;
    }

    await docRef.update({
      "workerData.credentials": parsedCredentials.credentials,
      updatedAt: now,
    });

    await db.collection("systemLogs").add({
      action: "worker_credentials_updated",
      performedBy: req.user!.uid,
      targetUserId: id,
      details: `Updated credentials for worker: ${doc.data()!.firstName} ${doc.data()!.lastName}`,
      createdAt: now,
    });

    res.json({ message: "Credentials updated" });
  } catch (error) {
    console.error("Update credentials error:", error);
    res.status(500).json({ error: "Failed to update credentials" });
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
      "workerData.location": new GeoPoint(latitude, longitude),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Location updated" });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
}

export async function logFingerprintVerification(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { verified } = req.body;

  try {
    await usersRef.doc(id).update({
      "workerData.lastFingerprintVerification": {
        verified,
        timestamp: FieldValue.serverTimestamp(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Log fingerprint verification error:", error);
    res.status(500).json({ error: "Failed to log fingerprint verification" });
  }
}

/**
 * PATCH /api/workers/:id/biometric
 * Admin updates worker's biometric enrollment status.
 * Called by: fingerprint-service after enrollment, and admin UI for manual toggle.
 */
export async function updateBiometric(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const { biometricEnrolled } = req.body;

  try {
    if (typeof biometricEnrolled !== "boolean") {
      res.status(400).json({ error: "biometricEnrolled must be a boolean" });
      return;
    }

    await usersRef.doc(id).update({
      "workerData.biometricEnrolled": biometricEnrolled,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Update biometric error:", error);
    res.status(500).json({ error: "Failed to update biometric status" });
  }
}
