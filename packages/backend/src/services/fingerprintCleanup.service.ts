const FINGERPRINT_SERVICE_URL = process.env.FINGERPRINT_SERVICE_URL?.replace(/\/$/, "");
const FINGERPRINT_ADMIN_SECRET =
  process.env.FINGERPRINT_ADMIN_SECRET || process.env.FINGERPRINT_LOGIN_SECRET || "";
const FINGERPRINT_CLEANUP_TIMEOUT_MS = 5000;

export interface FingerprintCleanupResult {
  attempted: boolean;
  success: boolean;
  status?: number;
  message: string;
}

export async function deleteFingerprintEnrollment(
  userId: string
): Promise<FingerprintCleanupResult> {
  if (!FINGERPRINT_SERVICE_URL) {
    return {
      attempted: false,
      success: false,
      message: "FINGERPRINT_SERVICE_URL is not configured",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FINGERPRINT_CLEANUP_TIMEOUT_MS);

  try {
    const response = await fetch(`${FINGERPRINT_SERVICE_URL}/fingerprint/delete`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(FINGERPRINT_ADMIN_SECRET
          ? { "x-fingerprint-admin-secret": FINGERPRINT_ADMIN_SECRET }
          : {}),
      },
      body: JSON.stringify({ userId }),
    });
    clearTimeout(timeout);

    let payload: { message?: string; error?: string } = {};
    try {
      payload = (await response.json()) as { message?: string; error?: string };
    } catch {
      payload = {};
    }

    return {
      attempted: true,
      success: response.ok,
      status: response.status,
      message:
        payload.message ||
        payload.error ||
        `Fingerprint cleanup returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      message: error instanceof Error ? error.message : "Fingerprint cleanup failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
