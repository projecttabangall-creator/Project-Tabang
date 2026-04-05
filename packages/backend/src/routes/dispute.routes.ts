import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { fileDisputeSchema, resolveDisputeSchema } from "@tabang/shared";
import {
  fileDispute,
  listDisputes,
  getDispute,
  resolveDispute,
} from "../controllers/dispute.controller";

export const disputeRouter = Router();

disputeRouter.use(verifyToken);

// POST /api/disputes — file dispute (resident or worker)
disputeRouter.post(
  "/",
  roleGuard("resident", "worker"),
  validate(fileDisputeSchema),
  fileDispute
);

// GET /api/disputes — list all disputes (admin)
disputeRouter.get("/", roleGuard("admin"), listDisputes);

// GET /api/disputes/:id — get dispute detail
disputeRouter.get("/:id", getDispute);

// PATCH /api/disputes/:id/resolve — resolve dispute (admin)
disputeRouter.patch(
  "/:id/resolve",
  roleGuard("admin"),
  validate(resolveDisputeSchema),
  resolveDispute
);
