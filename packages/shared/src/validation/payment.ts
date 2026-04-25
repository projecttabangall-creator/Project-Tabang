import { z } from "zod";

export const submitPaymentSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  proofUrl: z.string().min(1, "Proof of payment URL is required"),
  rating: z.number().int().min(1, "Please rate the worker").max(5, "Rating must be 1-5"),
  ratingComment: z.string().optional().default(""),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const fileDisputeSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  disputeTypes: z
    .array(
      z.enum([
        "work_quality",
        "payment",
        "no_show",
        "behavior_safety",
        "other",
      ])
    )
    .min(1, "Select at least one dispute type"),
  otherDetails: z.string().optional().default(""),
  description: z.string().min(10, "Description must be at least 10 characters"),
  evidenceUrls: z.array(z.string()).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.disputeTypes.includes("other") && !data.otherDetails?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherDetails"],
      message: "Please provide details for the 'Other' dispute type",
    });
  }
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(["favor_resident", "favor_worker", "partial", "escalated"]),
  resolutionNotes: z.string().min(1, "Resolution notes are required"),
  priceAdjustment: z.number().min(-100000).max(100000).optional(),
  creditDeductions: z
    .array(
      z.object({
        userId: z.string().min(1),
        amount: z.number().int().min(1).max(5),
      })
    )
    .optional()
    .default([]),
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
export type FileDisputeInput = z.infer<typeof fileDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
