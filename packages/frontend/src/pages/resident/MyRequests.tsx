import { useAuth } from "@/contexts/AuthContext";

export function MyRequests() {
  const { userProfile } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        Welcome, {userProfile?.firstName}!
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {["Active", "Recent", "History"].map((tab) => (
          <button
            key={tab}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="card text-center py-12">
        <p className="text-gray-500">No service requests yet.</p>
        <p className="text-sm text-gray-400 mt-2">
          Submit your first request to get started.
        </p>
      </div>
    </div>
  );
}
