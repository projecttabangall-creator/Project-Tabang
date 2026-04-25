import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, Image, X } from "lucide-react";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";

interface Payment {
  id: string;
  requestId: string;
  residentId: string;
  workerId: string;
  workerAmount: number;
  commissionAmount: number;
  totalAmount: number;
  barangayShareAmount: number;
  paymentMethod: string;
  proofUrl: string;
  status: string;
  createdAt: any;
  resident?: {
    userId: string;
    fullName: string;
    role: string;
    contactNumber: string;
  };
  worker?: {
    userId: string;
    fullName: string;
    role: string;
    contactNumber: string;
  };
  request?: {
    id: string;
    categoryName: string;
    description: string;
    status: string;
    locationAddress: string;
    beneficiaryName: string;
    finalPrice: number | null;
    totalForResident: number | null;
    commission: number | null;
    paymentMethod: string;
    rating: number | null;
    ratingComment: string;
    createdAt: any;
    completedAt: any;
  };
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") return "N/A";
  return `PHP ${value}`;
}

function formatDateTime(value: any) {
  if (!value) return "N/A";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?._seconds === "number"
      ? new Date(value._seconds * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function PaymentReview() {
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [actionPaymentId, setActionPaymentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data } = await api.get("/api/payments/pending");
      setPayments(data.payments || []);
    } catch {
      toast.error("Failed to load pending payments");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (paymentId: string) => {
    if (!confirm("Confirm this payment? This action cannot be undone.")) return;

    setActionPaymentId(paymentId);
    try {
      await api.patch(`/api/payments/${paymentId}/confirm`);
      toast.success("Payment confirmed");
      setPayments((prev) => prev.filter((payment) => payment.id !== paymentId));
    } catch {
      toast.error("Failed to confirm payment");
    } finally {
      setActionPaymentId(null);
    }
  };

  const openRejectModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedPayment) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setActionPaymentId(selectedPayment.id);
    try {
      await api.patch(`/api/payments/${selectedPayment.id}/reject`, {
        reason: rejectReason.trim(),
      });
      toast.success("Payment rejected; resident can resubmit");
      setPayments((prev) =>
        prev.filter((payment) => payment.id !== selectedPayment.id)
      );
      setShowRejectModal(false);
      setSelectedPayment(null);
    } catch {
      toast.error("Failed to reject payment");
    } finally {
      setActionPaymentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-2xl">P</span> Payment Review
        </h2>
        <p className="text-slate-600 mt-1">
          {payments.length} payment{payments.length !== 1 ? "s" : ""} pending
          review
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-300 mb-4" />
          <p className="text-slate-500 font-medium">All caught up!</p>
          <p className="text-sm text-slate-400 mt-2">
            No payments pending review
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="card space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">Payment #{payment.id.slice(-6)}</p>
                  <p className="text-xs text-slate-500">
                    Request:{" "}
                    {payment.request?.categoryName || payment.requestId.slice(-8)}
                  </p>
                </div>
                <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded font-medium">
                  PENDING
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-600">Worker</p>
                  <p className="font-bold">
                    {formatCurrency(payment.workerAmount)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-600">Commission</p>
                  <p className="font-bold text-emerald-600">
                    {formatCurrency(payment.commissionAmount)}
                  </p>
                </div>
                <div className="bg-primary-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-600">Total</p>
                  <p className="font-bold text-primary-600">
                    {formatCurrency(payment.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <p>
                  <span className="text-slate-600">Method:</span>{" "}
                  <span className="font-medium uppercase">
                    {payment.paymentMethod}
                  </span>
                </p>
                <p>
                  <span className="text-slate-600">Barangay Share:</span>{" "}
                  <span className="font-medium text-emerald-600">
                    {formatCurrency(payment.barangayShareAmount)}
                  </span>
                </p>
                <p>
                  <span className="text-slate-600">Submitted:</span>{" "}
                  <span className="font-medium">
                    {formatDateTime(payment.createdAt)}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Request Details
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Service:</span>{" "}
                    <span className="font-medium">
                      {payment.request?.categoryName || "N/A"}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Description:</span>{" "}
                    <span className="font-medium">
                      {payment.request?.description || "N/A"}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Location:</span>{" "}
                    <span className="font-medium">
                      {payment.request?.locationAddress || "N/A"}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Beneficiary:</span>{" "}
                    <span className="font-medium">
                      {payment.request?.beneficiaryName || "N/A"}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Completed:</span>{" "}
                    <span className="font-medium">
                      {formatDateTime(payment.request?.completedAt)}
                    </span>
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    Parties & Verification
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Resident:</span>{" "}
                    <span className="font-medium">
                      {payment.resident?.fullName || payment.residentId.slice(-8)}
                    </span>
                    {payment.resident?.contactNumber
                      ? ` • ${payment.resident.contactNumber}`
                      : ""}
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Worker:</span>{" "}
                    <span className="font-medium">
                      {payment.worker?.fullName || payment.workerId.slice(-8)}
                    </span>
                    {payment.worker?.contactNumber
                      ? ` • ${payment.worker.contactNumber}`
                      : ""}
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">
                      Agreed Worker Amount:
                    </span>{" "}
                    <span className="font-medium">
                      {formatCurrency(
                        payment.request?.finalPrice ?? payment.workerAmount
                      )}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Resident Total:</span>{" "}
                    <span className="font-medium">
                      {formatCurrency(
                        payment.request?.totalForResident ?? payment.totalAmount
                      )}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Request Status:</span>{" "}
                    <span className="font-medium uppercase">
                      {payment.request?.status?.replace(/_/g, " ") || "N/A"}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-600">Rating:</span>{" "}
                    <span className="font-medium">
                      {payment.request?.rating != null
                        ? `${payment.request.rating}/5`
                        : "No rating"}
                    </span>
                  </p>
                  {payment.request?.ratingComment ? (
                    <p className="text-sm">
                      <span className="text-slate-600">Rating Comment:</span>{" "}
                      <span className="font-medium">
                        {payment.request.ratingComment}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                onClick={() => setSelectedProofUrl(payment.proofUrl)}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium transition-colors"
              >
                <Image size={14} />
                View Payment Proof
              </button>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleConfirm(payment.id)}
                  disabled={actionPaymentId === payment.id}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  {actionPaymentId === payment.id ? "Processing..." : "Confirm"}
                </button>
                <button
                  onClick={() => openRejectModal(payment)}
                  disabled={actionPaymentId === payment.id}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRejectModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold text-lg">Reject Payment</h3>
            <p className="text-sm text-slate-600">
              Payment #{selectedPayment.id.slice(-6)} •{" "}
              {formatCurrency(selectedPayment.totalAmount)}
            </p>
            <div>
              <label className="label">Reason for Rejection</label>
              <textarea
                placeholder="e.g., Proof image is blurry, wrong amount shown..."
                className="input-field h-24"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={actionPaymentId === selectedPayment.id}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                {actionPaymentId === selectedPayment.id
                  ? "Rejecting..."
                  : "Confirm Rejection"}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedPayment(null);
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProofUrl && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="font-semibold">Payment Proof</h3>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/5">
              <img
                src={selectedProofUrl}
                alt="Payment proof"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
