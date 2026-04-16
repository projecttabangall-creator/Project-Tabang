import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  approvePriceOverrideSchema,
  createRequestSchema,
  rateWorkerSchema,
  setFinalPriceSchema,
  updateScheduleSchema,
} from "@tabang/shared";
import {
  acceptRequest,
  approvePriceOverride,
  cancelRequest,
  completeRequest,
  createRequest,
  getMyRequests,
  getRequest,
  listRequests,
  markArrived,
  rateWorker,
  rejectRequest,
  setFinalPrice,
  updateSchedule,
} from "../controllers/request.controller";

export const requestRouter = Router();

requestRouter.use(verifyToken);

requestRouter.post(
  "/",
  roleGuard("resident", "admin"),
  validate(createRequestSchema),
  createRequest
);

requestRouter.get("/", roleGuard("admin"), listRequests);

requestRouter.get("/my", roleGuard("resident", "worker"), getMyRequests);

requestRouter.get("/:id", getRequest);

requestRouter.patch("/:id/accept", roleGuard("worker"), acceptRequest);

requestRouter.patch("/:id/reject", roleGuard("worker"), rejectRequest);

requestRouter.patch("/:id/arrived", roleGuard("worker"), markArrived);

requestRouter.patch(
  "/:id/final-price",
  roleGuard("worker"),
  validate(setFinalPriceSchema),
  setFinalPrice
);

requestRouter.patch("/:id/complete", roleGuard("worker"), completeRequest);

requestRouter.patch(
  "/:id/cancel",
  roleGuard("resident", "worker", "admin"),
  cancelRequest
);

requestRouter.patch(
  "/:id/schedule",
  roleGuard("resident"),
  validate(updateScheduleSchema),
  updateSchedule
);

requestRouter.post(
  "/:id/rate",
  roleGuard("resident"),
  validate(rateWorkerSchema),
  rateWorker
);

requestRouter.patch(
  "/:id/approve-price-override",
  roleGuard("admin"),
  validate(approvePriceOverrideSchema),
  approvePriceOverride
);
