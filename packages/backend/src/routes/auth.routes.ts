import { Router } from "express";
import { validate } from "../middleware/validate";
import {
  registerResidentSchema,
  loginSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  confirmResetPasswordSchema,
} from "@tabang/shared";
import {
  registerResident,
  verifyOtp,
  login,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
} from "../controllers/auth.controller";
import { verifyToken } from "../middleware/auth";

export const authRouter = Router();

// Public routes
authRouter.post("/register", validate(registerResidentSchema), registerResident);
authRouter.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/reset-password", validate(resetPasswordSchema), resetPassword);
authRouter.post(
  "/reset-password/confirm",
  validate(confirmResetPasswordSchema),
  confirmResetPassword
);

// Protected routes
authRouter.get("/me", verifyToken, getCurrentUser);
