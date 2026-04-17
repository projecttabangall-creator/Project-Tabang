import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  createEmergencySchema,
  awardCreditSchema,
  approveApplicantSchema,
} from "@tabang/shared";
import {
  createEmergency,
  listEmergencies,
  getEmergency,
  cancelEmergency,
  completeEmergency,
  applyToEmergency,
  reviewApplicant,
  awardApplicantCredits,
} from "../controllers/emergency.controller";

export const emergencyRouter = Router();

emergencyRouter.use(verifyToken);

// Admin creates a broadcast
emergencyRouter.post(
  "/",
  roleGuard("admin"),
  validate(createEmergencySchema),
  createEmergency
);

// Any authenticated role can list (response is filtered per-role)
emergencyRouter.get("/", listEmergencies);

// Detail (role-filtered)
emergencyRouter.get("/:id", getEmergency);

// Admin lifecycle actions
emergencyRouter.patch("/:id/cancel", roleGuard("admin"), cancelEmergency);
emergencyRouter.patch("/:id/complete", roleGuard("admin"), completeEmergency);

// Worker applies
emergencyRouter.post("/:id/apply", roleGuard("worker"), applyToEmergency);

// Admin reviews/approves applicants
emergencyRouter.patch(
  "/:id/applicants/:workerId/approve",
  roleGuard("admin"),
  validate(approveApplicantSchema),
  reviewApplicant
);

// Admin awards credits
emergencyRouter.patch(
  "/:id/applicants/:workerId/award",
  roleGuard("admin"),
  validate(awardCreditSchema),
  awardApplicantCredits
);
