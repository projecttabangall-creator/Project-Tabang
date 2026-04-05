import { db } from "../config/firebase";
import { haversine } from "../utils/haversine";
import {
  ASSIGNMENT_WEIGHTS,
  DEFAULT_NEW_WORKER_RATING_SCORE,
  MIN_CREDIT_FOR_ASSIGNMENT,
} from "@tabang/shared";

interface WorkerDoc {
  uid: string;
  workerData: {
    specialization: string;
    completedJobsCount: number;
    averageRating: number;
    lastAssignedAt: any;
    location: { latitude: number; longitude: number };
    availability: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
    isAvailable: boolean;
  };
  creditPoints: number;
  isVerified: boolean;
  isActive: boolean;
  accountStatus: string;
}

interface RequestLocation {
  latitude: number;
  longitude: number;
}

interface RequestSchedule {
  date: string; // ISO date string
  startTime: string;
  endTime: string;
}

export interface AssignmentResult {
  workerId: string | null;
  status: "assigned" | "pending_queue";
  score?: number;
}

/**
 * Check if worker's availability covers the requested time
 */
function checkAvailability(
  availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  schedule: RequestSchedule
): boolean {
  if (!availability || availability.length === 0) return false;

  const requestDate = new Date(schedule.date);
  const dayOfWeek = requestDate.getDay();

  const matchingSlot = availability.find((slot) => slot.dayOfWeek === dayOfWeek);
  if (!matchingSlot) return false;

  // Simple string comparison (assumes HH:MM format)
  const reqStart = schedule.startTime;
  const reqEnd = schedule.endTime;
  const slotStart = matchingSlot.startTime;
  const slotEnd = matchingSlot.endTime;

  return reqStart >= slotStart && reqEnd <= slotEnd;
}

/**
 * Auto-assign a service request to the best worker
 *
 * Algorithm:
 * 1. Hard filters: category, availability, credit >= 3, verified, active
 * 2. Scoring: Frequency (50%) + Rating (35%) + Location (15%)
 * 3. Tiebreaker: oldest lastAssignedAt
 */
export async function assignWorker(
  categoryId: string,
  location: RequestLocation,
  schedule: RequestSchedule
): Promise<AssignmentResult> {
  try {
    // Fetch all workers in this category
    const workersSnapshot = await db
      .collection("users")
      .where("role", "==", "worker")
      .where("workerData.specialization", "==", categoryId)
      .get();

    const allWorkers = workersSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as WorkerDoc[];

    // STAGE 1: Hard Filters
    const eligible = allWorkers.filter((w) => {
      const categoryMatch = w.workerData.specialization === categoryId;
      const available = checkAvailability(w.workerData.availability, schedule);
      const creditOk = w.creditPoints >= MIN_CREDIT_FOR_ASSIGNMENT;
      const statusOk =
        w.accountStatus === "active" &&
        w.isVerified &&
        w.isActive &&
        w.workerData.isAvailable;

      return categoryMatch && available && creditOk && statusOk;
    });

    // Edge case: no eligible workers
    if (eligible.length === 0) {
      return { workerId: null, status: "pending_queue" };
    }

    // Edge case: exactly one worker
    if (eligible.length === 1) {
      return { workerId: eligible[0].uid, status: "assigned" };
    }

    // STAGE 2: Scoring (normalize to 0-1)
    const maxJobs = Math.max(...eligible.map((w) => w.workerData.completedJobsCount));

    // Calculate distances
    const distances = eligible.map((w) => ({
      uid: w.uid,
      distance: haversine(
        location.latitude,
        location.longitude,
        w.workerData.location.latitude,
        w.workerData.location.longitude
      ),
    }));
    const maxDistance = Math.max(...distances.map((d) => d.distance));

    const scored = eligible.map((w) => {
      // Frequency Score (50%) - fewer jobs = higher score
      const freqScore =
        maxJobs === 0 ? 1.0 : 1 - w.workerData.completedJobsCount / maxJobs;

      // Rating Score (35%)
      const ratingScore =
        w.workerData.completedJobsCount === 0
          ? DEFAULT_NEW_WORKER_RATING_SCORE
          : w.workerData.averageRating / 5.0;

      // Location Score (15%)
      const workerDist = distances.find((d) => d.uid === w.uid)!.distance;
      const locScore = maxDistance === 0 ? 1.0 : 1 - workerDist / maxDistance;

      const finalScore =
        freqScore * ASSIGNMENT_WEIGHTS.FREQUENCY +
        ratingScore * ASSIGNMENT_WEIGHTS.RATING +
        locScore * ASSIGNMENT_WEIGHTS.LOCATION;

      return { worker: w, finalScore };
    });

    // Sort by score descending
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // STAGE 3: Tiebreaker
    const topScore = scored[0].finalScore;
    const tied = scored.filter((s) => Math.abs(s.finalScore - topScore) < 0.0001);

    if (tied.length > 1) {
      tied.sort((a, b) => {
        const aTime = a.worker.workerData.lastAssignedAt?.toMillis?.() ?? 0;
        const bTime = b.worker.workerData.lastAssignedAt?.toMillis?.() ?? 0;
        return aTime - bTime; // Oldest first
      });
    }

    return {
      workerId: tied[0].worker.uid,
      status: "assigned",
      score: topScore,
    };
  } catch (error) {
    console.error("Assignment algorithm error:", error);
    return { workerId: null, status: "pending_queue" };
  }
}
