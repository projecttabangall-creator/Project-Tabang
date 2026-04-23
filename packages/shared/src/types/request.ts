export type RequestStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "worker_arrived"
  | "price_confirmed"
  | "in_progress"
  | "completed"
  | "payment_submitted"
  | "payment_confirmed"
  | "cancelled"
  | "under_dispute"
  | "resolved";

export type PaymentMethod = "gcash" | "cash";

export interface RequestSchedule {
  date: Date;
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface ServiceRequest {
  id: string;
  residentId: string;
  residentName: string;
  residentContact: string;
  categoryId: string;
  categoryName: string;
  itemId: string;
  itemName: string;
  description: string;
  photoUrls: string[];
  suggestedPrice: number;
  minPrice: number; // snapshot from item at creation
  finalPrice?: number;
  priceChangeReason?: string;
  pendingFinalPrice?: number;
  pendingPriceChangeReason?: string;
  tipAmount?: number;
  commission: number; // 10% of price
  commissionPercent: number;
  totalForResident: number; // price + commission
  pendingCommission?: number;
  pendingTotalForResident?: number;
  location: {
    latitude: number;
    longitude: number;
  };
  locationAddress?: string;
  schedule: RequestSchedule;
  paymentMethod: PaymentMethod;

  // Assignment
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  assignmentScore?: number;
  assignmentAttempts: number;
  excludedWorkerIds?: string[];

  // Status
  status: RequestStatus;
  cancellationPenalty?: number;
  cancelledBy?: string;
  cancelledAt?: Date;

  // Admin price override
  priceOverrideRequired: boolean;
  priceOverrideApproved?: boolean;
  priceOverrideRequestedAt?: Date;
  priceOverrideRequestedBy?: string;
  priceOverrideReviewedAt?: Date;
  priceOverrideReviewedBy?: string;
  priceOverrideRejectedReason?: string;

  // Timestamps
  createdAt: Date;
  assignedAt?: Date;
  acceptedAt?: Date;
  arrivedAt?: Date;
  priceConfirmedAt?: Date;
  completedAt?: Date;

  // Proof
  proofOfWorkPhotoUrls?: string[];
  proofOfPaymentUrl?: string;

  // Rating
  rating?: number;
  ratingComment?: string;

  // Special request
  isSpecialRequest: boolean;
  specialRequestNote?: string;
  createdByAdminId?: string;
  beneficiary?: {
    firstName: string;
    lastName: string;
    contactNumber: string;
  };
}
