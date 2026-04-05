export interface Address {
  street: string;
  houseLot: string;
  blockNo: string;
  barangay: string;
}

export interface Credential {
  type: string; // "PSA" | "NBI" | "NC2" etc.
  fileUrl: string;
  uploadedAt: Date;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0=Sunday..6=Saturday
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

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

export type UserRole = "resident" | "worker" | "admin";
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
