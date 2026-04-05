import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";

export const disputeRouter = Router();

disputeRouter.use(verifyToken);

// POST /api/disputes — file dispute (resident or worker)
disputeRouter.post(
  "/",
  roleGuard("resident", "worker"),
  async (_req, res) => {
    res.status(501).json({ message: "Coming in Phase 4" });
  }
);

// GET /api/disputes — list all disputes (admin)
disputeRouter.get("/", roleGuard("admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});

// GET /api/disputes/:id — get dispute detail
disputeRouter.get("/:id", async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});

// PATCH /api/disputes/:id/resolve — resolve dispute (admin)
disputeRouter.patch("/:id/resolve", roleGuard("admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 4" });
});
