export type DisputeType =
  | "work_quality"
  | "payment"
  | "no_show"
  | "behavior_safety"
  | "other";

export type DisputeStatus = "open" | "under_review" | "resolved";

export type DisputeResolution =
  | "favor_resident"
  | "favor_worker"
  | "partial"
  | "escalated";

export interface CreditDeduction {
  userId: string;
  amount: number;
}

export interface Dispute {
  id: string;
  requestId: string;
  filedBy: string;
  filedAgainst: string;
  disputeType: DisputeType;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  resolution?: DisputeResolution;
  resolutionNotes?: string;
  priceAdjustment?: number;
  creditDeductions: CreditDeduction[];
  resolvedBy?: string;
  createdAt: Date;
  resolvedAt?: Date;
  deadline: Date; // createdAt + 72hrs
}
