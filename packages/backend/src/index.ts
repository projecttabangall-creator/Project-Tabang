import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import helmet from "helmet";

// Import routes
import { authRouter } from "./routes/auth.routes";
import { categoryRouter } from "./routes/category.routes";
import { requestRouter } from "./routes/request.routes";
import { workerRouter } from "./routes/worker.routes";
import { paymentRouter } from "./routes/payment.routes";
import { disputeRouter } from "./routes/dispute.routes";
import { adminRouter } from "./routes/admin.routes";
import { emergencyRouter } from "./routes/emergency.routes";
import { superadminRouter } from "./routes/superadmin.routes";

// Import triggers
import { onRequestCreated } from "./triggers/onRequestCreated";
import { onRequestUpdated } from "./triggers/onRequestUpdated";

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/requests", requestRouter);
app.use("/api/workers", workerRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/disputes", disputeRouter);
app.use("/api/admin", adminRouter);
app.use("/api/emergencies", emergencyRouter);
app.use("/api/superadmin", superadminRouter);

// Export as Firebase Cloud Function
export const api = functions.https.onRequest(app);

// Export Firestore triggers
export { onRequestCreated, onRequestUpdated };
