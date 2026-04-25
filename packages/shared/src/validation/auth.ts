import { z } from "zod";
import { isWorkerCredentialType } from "../constants/workerCredentials";

const workerCredentialSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "Credential type is required")
    .refine((value) => isWorkerCredentialType(value), "Invalid credential type"),
  name: z.string().trim().min(1, "Credential name is required").optional(),
  fileUrl: z.string().trim().min(1, "Credential file URL is required"),
});

export const registerResidentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleInitial: z.string().max(3).optional(),
  contactNumber: z
    .string()
    .min(10, "Contact number must be at least 10 digits")
    .regex(/^(\+63|0)\d{10}$/, "Invalid Philippine phone number format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    houseLot: z.string().min(1, "House/Lot number is required"),
    blockNo: z.string().optional().default(""),
    barangay: z.string().min(1, "Barangay is required"),
  }),
});

export const registerWorkerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleInitial: z.string().max(1).optional(),
  birthday: z.string().min(1, "Birthday is required"),
  specialization: z.array(z.string()).min(1, "At least one specialization is required"),
  contactNumber: z
    .string()
    .min(10, "Contact number must be at least 10 digits")
    .regex(/^(\+63|0)\d{10}$/, "Invalid Philippine phone number format"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  address: z.object({
    street: z.string().min(1, "Street is required"),
    houseLot: z.string().min(1, "House/Lot number is required"),
    blockNo: z.string().optional().default(""),
    barangay: z.string().min(1, "Barangay is required"),
  }),
  credentials: z
    .array(workerCredentialSchema)
    .optional()
    .default([]),
  biometricEnrolled: z.boolean().optional().default(false),
  termsAcceptedAt: z.string().optional(),
});

export const loginSchema = z.object({
  contactNumber: z
    .string()
    .min(1, "Contact number is required")
    .regex(/^(\+63|0)\d{10}$/, "Invalid Philippine phone number format"),
  password: z.string().min(1, "Password is required"),
});

export const requestPasswordResetSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["resident", "worker"]),
  contactNumber: z
    .string()
    .min(1, "Contact number is required")
    .regex(/^(\+63|0)\d{10}$/, "Invalid Philippine phone number format"),
  note: z.string().trim().max(500).optional().default(""),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterResidentInput = z.infer<typeof registerResidentSchema>;
export type RegisterWorkerInput = z.infer<typeof registerWorkerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
