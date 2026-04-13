import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import { ScrollText, Search, Filter, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import api from "@/services/api";

interface SystemLog {
  id: string;
  action: string;
  performedBy: string;
  targetUserId?: string;
  details: string;
  createdAt: { _seconds: number; _nanoseconds: number } | string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_status_changed: { label: "Status Change", color: "badge-warning" },
  credit_adjusted: { label: "Credit Adjusted", color: "badge-accent" },
  credit_deduction: { label: "Credit Deducted", color: "badge-danger" },
  credit_restoration: { label: "Credit Restored", color: "badge-success" },
  config_updated: { label: "Config Update", color: "badge-primary" },
  user_flagged: { label: "User Flagged", color: "badge-danger" },
  category_created: { label: "Category Created", color: "badge-primary" },
  category_updated: { label: "Category Updated", color: "badge-primary" },
  item_created: { label: "Item Created", color: "badge-neutral" },
  item_updated: { label: "Item Updated", color: "badge-neutral" },
  item_deleted: { label: "Item Deleted", color: "badge-danger" },
  worker_registered: { label: "Worker Registered", color: "badge-success" },
  worker_verified: { label: "Worker Verified", color: "badge-success" },
  dispute_filed: { label: "Dispute Filed", color: "badge-warning" },
  dispute_resolved: { label: "Dispute Resolved", color: "badge-success" },
  payment_confirmed: { label: "Payment Confirmed", color: "badge-success" },
  payment_rejected: { label: "Payment Rejected", color: "badge-danger" },
};

function parseTimestamp(ts: SystemLog["createdAt"]): Date {
  if (typeof ts === "string") return new Date(ts);
  if (ts && typeof ts === "object" && "_seconds" in ts) {
    return new Date(ts._seconds * 1000);
  }
  return new Date();
}

export function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchLogs();
  }, [limit]);

  async function fetchLogs() {
    try {
      setLoading(true);
      const { data } = await api.get("/api/admin/logs", {
        params: { limit },
      });
      setLogs(data.logs || []);
    } catch {
      toast.error("Failed to load system logs");
    } finally {
      setLoading(false);
    }
  }

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = !actionFilter || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div>
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">System Logs</h2>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail of all system actions
          </p>
        </div>
        <span className="badge-neutral">{filteredLogs.length} entries</span>
      </div>

      {/* Filters */}
      <div className="card mb-6 !p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search logs..."
              className="input-field !pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              className="input-field !pl-9 !pr-8 appearance-none min-w-[180px]"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action]?.label || action}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card text-center py-12">
          <ScrollText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No logs found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || {
              label: log.action,
              color: "badge-neutral",
            };
            const date = parseTimestamp(log.createdAt);

            return (
              <div
                key={log.id}
                className="card !p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={actionInfo.color}>{actionInfo.label}</span>
                  <p className="text-sm text-slate-700 truncate flex-1">
                    {log.details}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                  <span>
                    by{" "}
                    <span className="text-slate-600 font-medium">
                      {log.performedBy === "system" ? "System" : log.performedBy.slice(0, 8) + "..."}
                    </span>
                  </span>
                  <span>{format(date, "MMM d, yyyy h:mm a")}</span>
                </div>
              </div>
            );
          })}

          {logs.length >= limit && (
            <button
              onClick={() => setLimit((prev) => prev + 50)}
              className="btn-secondary w-full mt-4"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
