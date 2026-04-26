export function isSeedAuthEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }

  return email.trim().toLowerCase().endsWith("@tabang.local");
}
