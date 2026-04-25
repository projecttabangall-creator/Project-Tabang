import { Router } from "express";
import { specialRequestSchema } from "@tabang/shared";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import {
  adjustCreditPoints,
  deleteUser,
  getAnalyticsStats,
  getConfig,
  getDashboardStats,
  getIncomeStats,
  getSystemLogs,
  listPasswordResetRequests,
  listUsers,
  resolvePasswordResetRequest,
  updateConfig,
  updateUserStatus,
} from "../controllers/admin.controller";
import { createSpecialRequest } from "../controllers/request.controller";

export const adminRouter = Router();

adminRouter.use(verifyToken);
adminRouter.use(roleGuard("admin"));

adminRouter.get("/dashboard", getDashboardStats);
adminRouter.get("/users", listUsers);
adminRouter.get("/password-reset-requests", listPasswordResetRequests);
adminRouter.patch("/password-reset-requests/:id", resolvePasswordResetRequest);
adminRouter.patch("/users/:id/status", updateUserStatus);
adminRouter.patch("/users/:id/credit", adjustCreditPoints);
adminRouter.delete("/users/:id", deleteUser);
adminRouter.get("/config", getConfig);
adminRouter.patch("/config", updateConfig);
adminRouter.get("/logs", getSystemLogs);
adminRouter.post(
  "/special-request",
  validate(specialRequestSchema),
  createSpecialRequest
);
adminRouter.get("/income", getIncomeStats);
adminRouter.get("/analytics", getAnalyticsStats);
