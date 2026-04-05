import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, DollarSign, CheckCircle } from "lucide-react";
import api from "@/services/api";

interface RequestData {
  id: string;
  categoryName: string;
  itemName: string;
  suggestedPrice: number;
  finalPrice?: number;
  commission: number;
  totalForResident: number;
  assignedWorkerName?: string;
  paymentMethod: string;
  status: string;
}

export function SubmitPayment() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [proofUrl, setProofUrl] = useState("");

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      const { data } = await api.get(`/api/requests/${requestId}`);
      const req = data.request || data;
      if (req.status !== "completed") {
        toast.error("Payment can only be submitted for completed jobs");
        navigate("/resident/requests");
        return;
      }
      setRequest(req);
    } catch {
      toast.error("Failed to load request");
      navigate("/resident/requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proofUrl.trim()) {
      toast.error("Please provide the proof of payment URL");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/payments", {
        requestId,
        proofUrl: proofUrl.trim(),
      });
      toast.success("Payment proof submitted! Waiting for admin confirmation.");
      navigate(`/resident/request/${requestId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!request) return null;

  const finalPrice = request.finalPrice || request.suggestedPrice;
  const commission = Math.round(finalPrice * 0.1);
  const total = finalPrice + commission;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Submit Payment</h2>

      {/* Job Summary */}
      <div className="card space-y-3">
        <h3 className="font-semibold">Job Summary</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600">Service:</span>{" "}
            <span className="font-medium">{request.categoryName} — {request.itemName}</span>
          </p>
          <p>
            <span className="text-gray-600">Worker:</span>{" "}
            <span className="font-medium">{request.assignedWorkerName}</span>
          </p>
          <p>
            <span className="text-gray-600">Payment Method:</span>{" "}
            <span className="font-medium uppercase">{request.paymentMethod}</span>
          </p>
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="card space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign size={18} /> Payment Breakdown
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Worker's Price</span>
            <span className="font-medium">₱{finalPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Service Fee (10%)</span>
            <span className="font-medium">₱{commission}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-lg text-primary-600">₱{total}</span>
          </div>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="card bg-blue-50 border-blue-200 space-y-2">
        <h3 className="font-semibold text-blue-800">Payment Instructions</h3>
        {request.paymentMethod === "gcash" ? (
          <div className="text-sm text-blue-700 space-y-1">
            <p>1. Open GCash and send <strong>₱{total}</strong> to the worker</p>
            <p>2. Take a screenshot of the confirmation</p>
            <p>3. Upload the screenshot to Firebase Storage or any image hosting</p>
            <p>4. Paste the URL below and submit</p>
          </div>
        ) : (
          <div className="text-sm text-blue-700 space-y-1">
            <p>1. Pay <strong>₱{total}</strong> in cash to the worker</p>
            <p>2. Take a photo of the receipt or cash hand-off</p>
            <p>3. Upload the photo to Firebase Storage or any image hosting</p>
            <p>4. Paste the URL below and submit</p>
          </div>
        )}
      </div>

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Upload size={18} /> Proof of Payment
        </h3>

        <div>
          <label className="label">Proof URL</label>
          <input
            type="url"
            placeholder="https://firebasestorage.googleapis.com/..."
            className="input-field"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload your payment proof to Firebase Storage and paste the download URL here
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !proofUrl.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <CheckCircle size={18} />
          {isSubmitting ? "Submitting..." : "Submit Payment Proof"}
        </button>
      </form>

      <button
        onClick={() => navigate(`/resident/request/${requestId}`)}
        className="w-full py-2 text-gray-700 hover:text-gray-900 font-medium"
      >
        ← Back to Request
      </button>
    </div>
  );
}
