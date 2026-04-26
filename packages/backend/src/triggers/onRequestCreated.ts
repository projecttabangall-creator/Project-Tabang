import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { attemptRequestAssignment } from "../services/requestAssignment.service";
import { bumpPendingRequestPoolSignal } from "../services/requestSignal.service";

export const onRequestCreated = onDocumentCreated(
  "serviceRequests/{requestId}",
  async (event) => {
    const requestId = event.params.requestId;
    const request = event.data?.data();

    if (!request) {
      logger.warn(`Request ${requestId} not found after creation`);
      return;
    }

    logger.info(`Auto-assigning worker for request ${requestId}`, {
      categoryId: request.categoryId,
      location: request.location,
      schedule: request.schedule,
    });

    try {
      const result = await attemptRequestAssignment(requestId, request);
      await bumpPendingRequestPoolSignal();
      logger.info(`Initial assignment result for request ${requestId}: ${result}`);
    } catch (error) {
      logger.error(`Failed to auto-assign worker for request ${requestId}:`, error);
      await db.collection("serviceRequests").doc(requestId).update({
        assignmentError: (error as Error).message,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
