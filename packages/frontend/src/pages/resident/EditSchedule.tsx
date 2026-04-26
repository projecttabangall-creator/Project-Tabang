import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BackButton } from "@/components/common/BackButton";
import { Clock } from "lucide-react";
import api from "@/services/api";
import { TimeInput } from "@/components/common/TimeInput";
import { format12hRange } from "@/utils/time";

interface Request {
  id: string;
  categoryName: string;
  itemName: string;
  schedule: { date: string | { _seconds: number }; startTime: string; endTime: string };
}

export function EditSchedule() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [noSpecifiedTime, setNoSpecifiedTime] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      const { data } = await api.get(`/api/requests/${requestId}`);
      setRequest(data.request);

      // Parse the schedule date
      const scheduledDate = data.request.schedule.date;
      const dateStr =
        typeof scheduledDate === "object" && scheduledDate._seconds
          ? new Date(scheduledDate._seconds * 1000).toISOString().split("T")[0]
          : String(scheduledDate);

      setDate(dateStr);
      setStartTime(data.request.schedule.startTime);
      setEndTime(data.request.schedule.endTime);
      setNoSpecifiedTime(!data.request.schedule.startTime);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to load request";
      toast.error(errorMsg);
      setTimeout(() => navigate("/resident/requests"), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    setError("");

    if (!date) {
      setError("Date is required");
      return false;
    }

    if (!noSpecifiedTime) {
      if (!startTime) {
        setError("Start time is required");
        return false;
      }
      if (!endTime) {
        setError("End time is required");
        return false;
      }
      if (startTime >= endTime) {
        setError("End time must be after start time");
        return false;
      }
    }

    // Check if date is not in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      setError("Date cannot be in the past");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch(`/api/requests/${requestId}/schedule`, {
        schedule: {
          date,
          startTime: noSpecifiedTime ? "" : startTime,
          endTime: noSpecifiedTime ? "" : endTime,
        },
      });
      toast.success("Schedule updated successfully");
      navigate("/resident/requests");
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to update schedule";
      toast.error(errorMsg);
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

  if (!request) {
    return <div className="text-center py-12 text-slate-500">Request not found</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackButton to="/resident/requests" label="Back to Requests" />

      <div className="card">
        <h2 className="text-2xl font-bold mb-2">Edit Schedule</h2>
        <p className="text-slate-600 mb-4">Update when you need this service</p>

        <div className="bg-slate-50 p-4 rounded-lg mb-6 space-y-2">
          <p className="text-sm">
            <span className="text-slate-600">Service:</span>{" "}
            <span className="font-medium">{request.categoryName} - {request.itemName}</span>
          </p>
          <p className="text-sm">
            <span className="text-slate-600">Current Schedule:</span>{" "}
            <span className="font-medium flex items-center gap-1 mt-1">
              <Clock size={14} />
              {typeof request.schedule.date === "object"
                ? new Date(request.schedule.date._seconds * 1000).toLocaleDateString()
                : request.schedule.date}{" "}
              {request.schedule.startTime ? format12hRange(request.schedule.startTime, request.schedule.endTime) : "No specified time"}
            </span>
          </p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="input-field"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noSpecifiedTime}
              onChange={(e) => {
                setNoSpecifiedTime(e.target.checked);
                if (e.target.checked) {
                  setStartTime("");
                  setEndTime("");
                } else {
                  setStartTime("09:00");
                  setEndTime("17:00");
                }
              }}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">No specified time (match any available worker)</span>
          </label>

          {!noSpecifiedTime && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Time</label>
                <TimeInput value={startTime} onChange={setStartTime} />
              </div>
              <div>
                <label className="label">End Time</label>
                <TimeInput value={endTime} onChange={setEndTime} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting ? "Updating..." : "Update Schedule"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/resident/requests")}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
