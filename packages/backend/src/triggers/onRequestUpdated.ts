import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../config/firebase";
import { logger } from "firebase-functions";
import { REQUEST_STATUSES } from "@tabang/shared";
import { attemptRequestAssignment } from "../services/requestAssignment.service";
import { bumpPendingRequestPoolSignal } from "../services/requestSignal.service";

interface Request {
  id?: string;
  status: string;
  residentId: string;
  assignedWorkerId?: string;
}

export const onRequestUpdated = onDocumentUpdated(
  "serviceRequests/{requestId}",
  async (event) => {
    const requestId = event.params.requestId;
    const before = event.data?.before.data() as Request;
    const after = event.data?.after.data() as Request;

    if (!before || !after) {
      logger.warn(`Request data missing in update event for ${requestId}`);
      return;
    }

    const statusChanged = before.status !== after.status;
    const pendingPoolCouldChange =
      (before.status === REQUEST_STATUSES.PENDING && !before.assignedWorkerId) ||
      (after.status === REQUEST_STATUSES.PENDING && !after.assignedWorkerId) ||
      before.assignedWorkerId !== after.assignedWorkerId;

    try {

    if (
      statusChanged &&
      after.status === REQUEST_STATUSES.PENDING &&
      !after.assignedWorkerId
    ) {
      const result = await attemptRequestAssignment(requestId, after);
      await bumpPendingRequestPoolSignal();
      logger.info(`Reassignment result for request ${requestId}: ${result}`);
    }

    if (pendingPoolCouldChange) {
      await bumpPendingRequestPoolSignal();
    }

    if (!statusChanged) {
      return; // Only handle status changes after non-status assignment updates
    }

    logger.info(`Request ${requestId} status changed: ${before.status} → ${after.status}`);

      // Send notifications based on status transitions
      const notifications: Array<{ userId: string; title: string; body: string; type: string }> = [];

      switch (after.status) {
        case "assigned":
          // Notify worker that they've been assigned
          if (after.assignedWorkerId) {
            notifications.push({
              userId: after.assignedWorkerId,
              type: "assignment",
              title: "New Job Assignment",
              body: "You've been assigned a new service request",
            });
          }
          break;

        case "accepted":
          // Notify resident that worker accepted
          notifications.push({
            userId: after.residentId,
            type: "acceptance",
            title: "Job Accepted",
            body: "Your assigned worker has accepted the job",
          });
          break;

        case "acceptance_expired":
          notifications.push({
            userId: after.residentId,
            type: "system",
            title: "Worker Did Not Proceed",
            body: "Your worker accepted more than 24 hours ago but has not arrived. Please cancel or repost the request.",
          });
          break;

        case "worker_arrived":
          // Notify resident that worker has arrived
          notifications.push({
            userId: after.residentId,
            type: "arrival",
            title: "Worker Arrived",
            body: "Your worker has arrived at the location",
          });
          break;

        case "price_confirmed":
          // Notify resident about final price
          notifications.push({
            userId: after.residentId,
            type: "system",
            title: "Price Confirmed",
            body: "Worker has set the final price. Please review.",
          });
          break;

        case "in_progress":
          // Notify resident that work is in progress
          notifications.push({
            userId: after.residentId,
            type: "system",
            title: "Work In Progress",
            body: "The worker is now performing the service",
          });
          break;

        case "completed":
          // Notify resident that work is complete
          notifications.push({
            userId: after.residentId,
            type: "system",
            title: "Work Completed",
            body: "The worker has completed the service. Please submit payment.",
          });

          // Notify worker that work is complete
          if (after.assignedWorkerId) {
            notifications.push({
              userId: after.assignedWorkerId,
              type: "system",
              title: "Work Completed",
              body: "Awaiting payment submission from resident",
            });
          }
          break;

        case "cancelled":
          // Notify both parties about cancellation
          notifications.push({
            userId: after.residentId,
            type: "system",
            title: "Job Cancelled",
            body: "Your service request has been cancelled",
          });

          if (after.assignedWorkerId) {
            notifications.push({
              userId: after.assignedWorkerId,
              type: "system",
              title: "Job Cancelled",
              body: "Your assigned job has been cancelled",
            });
          }
          break;
      }

      // Write all notifications to Firestore
      for (const notif of notifications) {
        await db.collection("notifications").add({
          userId: notif.userId,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          referenceType: "request",
          referenceId: requestId,
          isRead: false,
          createdAt: new Date(),
        });

        logger.info(`Notification sent to ${notif.userId}: ${notif.type}`);
      }
    } catch (error) {
      logger.error(`Failed to process request status update for ${requestId}:`, error);
    }
  }
);
