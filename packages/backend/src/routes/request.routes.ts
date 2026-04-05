import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { createRequestSchema, setFinalPriceSchema, rateWorkerSchema } from "@tabang/shared";
import {
  createRequest,
  getMyRequests,
  getRequest,
  acceptRequest,
  rejectRequest,
  markArrived,
  setFinalPrice,
  completeRequest,
  cancelRequest,
  rateWorker,
} from "../controllers/request.controller";

export const requestRouter = Router();

requestRouter.use(verifyToken);

// POST /api/requests — create service request (resident or admin)
requestRouter.post(
  "/",
  roleGuard("resident", "admin"),
  validate(createRequestSchema),
  createRequest
);

// GET /api/requests/my — get my requests (resident or worker)
requestRouter.get(
  "/my",
  roleGuard("resident", "worker"),
  getMyRequests
);

// GET /api/requests/:id — get request detail
requestRouter.get("/:id", getRequest);

// PATCH /api/requests/:id/accept — worker accepts (worker only)
requestRouter.patch(
  "/:id/accept",
  roleGuard("worker"),
  acceptRequest
);

// PATCH /api/requests/:id/reject — worker rejects (worker only)
requestRouter.patch(
  "/:id/reject",
  roleGuard("worker"),
  rejectRequest
);

// PATCH /api/requests/:id/arrived — worker marks arrival (worker only)
requestRouter.patch(
  "/:id/arrived",
  roleGuard("worker"),
  markArrived
);

// PATCH /api/requests/:id/final-price — worker sets final price (worker only)
requestRouter.patch(
  "/:id/final-price",
  roleGuard("worker"),
  validate(setFinalPriceSchema),
  setFinalPrice
);

// PATCH /api/requests/:id/complete — worker completes job (worker only)
requestRouter.patch(
  "/:id/complete",
  roleGuard("worker"),
  completeRequest
);

// PATCH /api/requests/:id/cancel — cancel request (resident or worker)
requestRouter.patch(
  "/:id/cancel",
  roleGuard("resident", "worker"),
  cancelRequest
);

// POST /api/requests/:id/rate — rate worker (resident only)
requestRouter.post(
  "/:id/rate",
  roleGuard("resident"),
  validate(rateWorkerSchema),
  rateWorker
);

// Placeholder for Phase 3+ features
requestRouter.get("/", async (_req, res) => {
  res.status(501).json({ message: "List all requests - Coming in Phase 5 (admin)" });
});

requestRouter.patch("/:id/approve-price-override", async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3 (admin approval)" });
});
