import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/services/api";
import { BackButton } from "@/components/common/BackButton";
import logoWithText from "@Assets/logo-with-text.png";

export function OTPVerification() {
  const location = useLocation();
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const contactNumber = location.state?.contactNumber || "";

  async function handleVerify() {
    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/api/auth/verify-otp", { contactNumber, otp });
      toast.success("Account verified! You can now sign in.");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  }

  if (!contactNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="card text-center">
          <p className="text-slate-500 mb-4">
            No contact number provided. Please register first.
          </p>
          <Link to="/register" className="btn-primary inline-block">
            Go to Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <BackButton to="/register" label="Back to Register" />
        <div className="text-center mb-8">
          <img
            src={logoWithText}
            alt="TABANG"
            className="h-24 object-contain mx-auto mb-3"
          />
          <h1 className="text-4xl font-extrabold text-primary-700 font-display tracking-tight mb-2">
            TABANG
          </h1>
          <p className="text-slate-500">Verify your account</p>
        </div>

        <div className="card text-center">
          <h2 className="text-xl font-semibold mb-2">Enter OTP</h2>
          <p className="text-slate-500 text-sm mb-6">
            We sent a 6-digit code to <strong>{contactNumber}</strong>
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="input-field text-center text-2xl tracking-[0.5em] font-mono mb-6"
          />

          <button
            onClick={handleVerify}
            disabled={isLoading || otp.length !== 6}
            className="btn-primary w-full"
          >
            {isLoading ? "Verifying..." : "Verify"}
          </button>

          <p className="text-sm text-slate-500 mt-4">
            Didn't receive the code?{" "}
            <button className="text-primary-600 hover:text-primary-700 font-medium">
              Resend OTP
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
