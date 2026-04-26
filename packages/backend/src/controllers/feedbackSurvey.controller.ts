import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

const surveysRef = db.collection("feedbackSurveys");
const usersRef = db.collection("users");

const VALID_RATING_KEYS = [
  "overallSatisfaction",
  "easeOfUse",
  "communicationQuality",
  "wouldRecommend",
];

/**
 * Create one feedback survey per party (resident & worker) when admin confirms
 * a payment. Idempotent — skips if a survey already exists for that party.
 */
export async function createSurveysForPayment(input: {
  requestId: string;
  paymentId: string;
  residentId: string;
  workerId?: string | null;
  categoryName?: string;
  finalPrice?: number;
}): Promise<void> {
  const recipients: Array<{ userId: string; role: "resident" | "worker" }> = [];
  if (input.residentId) {
    recipients.push({ userId: input.residentId, role: "resident" });
  }
  if (input.workerId) {
    recipients.push({ userId: input.workerId, role: "worker" });
  }

  for (const r of recipients) {
    const existing = await surveysRef
      .where("requestId", "==", input.requestId)
      .where("userId", "==", r.userId)
      .limit(1)
      .get();
    if (!existing.empty) continue;

    const doc = await surveysRef.add({
      userId: r.userId,
      role: r.role,
      requestId: input.requestId,
      paymentId: input.paymentId,
      categoryName: input.categoryName || "",
      finalPrice: typeof input.finalPrice === "number" ? input.finalPrice : null,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("notifications").add({
      userId: r.userId,
      type: "feedback_survey",
      title: "Share your experience",
      body: "Tell us how Project Tabang worked for you on this completed job.",
      referenceType: "feedbackSurvey",
      referenceId: doc.id,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * GET /api/feedback-surveys/my
 * Returns surveys assigned to the current user. Defaults to pending only,
 * because the prompt UI only ever shows undismissed/unsubmitted surveys.
 */
export async function listMySurveys(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.uid;
  const status =
    typeof req.query.status === "string" ? req.query.status : "pending";

  try {
    let query: FirebaseFirestore.Query = surveysRef.where("userId", "==", userId);
    if (status && status !== "all") {
      query = query.where("status", "==", status);
    }
    const snap = await query.get();
    const surveys = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort(
        (a: any, b: any) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
    res.json({ surveys });
  } catch (error) {
    console.error("List my surveys error:", error);
    res.status(500).json({ error: "Failed to load feedback surveys" });
  }
}

/**
 * PATCH /api/feedback-surveys/:id/dismiss
 * Owner opts out of this survey. It won't show as a prompt again.
 */
export async function dismissSurvey(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user!.uid;

  try {
    const docRef = surveysRef.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Survey not found" });
      return;
    }
    const data = doc.data()!;
    if (data.userId !== userId) {
      res.status(403).json({ error: "This survey is not yours" });
      return;
    }
    if (data.status !== "pending") {
      res.status(400).json({ error: "Survey is no longer pending" });
      return;
    }
    await docRef.update({
      status: "dismissed",
      dismissedAt: FieldValue.serverTimestamp(),
    });
    res.json({ message: "Maybe next time — thanks!" });
  } catch (error) {
    console.error("Dismiss survey error:", error);
    res.status(500).json({ error: "Failed to dismiss survey" });
  }
}

/**
 * GET /api/feedback-surveys/:id
 */
export async function getSurvey(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user!.uid;
  const role = req.user!.role;

  try {
    const doc = await surveysRef.doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Survey not found" });
      return;
    }
    const data = doc.data()!;
    if (
      data.userId !== userId &&
      role !== "admin" &&
      role !== "superadmin"
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    res.json({ survey: { id: doc.id, ...data } });
  } catch (error) {
    console.error("Get survey error:", error);
    res.status(500).json({ error: "Failed to load survey" });
  }
}

/**
 * PATCH /api/feedback-surveys/:id/submit
 * Owner submits their survey responses.
 */
export async function submitSurvey(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const id = req.params.id as string;
  const userId = req.user!.uid;

  try {
    const docRef = surveysRef.doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Survey not found" });
      return;
    }
    const data = doc.data()!;
    if (data.userId !== userId) {
      res.status(403).json({ error: "This survey is not yours" });
      return;
    }
    if (data.status === "submitted") {
      res.status(400).json({ error: "Survey already submitted" });
      return;
    }

    const ratingsRaw = req.body?.ratings || {};
    const ratings: Record<string, number> = {};
    for (const key of VALID_RATING_KEYS) {
      const v = Number(ratingsRaw[key]);
      if (Number.isFinite(v) && v >= 1 && v <= 5) {
        ratings[key] = Math.round(v);
      }
    }
    if (Object.keys(ratings).length === 0) {
      res.status(400).json({ error: "Please provide at least one rating" });
      return;
    }

    const comment =
      typeof req.body?.comment === "string"
        ? req.body.comment.trim().slice(0, 1000)
        : "";

    await docRef.update({
      status: "submitted",
      ratings,
      comment,
      submittedAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "Thanks for your feedback!" });
  } catch (error) {
    console.error("Submit survey error:", error);
    res.status(500).json({ error: "Failed to submit survey" });
  }
}

/**
 * GET /api/feedback-surveys
 * Admin-only: list all surveys (defaults to submitted).
 */
export async function listAllSurveys(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const status = typeof req.query.status === "string" ? req.query.status : "submitted";

  try {
    let query: FirebaseFirestore.Query = surveysRef;
    if (status && status !== "all") {
      query = query.where("status", "==", status);
    }
    const snap = await query.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    // Hydrate user names so admin can see who submitted
    const userIds = [...new Set(docs.map((s) => s.userId).filter(Boolean))];
    const userMap = new Map<string, FirebaseFirestore.DocumentData>();
    await Promise.all(
      userIds.map(async (uid) => {
        const u = await usersRef.doc(uid).get();
        if (u.exists) userMap.set(uid, u.data()!);
      })
    );

    const hydrated = docs
      .map((s) => {
        const u = userMap.get(s.userId);
        return {
          ...s,
          userName: u
            ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
            : "(unknown user)",
          userContact: u?.contactNumber ?? "",
        };
      })
      .sort(
        (a: any, b: any) =>
          (b.submittedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
          (a.submittedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
      );

    res.json({ surveys: hydrated });
  } catch (error) {
    console.error("List all surveys error:", error);
    res.status(500).json({ error: "Failed to load surveys" });
  }
}
