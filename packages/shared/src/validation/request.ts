import { z } from "zod";

export const createRequestSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  itemId: z.string().min(1, "Service item is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  suggestedPrice: z.number().positive("Price must be positive"),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  locationAddress: z.string().optional(),
  photoUrls: z.array(z.string()).optional().default([]),
  schedule: z.object({
    date: z.string().min(1, "Date is required"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  }),
  paymentMethod: z.enum(["gcash", "cash"]),
  isSpecialRequest: z.boolean().optional().default(false),
  specialRequestNote: z.string().optional(),
});

export const setFinalPriceSchema = z.object({
  finalPrice: z.number().positive("Final price must be positive"),
  priceChangeReason: z.string().optional(),
});

export const rateWorkerSchema = z.object({
  rating: z.number().int().min(1).max(5),
  ratingComment: z.string().optional(),
});

export const cancelRequestSchema = z.object({
  reason: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema> & {
  photoUrls?: string[];
};
export type SetFinalPriceInput = z.infer<typeof setFinalPriceSchema>;
export type RateWorkerInput = z.infer<typeof rateWorkerSchema>;
