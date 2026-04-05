import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";

export const requestRouter = Router();

requestRouter.use(verifyToken);

// POST /api/requests — create service request (resident or admin for special requests)
requestRouter.post("/", roleGuard("resident", "admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// GET /api/requests/my — get my requests (resident)
requestRouter.get("/my", roleGuard("resident"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// GET /api/requests/:id — get request detail
requestRouter.get("/:id", async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// GET /api/requests — list all requests (admin)
requestRouter.get("/", roleGuard("admin"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// PATCH /api/requests/:id/accept — worker accepts
requestRouter.patch("/:id/accept", roleGuard("worker"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// PATCH /api/requests/:id/reject — worker rejects
requestRouter.patch("/:id/reject", roleGuard("worker"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// PATCH /api/requests/:id/arrived — worker arrives
requestRouter.patch("/:id/arrived", roleGuard("worker"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// PATCH /api/requests/:id/final-price — worker sets final price
requestRouter.patch(
  "/:id/final-price",
  roleGuard("worker"),
  async (_req, res) => {
    res.status(501).json({ message: "Coming in Phase 3" });
  }
);

// PATCH /api/requests/:id/complete — worker completes job
requestRouter.patch("/:id/complete", roleGuard("worker"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// PATCH /api/requests/:id/cancel — cancel request
requestRouter.patch(
  "/:id/cancel",
  roleGuard("resident", "worker"),
  async (_req, res) => {
    res.status(501).json({ message: "Coming in Phase 3" });
  }
);

// POST /api/requests/:id/rate — rate worker
requestRouter.post("/:id/rate", roleGuard("resident"), async (_req, res) => {
  res.status(501).json({ message: "Coming in Phase 3" });
});

// PATCH /api/requests/:id/approve-price-override — admin approves >2x price
requestRouter.patch(
  "/:id/approve-price-override",
  roleGuard("admin"),
  async (_req, res) => {
    res.status(501).json({ message: "Coming in Phase 3" });
  }
);
