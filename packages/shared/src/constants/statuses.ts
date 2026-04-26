export const REQUEST_STATUSES = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  ACCEPTED: "accepted",
  ACCEPTANCE_EXPIRED: "acceptance_expired",
  WORKER_ARRIVED: "worker_arrived",
  PRICE_CONFIRMED: "price_confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  PAYMENT_SUBMITTED: "payment_submitted",
  PAYMENT_CONFIRMED: "payment_confirmed",
  CANCELLED: "cancelled",
  UNDER_DISPUTE: "under_dispute",
  RESOLVED: "resolved",
} as const;

export const PAYMENT_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export const DISPUTE_STATUSES = {
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  RESOLVED: "resolved",
} as const;

export const ACCOUNT_STATUSES = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  BANNED: "banned",
} as const;
