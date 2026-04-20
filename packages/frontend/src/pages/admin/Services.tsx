import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import {
  ChevronDown,
  ChevronRight,
  List,
  Pencil,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import api from "@/services/api";

interface CategoryItem {
  id: string;
  name: string;
  minPrice: number;
  referencePhotoUrl?: string;
  createdAt: { _seconds: number } | string;
  updatedAt: { _seconds: number } | string;
}

interface Category {
  id: string;
  name: string;
  isActive: boolean;
  items: CategoryItem[];
  createdAt: { _seconds: number } | string;
  updatedAt: { _seconds: number } | string;
}

function parseTimestamp(ts: { _seconds: number } | string | undefined): Date {
  if (!ts) return new Date();
  if (typeof ts === "string") return new Date(ts);
  if (typeof ts === "object" && "_seconds" in ts) return new Date(ts._seconds * 1000);
  return new Date();
}

export function Services() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get("/api/categories")
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => toast.error("Failed to load services"))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalItems = categories.reduce(
    (sum, c) => sum + (c.items?.length || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <BackButton to="/admin/dashboard" label="Back to Dashboard" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">Services & Pricing</h2>
          <p className="text-sm text-slate-500 mt-1">
            {categories.length} categories, {totalItems} service items
          </p>
        </div>
        <Link to="/admin/data-entry" className="btn-primary text-sm flex items-center gap-2">
          <Pencil size={14} />
          Edit in Data Entry
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="card text-center py-12">
          <List size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No categories configured yet.</p>
          <Link to="/admin/data-entry" className="btn-primary mt-4 inline-block">
            Add Categories
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => {
            const isExpanded = expandedIds.has(category.id);
            return (
              <div key={category.id} className="card !p-0 overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggleExpand(category.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400" />
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-slate-900 font-display">
                        {category.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Created {format(parseTimestamp(category.createdAt), "MMM d, yyyy")}
                        {" · "}
                        Updated {format(parseTimestamp(category.updatedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        category.isActive ? "badge-success" : "badge-neutral"
                      }
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="badge-neutral">
                      {category.items?.length || 0} items
                    </span>
                  </div>
                </button>

                {/* Items table */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {!category.items || category.items.length === 0 ? (
                      <p className="px-5 py-6 text-sm text-slate-400 text-center">
                        No items in this category.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                              <th className="px-5 py-3 font-semibold">Item</th>
                              <th className="px-5 py-3 font-semibold">Min Price</th>
                              <th className="px-5 py-3 font-semibold">Status</th>
                              <th className="px-5 py-3 font-semibold hidden sm:table-cell">Created</th>
                              <th className="px-5 py-3 font-semibold hidden sm:table-cell">Updated</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {category.items.map((item) => (
                              <tr
                                key={item.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-5 py-3 font-medium text-slate-800 flex items-center gap-2">
                                  <Tag size={14} className="text-slate-400" />
                                  {item.name}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="text-slate-700 font-medium">
                                    ₱{item.minPrice.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <span className="badge-success">Standard</span>
                                </td>
                                <td className="px-5 py-3 text-slate-400 hidden sm:table-cell">
                                  {format(parseTimestamp(item.createdAt), "MMM d, yyyy")}
                                </td>
                                <td className="px-5 py-3 text-slate-400 hidden sm:table-cell">
                                  {format(parseTimestamp(item.updatedAt), "MMM d, yyyy")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
