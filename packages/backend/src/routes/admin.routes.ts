import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import {
  getDashboardStats,
  listUsers,
  updateUserStatus,
  adjustCreditPoints,
  getConfig,
  updateConfig,
  getSystemLogs,
} from "../controllers/admin.controller";

export const adminRouter = Router();

adminRouter.use(verifyToken);
adminRouter.use(roleGuard("admin"));

// GET /api/admin/dashboard — dashboard stats
adminRouter.get("/dashboard", getDashboardStats);

// GET /api/admin/users — list all users
adminRouter.get("/users", listUsers);

// PATCH /api/admin/users/:id/status — suspend/ban/activate user
adminRouter.patch("/users/:id/status", updateUserStatus);

// PATCH /api/admin/users/:id/credit — adjust credit points
adminRouter.patch("/users/:id/credit", adjustCreditPoints);

// GET /api/admin/config — get system config
adminRouter.get("/config", getConfig);

// PATCH /api/admin/config — update system config
adminRouter.patch("/config", updateConfig);

// GET /api/admin/logs — system logs
adminRouter.get("/logs", getSystemLogs);

// POST /api/admin/special-request — placeholder for Phase 5
adminRouter.post("/special-request", async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 5" });
});

// GET /api/admin/income — placeholder for Phase 5
adminRouter.get("/income", async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 5" });
});
