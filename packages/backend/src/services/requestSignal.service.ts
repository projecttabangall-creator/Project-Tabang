import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";

export async function bumpPendingRequestPoolSignal(): Promise<void> {
  await db.collection("requestSignals").doc("pendingPool").set(
    {
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
