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
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Check if worker's availability overlaps with requested time (minimum 90 minutes required)
 */
function checkAvailability(
  availability: Array<any>,
  schedule: RequestSchedule
): boolean {
  if (!availability || availability.length === 0) return false;

  const MIN_OVERLAP_MINUTES = 90; // 1 hour 30 minutes

  const [year, month, day] = schedule.date.split("-").map(Number);
  const requestDate = new Date(year, month - 1, day); // local time — avoids UTC midnight shifting day in PH timezone
  const dayOfWeek = requestDate.getDay();

  const reqStart = timeToMinutes(schedule.startTime);
  const reqEnd = timeToMinutes(schedule.endTime);

  // Check all slots (not just first match) for both recurring and specific dates
  return availability.some((slot) => {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);

    // Calculate overlap: latest start to earliest end
    const overlapStart = Math.max(reqStart, slotStart);
    const overlapEnd = Math.min(reqEnd, slotEnd);
    const overlapMinutes = overlapEnd - overlapStart;

    // Must have at least 90 minutes of overlap
    if (overlapMinutes < MIN_OVERLAP_MINUTES) return false;

    // Check slot type and match accordingly
    const slotType = slot.type || "recurring"; // backward compat: treat missing type as recurring

    if (slotType === "recurring") {
      // Recurring slots match based on day-of-week
      return slot.dayOfWeek === dayOfWeek;
    } else if (slotType === "specific") {
      // Specific slots match exact date
      return slot.date === schedule.date;
    }

    return false;
  });
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
  schedule: RequestSchedule,
  excludedWorkerIds: string[] = []
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
      const notExcluded = !excludedWorkerIds.includes(w.uid);
      const categoryMatch = w.workerData.specialization === categoryId;
      const available = checkAvailability(w.workerData.availability, schedule);
      const creditOk = w.creditPoints >= MIN_CREDIT_FOR_ASSIGNMENT;
      const statusOk =
        w.accountStatus === "active" &&
        w.isVerified &&
        w.isActive &&
        w.workerData.isAvailable;

      return notExcluded && categoryMatch && available && creditOk && statusOk;
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
