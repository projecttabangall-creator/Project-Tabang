export type PhoneFormat = "local" | "e164";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhilippinePhoneNumber(
  value: string,
  format: PhoneFormat = "local"
): string {
  const trimmed = value.trim();
  const digits = digitsOnly(trimmed);

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

export function getPhilippinePhoneCandidates(value: string): string[] {
  const trimmed = value.trim();
  const local = normalizePhilippinePhoneNumber(trimmed, "local");
  const e164 = normalizePhilippinePhoneNumber(trimmed, "e164");

  return Array.from(new Set([trimmed, local, e164].filter(Boolean)));
}

export function buildAuthEmailCandidates(contactNumber: string): string[] {
  const candidates = getPhilippinePhoneCandidates(contactNumber);

  return Array.from(
    new Set(
      candidates.map((value) => `${value.replace(/\+/g, "")}@tabang.local`)
    )
  );
}

export function buildPreferredAuthEmail(contactNumber: string): string {
  return buildAuthEmailCandidates(contactNumber)[0] || `${contactNumber.trim().replace(/\+/g, "")}@tabang.local`;
}
