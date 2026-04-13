import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "@/services/api";

interface Dispute {
  id: string;
  requestId: string;
  filedBy: string;
  filedAgainst: string;
  disputeType: string;
  description: string;
  evidenceUrls: string[];
  status: string;
  resolution?: string;
  resolutionNotes?: string;
  creditDeductions: Array<{ userId: string; amount: number }>;
  createdAt: any;
  deadline: any;
}

const RESOLUTION_OPTIONS = [
  { value: "favor_resident", label: "In Favor of Resident" },
  { value: "favor_worker", label: "In Favor of Worker" },
  { value: "partial", label: "Partial (Both Parties)" },
  { value: "escalated", label: "Escalated" },
];

export function DisputeReview() {
  const [isLoading, setIsLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Resolution form state
  const [resolution, setResolution] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [priceAdjustment, setPriceAdjustment] = useState("");
  const [deductFiledBy, setDeductFiledBy] = useState(0);
  const [deductFiledAgainst, setDeductFiledAgainst] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const fetchDisputes = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/api/disputes?status=${statusFilter}`);
      setDisputes(data.disputes || []);
    } catch {
      toast.error("Failed to load disputes");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (disputeId: string) => {
    if (expandedId === disputeId) {
      setExpandedId(null);
    } else {
      setExpandedId(disputeId);
      // Reset form
      setResolution("");
      setResolutionNotes("");
      setPriceAdjustment("");
      setDeductFiledBy(0);
      setDeductFiledAgainst(0);
    }
  };

  const handleResolve = async (dispute: Dispute) => {
    if (!resolution) {
      toast.error("Please select a resolution");
      return;
    }
    if (!resolutionNotes.trim()) {
      toast.error("Please provide resolution notes");
      return;
    }

    const creditDeductions: Array<{ userId: string; amount: number }> = [];
    if (deductFiledBy > 0) {
      creditDeductions.push({ userId: dispute.filedBy, amount: deductFiledBy });
    }
    if (deductFiledAgainst > 0) {
      creditDeductions.push({
        userId: dispute.filedAgainst,
        amount: deductFiledAgainst,
      });
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/disputes/${dispute.id}/resolve`, {
        resolution,
        resolutionNotes: resolutionNotes.trim(),
        priceAdjustment: priceAdjustment ? Number(priceAdjustment) : undefined,
        creditDeductions,
      });
      toast.success("Dispute resolved successfully");
      setExpandedId(null);
      fetchDisputes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to resolve dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      work_quality: "bg-orange-50 text-orange-700",
      payment: "bg-emerald-50 text-emerald-700",
      no_show: "bg-red-50 text-red-700",
      behavior_safety: "bg-purple-50 text-purple-700",
      other: "bg-slate-50 text-slate-700",
    };
    return colors[type] || "bg-slate-50 text-slate-700";
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
          <AlertTriangle size={24} /> Dispute Review
        </h2>
        <p className="text-slate-600 mt-1">
          Review and resolve filed disputes
        </p>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["open", "under_review", "resolved"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? "bg-primary-600 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {status.replace(/_/g, " ").toUpperCase()}
          </button>
        ))}
      </div>

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-300 mb-4" />
          <p className="text-slate-500 font-medium">No disputes found</p>
          <p className="text-sm text-slate-400 mt-2">
            No {statusFilter.replace(/_/g, " ")} disputes at this time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="card">
              {/* Dispute Header */}
              <button
                onClick={() => toggleExpand(dispute.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">
                        Dispute #{dispute.id.slice(-6)}
                      </p>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${getTypeBadgeColor(
                          dispute.disputeType
                        )}`}
                      >
                        {dispute.disputeType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Request: {dispute.requestId.slice(-8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        dispute.status === "open"
                          ? "bg-red-50 text-red-700"
                          : dispute.status === "under_review"
                          ? "bg-yellow-50 text-yellow-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {dispute.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {expandedId === dispute.id ? (
                      <ChevronUp size={18} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={18} className="text-slate-400" />
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-700 line-clamp-2">
                  {dispute.description}
                </p>

                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>Filed by: {dispute.filedBy.slice(-6)}</span>
                  <span>Against: {dispute.filedAgainst.slice(-6)}</span>
                </div>
              </button>

              {/* Expanded Detail + Resolution Form */}
              {expandedId === dispute.id && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                  {/* Full Description */}
                  <div>
                    <h4 className="text-sm font-semibold mb-1">
                      Full Description
                    </h4>
                    <p className="text-sm text-slate-700">{dispute.description}</p>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600">Filed By</p>
                      <p className="text-sm font-medium font-mono">
                        {dispute.filedBy.slice(-8)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600">Filed Against</p>
                      <p className="text-sm font-medium font-mono">
                        {dispute.filedAgainst.slice(-8)}
                      </p>
                    </div>
                  </div>

                  {/* Evidence */}
                  {dispute.evidenceUrls.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Evidence</h4>
                      <div className="space-y-1">
                        {dispute.evidenceUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800"
                          >
                            <ExternalLink size={14} />
                            Evidence {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution (if already resolved) */}
                  {dispute.status === "resolved" && dispute.resolution && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-emerald-800 mb-2">
                        Resolution
                      </h4>
                      <p className="text-sm text-emerald-700">
                        <strong>
                          {dispute.resolution.replace(/_/g, " ").toUpperCase()}
                        </strong>
                      </p>
                      {dispute.resolutionNotes && (
                        <p className="text-sm text-emerald-700 mt-1">
                          {dispute.resolutionNotes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Resolution Form (for open/under_review) */}
                  {dispute.status !== "resolved" && (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                      <h4 className="font-semibold">Resolve This Dispute</h4>

                      {/* Resolution Type */}
                      <div>
                        <label className="label">Resolution</label>
                        <select
                          className="input-field"
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                        >
                          <option value="">Select resolution...</option>
                          {RESOLUTION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="label">Resolution Notes</label>
                        <textarea
                          placeholder="Explain the resolution decision..."
                          className="input-field h-20"
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                        />
                      </div>

                      {/* Price Adjustment */}
                      <div>
                        <label className="label">
                          Price Adjustment (Optional)
                        </label>
                        <input
                          type="number"
                          placeholder="New agreed price"
                          className="input-field"
                          value={priceAdjustment}
                          onChange={(e) => setPriceAdjustment(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Leave empty if no price change needed
                        </p>
                      </div>

                      {/* Credit Deductions */}
                      <div>
                        <label className="label">Credit Deductions</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-600 mb-1">
                              Filer ({dispute.filedBy.slice(-6)})
                            </p>
                            <select
                              className="input-field"
                              value={deductFiledBy}
                              onChange={(e) =>
                                setDeductFiledBy(Number(e.target.value))
                              }
                            >
                              <option value={0}>No deduction</option>
                              <option value={1}>-1 credit</option>
                              <option value={2}>-2 credits</option>
                              <option value={3}>-3 credits</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 mb-1">
                              Accused ({dispute.filedAgainst.slice(-6)})
                            </p>
                            <select
                              className="input-field"
                              value={deductFiledAgainst}
                              onChange={(e) =>
                                setDeductFiledAgainst(Number(e.target.value))
                              }
                            >
                              <option value={0}>No deduction</option>
                              <option value={1}>-1 credit</option>
                              <option value={2}>-2 credits</option>
                              <option value={3}>-3 credits</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Users with 2 or fewer credits will be automatically suspended
                        </p>
                      </div>

                      {/* Submit */}
                      <button
                        onClick={() => handleResolve(dispute)}
                        disabled={isSubmitting}
                        className="btn-primary w-full"
                      >
                        {isSubmitting ? "Resolving..." : "Resolve Dispute"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
