import { useAuth } from "@/contexts/AuthContext";

export function WorkerHome() {
  const { userProfile } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        Welcome, {userProfile?.firstName}!
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600">0</p>
          <p className="text-sm text-gray-500">Pending Jobs</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-accent-600">0</p>
          <p className="text-sm text-gray-500">Completed</p>
        </div>
      </div>

      {/* Availability toggle placeholder */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="font-medium">Availability</p>
          <p className="text-sm text-gray-500">Toggle to receive new jobs</p>
        </div>
        <button className="bg-gray-200 rounded-full w-12 h-6 relative">
          <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform" />
        </button>
      </div>

      {/* Empty state */}
      <div className="card text-center py-12 mt-6">
        <p className="text-gray-500">No pending requests.</p>
        <p className="text-sm text-gray-400 mt-2">
          New jobs will appear here when assigned to you.
        </p>
      </div>
    </div>
  );
}
