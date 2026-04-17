export type EmergencyStatus = "active" | "completed" | "cancelled";

export type ApplicantStatus = "pending" | "approved" | "rejected";

export interface EmergencyApplicant {
  workerId: string;
  workerName: string;
  appliedAt: Date;
  approvalStatus: ApplicantStatus;
  approvedAt?: Date;
  creditAwarded?: number;
  awardedAt?: Date;
}

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
}

export interface EmergencyBroadcast {
  id: string;
  createdByAdminId: string;
  title: string;
  requesterName: string;
  requesterContact: string;
  categoryIds: string[];
  categoryNames: string[];
  details: string;
  needsList: string[];
  photoUrls: string[];
  location: EmergencyLocation;
  locationAddress: string;
  affectedFamilies: number;
  durationHours: number;
  expiresAt: Date;
  creditReward: number; // admin-only
  status: EmergencyStatus;
  applicants: EmergencyApplicant[];
  createdAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}
