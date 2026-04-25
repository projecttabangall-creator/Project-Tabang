import { Router } from "express";
import { validate } from "../middleware/validate";
import {
  changePasswordSchema,
  registerResidentSchema,
  loginSchema,
  requestPasswordResetSchema,
} from "@tabang/shared";
import {
  changePassword,
  requestPasswordReset,
  registerResident,
  login,
  getCurrentUser,
  updateProfile,
} from "../controllers/auth.controller";
import { verifyToken } from "../middleware/auth";

export const authRouter = Router();

// Public routes
authRouter.post("/register", validate(registerResidentSchema), registerResident);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post(
  "/request-password-reset",
  validate(requestPasswordResetSchema),
  requestPasswordReset
);

// Protected routes
authRouter.get("/me", verifyToken, getCurrentUser);
authRouter.patch("/profile", verifyToken, updateProfile);
authRouter.post(
  "/change-password",
  verifyToken,
  validate(changePasswordSchema),
  changePassword
);
