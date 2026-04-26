import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import {
  dismissSurvey,
  getSurvey,
  listAllSurveys,
  listMySurveys,
  submitSurvey,
} from "../controllers/feedbackSurvey.controller";

export const feedbackSurveyRouter = Router();

feedbackSurveyRouter.use(verifyToken);

// Admin: see all submitted feedback surveys
feedbackSurveyRouter.get("/", roleGuard("admin"), listAllSurveys);

// Logged-in user: list own surveys
feedbackSurveyRouter.get("/my", listMySurveys);

// Detail (owner or admin)
feedbackSurveyRouter.get("/:id", getSurvey);

// Submit (owner only)
feedbackSurveyRouter.patch("/:id/submit", submitSurvey);

// Dismiss / opt out (owner only)
feedbackSurveyRouter.patch("/:id/dismiss", dismissSurvey);
