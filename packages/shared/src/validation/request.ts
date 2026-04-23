import { z } from "zod";

export const createRequestSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  itemId: z.string().min(1, "Service item is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  suggestedPrice: z.number().nonnegative("Price cannot be negative"),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  locationAddress: z.string().optional(),
  photoUrls: z.array(z.string()).optional().default([]),
  schedule: z.object({
    date: z.string().min(1, "Date is required"),
    startTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Invalid time format"),
    endTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Invalid time format"),
  }),
  paymentMethod: z.enum(["gcash", "cash"]),
  tipAmount: z.number().nonnegative("Tip cannot be negative").optional().default(0),
  isSpecialRequest: z.boolean().optional().default(false),
  specialRequestNote: z.string().optional(),
});

export const specialRequestSchema = createRequestSchema.extend({
  beneficiary: z.object({
    firstName: z.string().min(1, "Beneficiary first name is required"),
    lastName: z.string().min(1, "Beneficiary last name is required"),
    contactNumber: z
      .string()
      .min(10, "Contact number must be at least 10 digits")
      .regex(/^(\+63|0)\d{10}$/, "Invalid Philippine phone number format"),
  }),
  isSpecialRequest: z.literal(true),
  specialRequestNote: z.string().min(1, "Reason for special request is required"),
});

export const setFinalPriceSchema = z.object({
  finalPrice: z.number().positive("Final price must be positive"),
  priceChangeReason: z.string().optional(),
});

export const approvePriceOverrideSchema = z.object({
  approved: z.boolean().optional().default(true),
  rejectionReason: z.string().optional(),
});

export const rateWorkerSchema = z.object({
  rating: z.number().int().min(1).max(5),
  ratingComment: z.string().optional(),
});

export const cancelRequestSchema = z.object({
  reason: z.string().optional(),
});

export const updateScheduleSchema = z.object({
  schedule: z.object({
    date: z.string().min(1, "Date is required"),
    startTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Invalid time format"),
    endTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Invalid time format"),
  }),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema> & {
  photoUrls?: string[];
};
export type SpecialRequestInput = z.infer<typeof specialRequestSchema> & {
  photoUrls?: string[];
};
export type SetFinalPriceInput = z.infer<typeof setFinalPriceSchema>;
export type ApprovePriceOverrideInput = z.infer<
  typeof approvePriceOverrideSchema
>;
export type RateWorkerInput = z.infer<typeof rateWorkerSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
