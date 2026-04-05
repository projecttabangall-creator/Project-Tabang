import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../config/firebase";
import { assignWorker } from "../services/assignment.service";
import { logger } from "firebase-functions";

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
      // Call auto-assignment service
      const assignment = await assignWorker(
        request.categoryId,
        request.location,
        request.schedule
      );

      if (assignment.workerId) {
        // Update request with assigned worker
        await db.collection("serviceRequests").doc(requestId).update({
          assignedWorkerId: assignment.workerId,
          status: "assigned",
          assignmentScore: assignment.score,
          assignmentAttempts: 1,
          assignedAt: new Date(),
        });

        // Update worker's lastAssignedAt timestamp
        await db.collection("users").doc(assignment.workerId).update({
          "workerData.lastAssignedAt": new Date(),
        });

        logger.info(`Worker ${assignment.workerId} assigned to request ${requestId}`);

        // TODO: Send notification to worker about new job assignment
      } else if (assignment.status === "pending_queue") {
        // No workers available - request stays in pending
        await db.collection("serviceRequests").doc(requestId).update({
          status: "pending",
          assignmentAttempts: 1,
          pendingAt: new Date(),
        });

        logger.info(`Request ${requestId} queued - no available workers`);

        // TODO: Notify admin about pending queue
      }
    } catch (error) {
      logger.error(`Failed to auto-assign worker for request ${requestId}:`, error);

      // Mark request as failed assignment for manual review
      await db.collection("serviceRequests").doc(requestId).update({
        status: "pending",
        assignmentError: (error as Error).message,
      });
    }
  }
);
