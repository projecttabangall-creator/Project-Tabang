export type PaymentStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export interface Payment {
  id: string;
  requestId: string;
  residentId: string;
  workerId: string;
  workerAmount: number;
  commissionAmount: number;
  totalAmount: number;
  barangaySharePercent: number;
  barangayShareAmount: number;
  paymentMethod: "gcash" | "cash";
  proofUrl: string;
  status: PaymentStatus;
  confirmedBy?: string;
  createdAt: Date;
  confirmedAt?: Date;
}
