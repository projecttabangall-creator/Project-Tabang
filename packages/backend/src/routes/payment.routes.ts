import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";

export const paymentRouter = Router();

paymentRouter.use(verifyToken);

// POST /api/payments — submit payment proof (resident)
paymentRouter.post("/", roleGuard("resident"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});

// GET /api/payments/pending — list pending payments (admin)
paymentRouter.get("/pending", roleGuard("admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});

// PATCH /api/payments/:id/confirm — confirm payment (admin)
paymentRouter.patch("/:id/confirm", roleGuard("admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});

// PATCH /api/payments/:id/reject — reject payment proof (admin)
paymentRouter.patch("/:id/reject", roleGuard("admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});
