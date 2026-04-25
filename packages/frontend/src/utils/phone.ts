export function normalizePhilippinePhoneNumber(
  value: string,
  format: "local" | "e164" = "local"
): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  let local = "";
  let e164 = "";

  if (digits.length === 10 && digits.startsWith("9")) {
    local = `0${digits}`;
    e164 = `+63${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    local = digits;
    e164 = `+63${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith("63")) {
    local = `0${digits.slice(2)}`;
    e164 = `+${digits}`;
  } else if (digits.length === 13 && trimmed.startsWith("+63")) {
    local = `0${digits.slice(2)}`;
    e164 = `+${digits}`;
  }

  if (!local || !e164) {
    return trimmed;
  }

  return format === "e164" ? e164 : local;
}

export function buildAuthEmailCandidates(contactNumber: string): string[] {
  const trimmed = contactNumber.trim();
  const local = normalizePhilippinePhoneNumber(trimmed, "local");
  const e164 = normalizePhilippinePhoneNumber(trimmed, "e164");

  return Array.from(
    new Set(
      [trimmed, local, e164]
        .filter(Boolean)
        .map((value) => `${value.replace(/\+/g, "")}@tabang.local`)
    )
  );
}
