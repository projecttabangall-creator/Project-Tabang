import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";
import { Fingerprint, Loader, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";

export function Checkout() {
  const { userProfile } = useAuth();
  const [fpVerified, setFpVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerId = userProfile?.uid;
  const workerData = userProfile?.workerData;

  if (!workerId || !workerData) {
    return <div>Loading...</div>;
  }

  const handleVerifyFingerprint = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:5000/fingerprint/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId }),
      });
      const result = await res.json();
      if (result.success) {
        setFpVerified(true);
        toast.success("Identity verified");
        // Log the verification to the backend
        try {
          await api.post(`/api/workers/${workerId}/verify-fingerprint`, {
            verified: true,
          });
        } catch (logError) {
          console.error("Failed to log fingerprint verification:", logError);
        }
      } else {
        setError(result.message || "Fingerprint not recognized");
        toast.error(result.message || "Fingerprint not recognized");
      }
    } catch {
      setError("Fingerprint service unavailable. Is it running on port 5000?");
      toast.error("Fingerprint service unavailable");
    } finally {
      setVerifying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!fpVerified) {
      toast.error("Please verify your identity first");
      return;
    }
    // TODO: Implement actual withdrawal logic
    toast.info("Withdrawal feature coming soon");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <BackButton />

        <div className="mt-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Withdraw Earnings</h1>
            <p className="text-slate-600 mt-2">
              Verify your identity with your fingerprint to proceed with your withdrawal.
            </p>
          </div>

          {/* Earnings Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Earnings Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Total Earnings</p>
                <p className="text-2xl font-bold text-primary-600">₱0.00</p>
                <p className="text-xs text-slate-500 mt-1">Coming soon</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Pending Payments</p>
                <p className="text-2xl font-bold text-amber-600">₱0.00</p>
                <p className="text-xs text-slate-500 mt-1">Coming soon</p>
              </div>
            </div>
          </div>

          {/* Fingerprint Verification Section */}
          <div className="card border-2 border-primary-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Fingerprint size={20} className="text-primary-600" />
              Identity Verification
            </h2>

            <div className="space-y-4">
              {/* Status Message */}
              {fpVerified && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Identity Verified</p>
                    <p className="text-sm text-green-700">Your fingerprint has been verified.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Verification Failed</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {!fpVerified && !error && (
                <p className="text-sm text-slate-600">
                  Place your finger on the biometric scanner to verify your identity.
                </p>
              )}

              {/* Fingerprint Button */}
              <button
                onClick={handleVerifyFingerprint}
                disabled={verifying || fpVerified}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying && <Loader size={18} className="animate-spin" />}
                {fpVerified
                  ? "✓ Identity Verified"
                  : verifying
                  ? "Scanning..."
                  : "Verify Fingerprint"}
              </button>
            </div>
          </div>

          {/* Withdraw Button */}
          <button
            onClick={handleWithdraw}
            disabled={!fpVerified}
            className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {fpVerified ? "Withdraw Earnings" : "Verify Identity First"}
          </button>

          {/* Info Section */}
          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Place your finger on the biometric scanner</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>Your fingerprint will be verified</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>Once verified, you can withdraw your earnings</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>Funds will be transferred to your account</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
