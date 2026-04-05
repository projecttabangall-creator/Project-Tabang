import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { submitPaymentSchema, rejectPaymentSchema } from "@tabang/shared";
import {
  submitPayment,
  getPendingPayments,
  getPayment,
  confirmPayment,
  rejectPayment,
} from "../controllers/payment.controller";

export const paymentRouter = Router();

paymentRouter.use(verifyToken);

// POST /api/payments — submit payment proof (resident)
paymentRouter.post(
  "/",
  roleGuard("resident"),
  validate(submitPaymentSchema),
  submitPayment
);

// GET /api/payments/pending — list pending payments (admin)
paymentRouter.get("/pending", roleGuard("admin"), getPendingPayments);

// GET /api/payments/:id — get payment detail
paymentRouter.get("/:id", getPayment);

// PATCH /api/payments/:id/confirm — confirm payment (admin)
paymentRouter.patch("/:id/confirm", roleGuard("admin"), confirmPayment);

// PATCH /api/payments/:id/reject — reject payment proof (admin)
paymentRouter.patch(
  "/:id/reject",
  roleGuard("admin"),
  validate(rejectPaymentSchema),
  rejectPayment
);
