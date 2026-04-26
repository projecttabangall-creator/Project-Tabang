import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { sweepExpiredAcceptedRequests } from "../services/acceptanceTimeout.service";

export const onAcceptanceTimeoutSweep = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "Asia/Manila",
  },
  async () => {
    const expiredCount = await sweepExpiredAcceptedRequests();
    logger.info(`Acceptance timeout sweep expired ${expiredCount} request(s).`);
  }
);
