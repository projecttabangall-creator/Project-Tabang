import { Bell } from "lucide-react";

export function Notifications() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Notifications</h2>

      <div className="card text-center py-12">
        <Bell size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No notifications yet.</p>
        <p className="text-sm text-gray-400 mt-2">
          You'll be notified about job updates, payments, and more.
        </p>
      </div>
    </div>
  );
}
