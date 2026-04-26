/**
 * Time helpers for working with HH:MM 24h strings (the format we persist)
 * while presenting users a 12-hour AM/PM interface.
 */

export function format12h(value?: string | null): string {
  if (!value || typeof value !== "string") return "";
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function format12hRange(start?: string | null, end?: string | null): string {
  const s = format12h(start);
  const e = format12h(end);
  if (!s && !e) return "";
  return `${s} - ${e}`;
}

export function parse24h(hour12: number, minute: number, period: "AM" | "PM"): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function split24h(value: string): { hour12: number; minute: number; period: "AM" | "PM" } {
  if (!value || !value.includes(":")) return { hour12: 8, minute: 0, period: "AM" };
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return { hour12: 8, minute: 0, period: "AM" };
  }
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}
