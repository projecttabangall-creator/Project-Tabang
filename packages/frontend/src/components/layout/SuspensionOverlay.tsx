import { useEffect, useState } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { UserProfile } from "@/contexts/AuthContext";

interface SuspensionOverlayProps {
  userProfile: UserProfile;
  onSignOut: () => Promise<void>;
}

export function SuspensionOverlay({
  userProfile,
  onSignOut,
}: SuspensionOverlayProps) {
  const [countdown, setCountdown] = useState<string>("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (userProfile.accountStatus !== "suspended" || !userProfile.suspendUntil) {
      return;
    }

    const updateCountdown = () => {
      const until = new Date(userProfile.suspendUntil as Date).getTime();
      const now = Date.now();
      const ms = until - now;

      if (ms <= 0) {
        setCountdown("Suspension period has ended. Please log in again.");
        return;
      }

      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${days}d ${hours}h ${mins}m remaining`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [userProfile.suspendUntil, userProfile.accountStatus]);

  const isSuspended = userProfile.accountStatus === "suspended";
  const isBanned = userProfile.accountStatus === "banned";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        {isSuspended && (
          <>
            <div className="mb-6 flex justify-center">
              <AlertTriangle className="h-16 w-16 text-amber-500" />
            </div>
            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Your Account is Suspended
            </h1>
            <p className="mb-6 text-center text-gray-600">
              Your account has been temporarily suspended.
            </p>

            {userProfile.suspendReason && (
              <div className="mb-6 rounded-lg bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Reason for Suspension:
                </p>
                <p className="mt-2 text-sm text-amber-800">
                  {userProfile.suspendReason}
                </p>
              </div>
            )}

            {userProfile.suspendUntil ? (
              <div className="mb-6 rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Time Remaining:
                </p>
                <p className="mt-2 text-lg font-mono font-bold text-blue-700">
                  {countdown}
                </p>
              </div>
            ) : (
              <div className="mb-6 rounded-lg bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Duration:</p>
                <p className="mt-2 text-sm text-amber-800">
                  Until manually lifted by the barangay
                </p>
              </div>
            )}

            <div className="mb-6 rounded-lg bg-gray-100 p-4">
              <p className="text-center text-sm text-gray-700">
                Please approach the <strong>Barangay</strong> to resolve this
                matter and settle your account.
              </p>
            </div>
          </>
        )}

        {isBanned && (
          <>
            <div className="mb-6 flex justify-center">
              <Ban className="h-16 w-16 text-red-600" />
            </div>
            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Your Account has been Permanently Banned
            </h1>
            <p className="mb-6 text-center text-gray-600">
              Your account cannot be used anymore.
            </p>

            {userProfile.banReason && (
              <div className="mb-6 rounded-lg bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-900">
                  Reason for Ban:
                </p>
                <p className="mt-2 text-sm text-red-800">
                  {userProfile.banReason}
                </p>
              </div>
            )}

            <div className="mb-6 rounded-lg bg-gray-100 p-4">
              <p className="text-center text-sm text-gray-700">
                Please approach the <strong>Barangay</strong> to resolve this
                matter and appeal your ban.
              </p>
            </div>
          </>
        )}

        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full rounded-lg bg-slate-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {isSigningOut ? "Signing Out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
