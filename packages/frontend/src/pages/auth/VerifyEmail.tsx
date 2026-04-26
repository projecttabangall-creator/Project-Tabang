import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { reload, sendEmailVerification } from "firebase/auth";
import { toast } from "sonner";
import { firebaseAuth } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/api";
import { isSeedAuthEmail } from "@/utils/auth";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmail() {
  const navigate = useNavigate();
  const { firebaseUser, userProfile, refreshProfile, signOut } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timeout = window.setTimeout(() => {
      setCooldown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [cooldown]);

  useEffect(() => {
    if (!firebaseUser || !userProfile) {
      navigate("/login", { replace: true });
      return;
    }

    if (userProfile.role !== "resident") {
      navigate("/", { replace: true });
      return;
    }

    if (isSeedAuthEmail(firebaseUser.email)) {
      toast.info("Seed accounts do not use email verification.");
      navigate("/", { replace: true });
      return;
    }

    if (firebaseUser.emailVerified) {
      void handleVerifiedContinue();
    }
  }, [firebaseUser, navigate, userProfile]);

  async function handleVerifiedContinue() {
    if (!firebaseUser) return;

    if (isSeedAuthEmail(firebaseUser.email)) {
      navigate("/", { replace: true });
      return;
    }

    setIsChecking(true);
    try {
      await reload(firebaseUser);
      if (!firebaseAuth.currentUser?.emailVerified) {
        toast.error("Your email is still not verified.");
        return;
      }

      await api.post("/api/auth/profile/sync-email-verification");
      await refreshProfile();
      toast.success("Email verified successfully.");
      navigate("/", { replace: true });
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || "Failed to confirm email verification."
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function handleResendVerification() {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      toast.error("Sign in again to resend the verification email.");
      return;
    }

    if (isSeedAuthEmail(currentUser.email)) {
      toast.info("Seed accounts do not support verification emails.");
      return;
    }

    setIsResending(true);
    try {
      await sendEmailVerification(currentUser);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("Verification email sent.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="card space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Verify Your Email</h1>
            <p className="text-sm text-slate-600">
              We sent a verification link to{" "}
              <span className="font-medium text-slate-900">
                {firebaseUser?.email || userProfile?.email || "your email"}
              </span>
              .
            </p>
            <p className="text-sm text-slate-500">
              Check your inbox and spam folder, then come back here after opening the
              verification link.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your resident account stays blocked until the email is verified.
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleVerifiedContinue()}
              disabled={isChecking}
              className="btn-primary w-full"
            >
              {isChecking ? "Checking..." : "I've Verified My Email"}
            </button>

            <button
              type="button"
              onClick={() => void handleResendVerification()}
              disabled={isResending || cooldown > 0}
              className="btn-secondary w-full"
            >
              {isResending
                ? "Sending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend Verification Email"}
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
            Wrong email or want to stop here?{" "}
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Sign out
            </button>
            .
          </div>

          <div className="text-center text-sm text-slate-500">
            Need password recovery later?{" "}
            <Link
              to="/forgot-password"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Reset by email
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
