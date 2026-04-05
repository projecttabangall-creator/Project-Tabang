import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Users,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  CreditCard,
  Clock,
  Database,
  UserPlus,
} from "lucide-react";
import api from "@/services/api";

interface DashboardStats {
  totalResidents: number;
  totalWorkers: number;
  pendingVerifications: number;
  totalRequests: number;
  activeRequests: number;
  completedJobs: number;
  pendingPayments: number;
  openDisputes: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/admin/dashboard")
      .then(({ data }) => setStats(data))
      .catch(() => toast.error("Failed to load dashboard stats"))
      .finally(() => setLoading(false));
  }, []);

  const statCards = stats
    ? [
        {
          label: "Total Residents",
          value: stats.totalResidents,
          icon: Users,
          color: "text-blue-600 bg-blue-50",
        },
        {
          label: "Total Workers",
          value: stats.totalWorkers,
          icon: Wrench,
          color: "text-green-600 bg-green-50",
        },
        {
          label: "Pending Verifications",
          value: stats.pendingVerifications,
          icon: Clock,
          color: "text-yellow-600 bg-yellow-50",
          link: "/admin/workers?status=pending",
        },
        {
          label: "Active Requests",
          value: stats.activeRequests,
          icon: ClipboardCheck,
          color: "text-purple-600 bg-purple-50",
          link: "/admin/requests",
        },
        {
          label: "Pending Payments",
          value: stats.pendingPayments,
          icon: CreditCard,
          color: "text-orange-600 bg-orange-50",
          link: "/admin/payments",
        },
        {
          label: "Open Disputes",
          value: stats.openDisputes,
          icon: AlertTriangle,
          color: "text-red-600 bg-red-50",
        },
      ]
    : [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {statCards.map((stat) => {
              const Card = (
                <div key={stat.label} className="card flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              );

              return stat.link ? (
                <Link key={stat.label} to={stat.link}>
                  {Card}
                </Link>
              ) : (
                Card
              );
            })}
          </div>

          {/* Completed jobs total */}
          {stats && (
            <div className="card mb-8 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed Jobs (Total)</p>
                <p className="text-3xl font-bold text-accent-600">
                  {stats.completedJobs}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-3xl font-bold text-gray-700">
                  {stats.totalRequests}
                </p>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              to="/admin/workers/register"
              className="card hover:border-primary-300 text-center py-4 transition-colors"
            >
              <UserPlus
                size={24}
                className="mx-auto text-gray-400 mb-2"
              />
              <p className="text-sm font-medium">Register Worker</p>
            </Link>
            <Link
              to="/admin/data-entry"
              className="card hover:border-primary-300 text-center py-4 transition-colors"
            >
              <Database
                size={24}
                className="mx-auto text-gray-400 mb-2"
              />
              <p className="text-sm font-medium">Data Entry</p>
            </Link>
            <Link
              to="/admin/workers"
              className="card hover:border-primary-300 text-center py-4 transition-colors"
            >
              <Wrench
                size={24}
                className="mx-auto text-gray-400 mb-2"
              />
              <p className="text-sm font-medium">Worker List</p>
            </Link>
            <Link
              to="/admin/users"
              className="card hover:border-primary-300 text-center py-4 transition-colors"
            >
              <Users
                size={24}
                className="mx-auto text-gray-400 mb-2"
              />
              <p className="text-sm font-medium">User Management</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
