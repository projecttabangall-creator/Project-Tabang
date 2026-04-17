import { z } from "zod";

export const createEmergencySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
  requesterName: z.string().min(2, "Requester name is required"),
  requesterContact: z.string().min(7, "Requester contact is required"),
  categoryIds: z.array(z.string().min(1)).min(1, "Select at least one category"),
  details: z.string().min(10, "Details must be at least 10 characters"),
  needsList: z.array(z.string().min(1)).optional().default([]),
  photoUrls: z.array(z.string()).optional().default([]),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  locationAddress: z.string().min(1, "Location address is required"),
  affectedFamilies: z.number().int().nonnegative(),
  durationHours: z
    .number()
    .int()
    .positive("Duration must be positive")
    .max(168, "Duration cannot exceed 7 days"),
  creditReward: z
    .number()
    .int()
    .min(1, "Credit reward must be at least 1")
    .max(5, "Credit reward cannot exceed 5"),
});

export const awardCreditSchema = z.object({
  amount: z
    .number()
    .int()
    .min(1, "Credit amount must be at least 1")
    .max(5, "Credit amount cannot exceed 5"),
});

export const approveApplicantSchema = z.object({
  approvalStatus: z.enum(["approved", "rejected"]),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;
export type AwardCreditInput = z.infer<typeof awardCreditSchema>;
export type ApproveApplicantInput = z.infer<typeof approveApplicantSchema>;
