import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { MIN_CREDIT_FOR_ASSIGNMENT, ROLES } from "@tabang/shared";
import { db } from "../config/firebase";
import { attemptRequestAssignment } from "../services/requestAssignment.service";

function toSpecArray(val: any): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val.filter((v) => typeof v === "string") : [val];
}

function isWorkerEligible(u: any): boolean {
  if (!u || u.role !== ROLES.WORKER) return false;
  return (
    u.accountStatus === "active" &&
    u.isVerified === true &&
    u.isActive === true &&
    u.workerData?.isAvailable === true &&
    (typeof u.creditPoints === "number" ? u.creditPoints : 0) >=
      MIN_CREDIT_FOR_ASSIGNMENT
  );
}

export const onUserUpdated = onDocumentUpdated(
  "users/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!after || after.role !== ROLES.WORKER) return;

    const wasEligible = isWorkerEligible(before);
    const nowEligible = isWorkerEligible(after);

    const scheduleChanged =
      JSON.stringify(before?.workerData?.availability) !==
      JSON.stringify(after?.workerData?.availability);
    const specsChanged =
      JSON.stringify(before?.workerData?.specialization) !==
      JSON.stringify(after?.workerData?.specialization);

    const becameEligible = !wasEligible && nowEligible;
    const eligibleAndChanged =
      nowEligible && (scheduleChanged || specsChanged);

    if (!becameEligible && !eligibleAndChanged) return;

    const specs = toSpecArray(after.workerData?.specialization);
    if (specs.length === 0) return;

    logger.info(
      `Worker ${uid} became assignment-eligible — scanning pending requests`,
      { becameEligible, scheduleChanged, specsChanged, specs }
    );

    try {
      const pendingSnaps = await Promise.all(
        specs.map((categoryId) =>
          db
            .collection("serviceRequests")
            .where("categoryId", "==", categoryId)
            .where("status", "==", "pending")
            .where("assignedWorkerId", "==", null)
            .get()
        )
      );

      const pendingRequests = pendingSnaps.flatMap((s) => s.docs);
      logger.info(
        `Found ${pendingRequests.length} pending request(s) to evaluate for worker ${uid}`
      );

      for (const requestDoc of pendingRequests) {
        try {
          await attemptRequestAssignment(requestDoc.id, requestDoc.data());
        } catch (err) {
          logger.error(
            `onUserUpdated: assignment attempt failed for request ${requestDoc.id}`,
            err
          );
        }
      }
    } catch (err) {
      logger.error(`onUserUpdated scan failed for worker ${uid}`, err);
    }
  }
);
