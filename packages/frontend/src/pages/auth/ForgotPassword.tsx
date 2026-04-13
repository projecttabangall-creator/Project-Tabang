import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";

type Step = "request" | "confirm";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("request");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactNumber, setContactNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();

    if (!contactNumber.trim()) {
      toast.error("Please enter your registered contact number");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post("/api/auth/reset-password", {
        contactNumber: contactNumber.trim(),
      });

      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
        toast.success(`OTP generated for testing: ${data.devOtp}`);
      } else {
        setDevOtpHint("");
        toast.success("If the number is registered, an OTP has been sent.");
      }

      setStep("confirm");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to request reset OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/auth/reset-password/confirm", {
        contactNumber: contactNumber.trim(),
        otp: otp.trim(),
        newPassword,
      });

      toast.success("Password reset successful. You can now sign in.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <BackButton to="/login" label="Back to Login" />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">Reset Password</h1>
          <p className="text-slate-500 mt-2">
            Request an OTP, then confirm your new password.
          </p>
        </div>

        <div className="card">
          {step === "request" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="contactNumber" className="label">
                  Registered Contact Number
                </label>
                <input
                  id="contactNumber"
                  type="tel"
                  placeholder="09171234567"
                  className="input-field"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
              >
                {isSubmitting ? "Sending OTP..." : "Send Reset OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700">
                OTP sent for <strong>{contactNumber}</strong>.
                {devOtpHint && (
                  <p className="mt-2 font-medium">Testing OTP: {devOtpHint}</p>
                )}
              </div>

              <div>
                <label htmlFor="otp" className="label">
                  OTP
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="input-field"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="label">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  className="input-field"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your new password"
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="btn-secondary flex-1"
                >
                  Request New OTP
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
