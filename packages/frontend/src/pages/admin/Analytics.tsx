import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, PiggyBank, Wallet, Users, Star } from "lucide-react";
import api from "@/services/api";

// ── Types ────────────────────────────────────────────────────────────────────

type Period = "daily" | "weekly" | "monthly";

interface IncomeSummary {
  totalIncome: number;
  totalWorkerPayouts: number;
  totalCollected: number;
  totalTransactions: number;
}

interface IncomeBreakdown {
  label: string;
  income: number;
  workerPayouts: number;
}

interface WorkerStat {
  id: string;
  name: string;
  averageRating: number;
  completedJobs: number;
  acceptanceRate: number;
}

interface AnalyticsData {
  requestsByStatus: Record<string, number>;
  requestsByCategory: { name: string; count: number }[];
  workerPerformance: WorkerStat[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₱ ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPeriodLabel(label: string, period: Period) {
  if (period === "daily") {
    const d = new Date(label + "T00:00:00");
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }
  if (period === "weekly") {
    const d = new Date(label + "T00:00:00");
    return `Wk ${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
  }
  const [y, m] = label.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
}

// Status label + color mapping
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:           { label: "Pending",       color: "#94a3b8" },
  assigned:          { label: "Assigned",      color: "#eab308" },
  accepted:          { label: "Accepted",      color: "#3b82f6" },
  worker_arrived:    { label: "Arrived",       color: "#a855f7" },
  price_confirmed:   { label: "Price OK",      color: "#6366f1" },
  in_progress:       { label: "In Progress",   color: "#0ea5e9" },
  completed:         { label: "Completed",     color: "#10b981" },
  payment_submitted: { label: "Pmt Submitted", color: "#f59e0b" },
  payment_confirmed: { label: "Pmt Confirmed", color: "#22c55e" },
  under_dispute:     { label: "Disputed",      color: "#f97316" },
  cancelled:         { label: "Cancelled",     color: "#f43f5e" },
  resolved:          { label: "Resolved",      color: "#64748b" },
};

// ── Main Component ────────────────────────────────────────────────────────────

export function Analytics() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary | null>(null);
  const [incomeBreakdown, setIncomeBreakdown] = useState<IncomeBreakdown[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingIncome, setLoadingIncome] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Fetch income whenever period changes
  useEffect(() => {
    setLoadingIncome(true);
    api
      .get(`/api/admin/income?period=${period}`)
      .then(({ data }) => {
        setIncomeSummary(data.summary || null);
        setIncomeBreakdown(
          (data.breakdown || []).slice(0, 12).map((r: { label: string; income: number; workerPayouts: number }) => ({
            label: formatPeriodLabel(r.label, period),
            income: r.income,
            workerPayouts: r.workerPayouts,
          }))
        );
      })
      .catch(() => toast.error("Failed to load income data"))
      .finally(() => setLoadingIncome(false));
  }, [period]);

  // Fetch analytics once
  useEffect(() => {
    api
      .get("/api/admin/analytics")
      .then(({ data }) => setAnalytics(data))
      .catch(() => toast.error("Failed to load analytics data"))
      .finally(() => setLoadingAnalytics(false));
  }, []);

  // Pie chart data derived from requestsByStatus
  const pieData = analytics
    ? Object.entries(analytics.requestsByStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          name: STATUS_META[status]?.label ?? status,
          value: count,
          color: STATUS_META[status]?.color ?? "#94a3b8",
        }))
    : [];

  const totalRequests = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-8">
      <h1 className="page-title">Analytics</h1>

      {/* ── Section 1: Income & Financial ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="section-title">Income & Financial</h2>

        {/* Period tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                period === p
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {loadingIncome ? (
          <Spinner />
        ) : (
          <>
            {/* KPI cards */}
            {incomeSummary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Commission Income"
                  value={formatCurrency(incomeSummary.totalIncome)}
                  icon={<TrendingUp size={18} />}
                  color="emerald"
                />
                <KpiCard
                  label="Total Collected"
                  value={formatCurrency(incomeSummary.totalCollected)}
                  icon={<PiggyBank size={18} />}
                  color="primary"
                />
                <KpiCard
                  label="Worker Payouts"
                  value={formatCurrency(incomeSummary.totalWorkerPayouts)}
                  icon={<Wallet size={18} />}
                  color="amber"
                />
                <KpiCard
                  label="Transactions"
                  value={incomeSummary.totalTransactions.toString()}
                  icon={<Users size={18} />}
                  color="slate"
                />
              </div>
            )}

            {/* Bar chart */}
            {incomeBreakdown.length === 0 ? (
              <EmptyState message="No confirmed payments yet. Income data will appear here once payments are confirmed." />
            ) : (
              <div className="card">
                <p className="text-sm font-semibold text-slate-600 mb-4">
                  Commission vs Worker Payouts
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={incomeBreakdown} barCategoryGap="30%">
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        name === "income" ? "Commission" : "Worker Payouts",
                      ]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "income" ? "Commission" : "Worker Payouts"
                      }
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="workerPayouts" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Section 2: Request Overview ───────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="section-title">Request Overview</h2>

        {loadingAnalytics ? (
          <Spinner />
        ) : pieData.length === 0 ? (
          <EmptyState message="No service requests found yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie chart */}
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-600">Status Breakdown</p>
                <span className="text-xs text-slate-400">{totalRequests} total</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value), String(name)]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown */}
            {analytics && analytics.requestsByCategory.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-slate-600 mb-4">Top Categories</p>
                <div className="space-y-3">
                  {analytics.requestsByCategory.map((cat) => {
                    const pct = totalRequests > 0 ? Math.round((cat.count / totalRequests) * 100) : 0;
                    return (
                      <div key={cat.name}>
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span className="font-medium">{cat.name}</span>
                          <span>{cat.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-2 bg-primary-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 3: Worker Performance ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="section-title">Worker Performance</h2>

        {loadingAnalytics ? (
          <Spinner />
        ) : !analytics || analytics.workerPerformance.length === 0 ? (
          <EmptyState message="No worker data yet." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">#</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Worker</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">Rating</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Completed</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Acceptance</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.workerPerformance.map((w, i) => (
                    <tr
                      key={w.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/workers/${w.id}`}
                          className="font-medium text-primary-700 hover:underline"
                        >
                          {w.name || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                          <Star size={13} fill="currentColor" />
                          {w.averageRating > 0 ? w.averageRating.toFixed(1) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        {w.completedJobs}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {w.acceptanceRate > 0 ? `${w.acceptanceRate}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card text-center py-10">
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "emerald" | "primary" | "amber" | "slate";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    primary: "bg-primary-50 text-primary-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="card flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
