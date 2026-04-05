import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

export const createItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  minPrice: z.number().min(0, "Minimum price cannot be negative"),
  isFree: z.boolean().optional().default(false),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  minPrice: z.number().min(0).optional(),
  isFree: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
