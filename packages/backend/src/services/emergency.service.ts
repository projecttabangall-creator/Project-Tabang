import { db, storage } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

const BATCH_LIMIT = 500;

/**
 * Upload base64 photo data URLs to Firebase Storage and return public URLs.
 * Mirrors the pattern used by dispute.controller.ts uploadEvidenceFiles().
 * Pass-through for already-hosted URLs.
 */
export async function uploadEmergencyPhotos(
  files: string[],
  emergencyId: string
): Promise<string[]> {
  if (!files?.length) return [];
  const bucket = storage.bucket("project-tabang---claude-code.appspot.com");
  const results = await Promise.all(
    files.map(async (dataUrl, i) => {
      if (!dataUrl.startsWith("data:")) {
        // Only allow https:// pass-through URLs (e.g. already-uploaded Storage URLs)
        if (!dataUrl.startsWith("https://")) return "";
        return dataUrl;
      }
      try {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) return "";
        const mimeType = matches[1];
        const base64String = matches[2];
        const ext = mimeType.split("/")[1] ?? "jpg";
        const filename = `emergencies/${emergencyId}/photos/${Date.now()}_${i}.${ext}`;
        const file = bucket.file(filename);
        await file.save(Buffer.from(base64String, "base64"), {
          contentType: mimeType,
        });
        await file.makePublic();
        return file.publicUrl();
      } catch (err) {
        console.error(`Failed to upload emergency photo ${i}:`, err);
        return "";
      }
    })
  );
  return results.filter((url) => url);
}

interface BroadcastNotificationInput {
  emergencyId: string;
  title: string;
  categoryIds: string[];
  locationAddress: string;
}

/**
 * Fan out in-app notifications: one per active resident + one per active worker
 * (all workers, regardless of specialization match; the frontend marks canApply based on match).
 * Writes are chunked into Firestore batches of 500 to respect the batch limit.
 */
export async function broadcastEmergency(
  input: BroadcastNotificationInput
): Promise<{ residents: number; workers: number }> {
  const { emergencyId, title, locationAddress } = input;

  const usersRef = db.collection("users");

  const residentsSnap = await usersRef
    .where("role", "==", "resident")
    .where("accountStatus", "==", "active")
    .get();

  // Notify all active workers, not just those matching categoryIds
  const workersSnap = await usersRef
    .where("role", "==", "worker")
    .where("accountStatus", "==", "active")
    .get();
  const workerDocs = workersSnap.docs;

  const targets: Array<{
    userId: string;
    forRole: "resident" | "worker";
  }> = [
    ...residentsSnap.docs.map((d) => ({
      userId: d.id,
      forRole: "resident" as const,
    })),
    ...workerDocs.map((d) => ({ userId: d.id, forRole: "worker" as const })),
  ];

  const notificationsRef = db.collection("notifications");
  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const slice = targets.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    slice.forEach((t) => {
      const docRef = notificationsRef.doc();
      batch.set(docRef, {
        userId: t.userId,
        type: "system",
        title: `Emergency: ${title}`,
        body:
          t.forRole === "worker"
            ? `Volunteer workers needed at ${locationAddress}. Tap to view details.`
            : `Community needs help at ${locationAddress}. Tap to view.`,
        referenceType: "emergency",
        referenceId: emergencyId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { residents: residentsSnap.size, workers: workerDocs.length };
}
