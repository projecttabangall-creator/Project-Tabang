// Pricing
export const DEFAULT_COMMISSION_PERCENT = 10;
export const DEFAULT_CANCELLATION_PENALTY_PERCENT = 20;
export const MAX_PRICE_MULTIPLIER = 2; // final price cannot exceed 2x suggested

// Credit Points
export const DEFAULT_CREDIT_POINTS = 5;
export const MAX_CREDIT_POINTS = 5;
export const MIN_CREDIT_POINTS = 1;
export const CREDIT_FLAG_THRESHOLD = 3;
export const CREDIT_SUSPENSION_THRESHOLD = 2;
export const CREDIT_DEDUCTION_AT_FAULT = 2;
export const CREDIT_DEDUCTION_BOTH_FAULT = 1;
export const CREDIT_DEDUCTION_FALSE_REPORT = 2;

// Disputes
export const DISPUTE_DEADLINE_HOURS = 72;
export const DISPUTE_FILING_WINDOW_HOURS = 24;

// Assignment Algorithm Weights
export const ASSIGNMENT_WEIGHTS = {
  FREQUENCY: 0.50,
  RATING: 0.35,
  LOCATION: 0.15,
} as const;

export const DEFAULT_NEW_WORKER_RATING_SCORE = 0.6;
export const MIN_CREDIT_FOR_ASSIGNMENT = 3;
// Workers with fewer completed jobs than this threshold are treated as "rookies":
// they bypass the auto-assignment scoring and instead see ALL pending requests in their
// specialization on a first-come-first-served basis.
export const ROOKIE_JOB_THRESHOLD = 5;

// Map
export const DEFAULT_MAP_CENTER = {
  latitude: 10.3456,
  longitude: 123.9132,
} as const; // Banilad, Cebu City

// Initial service categories
export const INITIAL_CATEGORIES = [
  "Carpentry",
  "Plumbing",
  "Electrician",
  "Masonry",
  "Appliance Repair",
] as const;
