export interface Address {
  street: string;
  houseLot: string;
  blockNo: string;
  barangay: string;
}

export interface Credential {
  type: string; // "PSA" | "NBI" | "NC2" etc.
  name?: string;
  fileUrl: string;
  uploadedAt: Date;
}

export type AvailabilitySlot =
  | { type: "recurring"; dayOfWeek: number; startTime: string; endTime: string }
  | { type: "specific"; date: string; startTime: string; endTime: string }
  | { dayOfWeek: number; startTime: string; endTime: string }; // legacy/backward compat - treated as recurring

export interface WorkerData {
  specialization: string; // category ID
  credentials: Credential[];
  biometricEnrolled: boolean;
  averageRating: number;
  completedJobsCount: number;
  totalJobsAssigned: number;
  acceptanceRate: number;
  cancellationRate: number;
  reportsCount: number;
  lastAssignedAt: Date;
  location: {
    latitude: number;
    longitude: number;
  };
  availability: AvailabilitySlot[];
  isAvailable: boolean;
}

export type UserRole = "resident" | "worker" | "admin" | "superadmin";
export type AccountStatus = "active" | "suspended" | "banned";

export interface User {
  uid: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  birthday: Date;
  contactNumber: string;
  email?: string;
  address: Address;
  profilePhotoUrl?: string;
  creditPoints: number;
  isVerified: boolean;
  isActive: boolean;
  accountStatus: AccountStatus;
  otpVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  workerData?: WorkerData;
}
