import { Router } from "express";
import { validate } from "../middleware/validate";
import {
  changePasswordSchema,
  registerResidentSchema,
  loginSchema,
  resolveLoginIdentifierSchema,
  requestPasswordResetSchema,
  updateBiometricEnrollmentSchema,
} from "@tabang/shared";
import {
  changePassword,
  requestPasswordReset,
  registerResident,
  login,
  getCurrentUser,
  requestNameChange,
  resolveLoginIdentifier,
  syncEmailVerification,
  updateProfile,
  updateBiometricEnrollment,
} from "../controllers/auth.controller";
import { verifyToken } from "../middleware/auth";

export const authRouter = Router();

// Public routes
authRouter.post("/register", validate(registerResidentSchema), registerResident);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post(
  "/resolve-login-identifier",
  validate(resolveLoginIdentifierSchema),
  resolveLoginIdentifier
);
authRouter.post(
  "/request-password-reset",
  validate(requestPasswordResetSchema),
  requestPasswordReset
);

// Protected routes
authRouter.get("/me", verifyToken, getCurrentUser);
authRouter.patch("/profile", verifyToken, updateProfile);
authRouter.post("/profile/name-change-request", verifyToken, requestNameChange);
authRouter.post("/profile/sync-email-verification", verifyToken, syncEmailVerification);
authRouter.patch(
  "/profile/biometric",
  verifyToken,
  validate(updateBiometricEnrollmentSchema),
  updateBiometricEnrollment
);
authRouter.post(
  "/change-password",
  verifyToken,
  validate(changePasswordSchema),
  changePassword
);
