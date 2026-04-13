import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Upload } from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";

const DISPUTE_TYPES = [
  { value: "work_quality", label: "Work Quality Issue" },
  { value: "payment", label: "Payment Dispute" },
  { value: "no_show", label: "No-Show" },
  { value: "behavior_safety", label: "Behavior / Safety Concern" },
  { value: "other", label: "Other" },
];

export function FileDispute() {
  const { requestId } = useParams<{ requestId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disputeType, setDisputeType] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const backPath =
    userProfile?.role === "worker"
      ? `/worker/job/${requestId}`
      : `/resident/request/${requestId}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disputeType) {
      toast.error("Please select a dispute type");
      return;
    }
    if (description.length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const evidenceUrls = evidenceUrl.trim() ? [evidenceUrl.trim()] : [];

      await api.post("/api/disputes", {
        requestId,
        disputeType,
        description,
        evidenceUrls,
      });

      toast.success(
        "Dispute filed successfully. Admin review will begin shortly."
      );
      navigate(backPath);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to file dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <BackButton to={backPath} label="Back" />
      <div className="flex items-center gap-3">
        <AlertTriangle size={28} className="text-red-500" />
        <h2 className="text-2xl font-bold">File a Dispute</h2>
      </div>

      <div className="card bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800">
          Filing a dispute will pause the current transaction. You can raise a
          dispute while the work is active or within <strong>24 hours</strong>{" "}
          after completion. Please provide as much detail and evidence as
          possible.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dispute Type */}
        <div className="card space-y-4">
          <h3 className="font-semibold">Type of Dispute</h3>
          <div className="space-y-2">
            {DISPUTE_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  disputeType === type.value
                    ? "border-primary-300 bg-primary-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="disputeType"
                  value={type.value}
                  checked={disputeType === type.value}
                  onChange={(e) => setDisputeType(e.target.value)}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="card space-y-4">
          <h3 className="font-semibold">Description</h3>
          <textarea
            placeholder="Describe the issue in detail. What happened? When? What was expected?"
            className="input-field h-32"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-xs text-slate-500">Minimum 10 characters</p>
        </div>

        {/* Evidence */}
        <div className="card space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Upload size={18} /> Evidence (Optional)
          </h3>
          <div>
            <label className="label">Evidence URL</label>
            <input
              type="url"
              placeholder="https://firebasestorage.googleapis.com/..."
              className="input-field"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Upload photos or screenshots to Firebase Storage and paste the URL
            </p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          {isSubmitting ? "Filing Dispute..." : "File Dispute"}
        </button>
      </form>

    </div>
  );
}
