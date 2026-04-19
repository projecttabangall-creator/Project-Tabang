import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import {
  registerAdmin,
  listAdmins,
  updateAdminStatus,
  deleteAdmin,
} from "../controllers/superadmin.controller";

export const superadminRouter = Router();

superadminRouter.use(verifyToken);
superadminRouter.use(roleGuard("superadmin"));

superadminRouter.post("/register-admin", registerAdmin);
superadminRouter.get("/admins", listAdmins);
superadminRouter.patch("/admins/:id/status", updateAdminStatus);
superadminRouter.delete("/admins/:id", deleteAdmin);
