import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { validate } from "../middleware/validate";
import { registerWorkerSchema } from "@tabang/shared";
import {
  registerWorker,
  listWorkers,
  getWorker,
  verifyWorker,
  toggleAvailability,
  updateSchedule,
  updateLocation,
} from "../controllers/worker.controller";

export const workerRouter = Router();

workerRouter.use(verifyToken);

// POST /api/workers/register — admin registers worker
workerRouter.post(
  "/register",
  roleGuard("admin"),
  validate(registerWorkerSchema),
  registerWorker
);

// GET /api/workers — list all workers (admin)
workerRouter.get("/", roleGuard("admin"), listWorkers);

// GET /api/workers/:id — get worker profile
workerRouter.get("/:id", roleGuard("admin", "worker"), getWorker);

// PATCH /api/workers/:id/verify — verify and activate worker (admin)
workerRouter.patch("/:id/verify", roleGuard("admin"), verifyWorker);

// PATCH /api/workers/:id/availability — toggle availability
workerRouter.patch("/:id/availability", roleGuard("worker"), toggleAvailability);

// PATCH /api/workers/:id/schedule — update availability schedule
workerRouter.patch("/:id/schedule", roleGuard("worker"), updateSchedule);

// PATCH /api/workers/:id/location — update GPS coordinates
workerRouter.patch("/:id/location", roleGuard("worker"), updateLocation);
