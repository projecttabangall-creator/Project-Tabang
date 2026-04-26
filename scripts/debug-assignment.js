/**
 * Diagnostic: explain why each worker is/isn't eligible for each PENDING request.
 *
 * Usage: node scripts/debug-assignment.js [requestId]
 *   - With requestId: only that request
 *   - Without: scans all PENDING requests
 */
const path = require("path");
const admin = require("firebase-admin");

const ROOKIE_JOB_THRESHOLD = 5;
const MIN_CREDIT_FOR_ASSIGNMENT = 3;
const MIN_OVERLAP_MINUTES = 90;
const ASSIGNMENT_WEIGHTS = { FREQUENCY: 0.5, RATING: 0.35, LOCATION: 0.15 };
const DEFAULT_NEW_WORKER_RATING_SCORE = 0.6;

const serviceAccountPath = path.resolve(process.cwd(), "service-account.json");
if (!admin.apps.length) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

function timeToMinutes(time) {
  const [h, m] = String(time || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeDate(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v.toDate) return v.toDate().toISOString().split("T")[0];
  if (v._seconds) return new Date(v._seconds * 1000).toISOString().split("T")[0];
  return null;
}

function checkAvailability(availability, schedule) {
  if (!availability || availability.length === 0) return { ok: false, why: "no availability slots" };

  const [year, month, day] = schedule.date.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  if (schedule.noSpecifiedTime) {
    const match = availability.some((slot) => {
      const t = slot.type || "recurring";
      return t === "recurring" ? slot.dayOfWeek === dayOfWeek : slot.date === schedule.date;
    });
    return match ? { ok: true } : { ok: false, why: `no slot on ${schedule.date} (${dayOfWeek})` };
  }

  const reqStart = timeToMinutes(schedule.startTime);
  const reqEnd = timeToMinutes(schedule.endTime);

  for (const slot of availability) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    const overlap = Math.min(reqEnd, slotEnd) - Math.max(reqStart, slotStart);
    if (overlap < MIN_OVERLAP_MINUTES) continue;
    const t = slot.type || "recurring";
    if (t === "recurring" && slot.dayOfWeek === dayOfWeek) return { ok: true };
    if (t === "specific" && slot.date === schedule.date) return { ok: true };
  }
  return { ok: false, why: `no slot with ≥${MIN_OVERLAP_MINUTES}min overlap on ${schedule.date}` };
}

function hasConflict(workingSchedule, schedule) {
  if (!Array.isArray(workingSchedule)) return false;
  const inactive = new Set(["completed", "payment_confirmed", "cancelled", "resolved"]);
  return workingSchedule.some((slot) => {
    if (!slot || slot.date !== schedule.date) return false;
    if (slot.status && inactive.has(slot.status)) return false;
    if (schedule.noSpecifiedTime) return true;
    const reqStart = timeToMinutes(schedule.startTime);
    const reqEnd = timeToMinutes(schedule.endTime);
    return reqStart < timeToMinutes(slot.endTime) && reqEnd > timeToMinutes(slot.startTime);
  });
}

async function diagnoseRequest(reqDoc) {
  const data = reqDoc.data();
  const reqId = reqDoc.id;
  const date = normalizeDate(data.schedule?.date);
  const startTime = data.schedule?.startTime || "";
  const endTime = data.schedule?.endTime || "";
  const noSpecifiedTime = startTime === "" && endTime === "";

  const lat = data.location?.latitude ?? data.location?._latitude;
  const lng = data.location?.longitude ?? data.location?._longitude;

  console.log("\n========================================");
  console.log(`Request ${reqId}`);
  console.log(`  status=${data.status}  category=${data.categoryId}  date=${date}  time=${startTime}-${endTime}`);
  console.log(`  location=(${lat}, ${lng})  excluded=${JSON.stringify(data.excludedWorkerIds || [])}`);

  if (!data.categoryId || !date || (!noSpecifiedTime && (!startTime || !endTime)) || lat == null || lng == null) {
    console.log("  ⚠️  Missing required fields for assignment");
    return;
  }

  const schedule = { date, startTime, endTime, noSpecifiedTime };

  const allWorkersSnap = await db.collection("users").where("role", "==", "worker").get();
  const candidates = allWorkersSnap.docs.filter((d) => {
    const v = d.data().workerData?.specialization;
    const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    return list.includes(data.categoryId);
  });

  if (candidates.length === 0) {
    console.log(`  ❌ No workers with specialization=${data.categoryId}`);
    return;
  }

  console.log(`  Candidates: ${candidates.length} worker(s) in category`);
  const snap = { docs: candidates, size: candidates.length };

  const excluded = new Set(data.excludedWorkerIds || []);
  const eligible = [];
  const distances = [];

  for (const wDoc of snap.docs) {
    const w = wDoc.data();
    const wd = w.workerData || {};
    const reasons = [];

    if (excluded.has(wDoc.id)) reasons.push("excluded (rejected before)");
    const wdSpecsList = Array.isArray(wd.specialization)
      ? wd.specialization
      : typeof wd.specialization === "string"
        ? [wd.specialization]
        : [];
    if (!wdSpecsList.includes(data.categoryId)) reasons.push("specialization mismatch");
    const av = checkAvailability(wd.availability, schedule);
    if (!av.ok) reasons.push(`availability: ${av.why}`);
    if (hasConflict(wd.workingSchedule, schedule)) reasons.push("already booked that slot");
    if ((w.creditPoints ?? 0) < MIN_CREDIT_FOR_ASSIGNMENT)
      reasons.push(`credit ${w.creditPoints ?? 0} < 3`);
    if ((wd.completedJobsCount ?? 0) < ROOKIE_JOB_THRESHOLD)
      reasons.push(`rookie: ${wd.completedJobsCount ?? 0}/${ROOKIE_JOB_THRESHOLD} jobs`);
    if (w.accountStatus !== "active") reasons.push(`accountStatus=${w.accountStatus}`);
    if (!w.isVerified) reasons.push("not verified");
    if (!w.isActive) reasons.push("not active");
    if (!wd.isAvailable) reasons.push("isAvailable=false");

    const name = `${w.firstName || ""} ${w.lastName || ""}`.trim() || wDoc.id;
    if (reasons.length > 0) {
      console.log(`    ✗ ${name} — ${reasons.join("; ")}`);
    } else {
      const wLat = wd.location?.latitude;
      const wLng = wd.location?.longitude;
      const dist = wLat != null && wLng != null ? haversine(lat, lng, wLat, wLng) : NaN;
      eligible.push({ uid: wDoc.id, name, w, dist });
      distances.push(dist);
      console.log(
        `    ✓ ${name} — jobs=${wd.completedJobsCount} rating=${wd.averageRating ?? "n/a"} credit=${w.creditPoints} distKm=${dist.toFixed(2)}`
      );
    }
  }

  if (eligible.length === 0) {
    console.log("  → Result: no eligible experienced workers (would stay PENDING for rookies)");
    return;
  }
  if (eligible.length === 1) {
    console.log(`  → Result: single eligible — assigns to ${eligible[0].name}`);
    return;
  }

  const maxJobs = Math.max(...eligible.map((e) => e.w.workerData.completedJobsCount));
  const maxDist = Math.max(...distances);
  const scored = eligible.map((e) => {
    const wd = e.w.workerData;
    const freq = maxJobs === 0 ? 1 : 1 - wd.completedJobsCount / maxJobs;
    const rating = wd.completedJobsCount === 0 ? DEFAULT_NEW_WORKER_RATING_SCORE : (wd.averageRating ?? 0) / 5;
    const loc = maxDist === 0 ? 1 : 1 - e.dist / maxDist;
    const final =
      freq * ASSIGNMENT_WEIGHTS.FREQUENCY +
      rating * ASSIGNMENT_WEIGHTS.RATING +
      loc * ASSIGNMENT_WEIGHTS.LOCATION;
    return { ...e, freq, rating, loc, final };
  });
  scored.sort((a, b) => b.final - a.final);
  console.log("  Scored:");
  for (const s of scored) {
    console.log(
      `    ${s.final.toFixed(4)}  ${s.name}  (freq=${s.freq.toFixed(2)} rating=${s.rating.toFixed(2)} loc=${s.loc.toFixed(2)})`
    );
  }
  console.log(`  → Would assign: ${scored[0].name}`);
}

async function main() {
  const arg = process.argv[2];
  if (arg) {
    const doc = await db.collection("serviceRequests").doc(arg).get();
    if (!doc.exists) {
      console.log(`Request ${arg} not found`);
      return;
    }
    await diagnoseRequest(doc);
  } else {
    const snap = await db.collection("serviceRequests").where("status", "==", "pending").get();
    console.log(`Found ${snap.size} PENDING request(s)`);
    for (const doc of snap.docs) await diagnoseRequest(doc);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
