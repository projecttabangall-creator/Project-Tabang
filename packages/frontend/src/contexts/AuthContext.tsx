import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import {
  onAuthStateChanged,
  reload,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/config/firebase";
import { UserRole } from "@tabang/shared";
import { buildAuthEmailCandidates } from "@/utils/phone";
import api from "@/services/api";

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface WorkingScheduleEntry {
  requestId: string;
  categoryName: string;
  itemName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface Credential {
  type: string;
  name?: string;
  fileUrl: string;
  uploadedAt: any;
}

interface WorkerData {
  specialization: string | string[];
  credentials: Credential[];
  biometricEnrolled?: boolean;
  averageRating: number;
  completedJobsCount: number;
  isAvailable: boolean;
  availability: AvailabilitySlot[];
  workingSchedule?: WorkingScheduleEntry[];
}

export interface UserProfile {
  uid: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  contactNumber: string;
  email?: string;
  isVerified: boolean;
  accountStatus: string;
  suspendReason?: string;
  suspendUntil?: Date | null;
  suspendedAt?: Date;
  banReason?: string;
  bannedAt?: Date;
  creditPoints: number;
  mustChangePassword?: boolean;
  profilePhotoUrl?: string;
  biometricEnrolled?: boolean;
  lastFingerprintVerification?: {
    verified: boolean;
    timestamp?: Date | null;
  };
  workerData?: WorkerData;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signInWithFingerprintToken: (customToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ADMIN_ACTIVITY_STORAGE_KEY = "tabang_admin_last_activity";

function isPrivilegedRole(role?: UserRole | null): boolean {
  return role === "admin" || role === "superadmin";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);

  // Helper to convert Firestore Timestamp to Date
  function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    return null;
  }

  // Listen to auth state changes and set up real-time profile listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      setLoading(true);
      setFirebaseUser(user);

      // Clean up any previous Firestore listener
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
        profileUnsubscribeRef.current = null;
      }

      if (user) {
        // Set up real-time listener for user profile
        const userDocRef = doc(firestore, "users", user.uid);
        profileUnsubscribeRef.current = onSnapshot(
          userDocRef,
          (snap) => {
            if (!snap.exists()) {
              setUserProfile(null);
              setLoading(false);
              return;
            }

            const data = snap.data();
            setUserProfile({
              uid: user.uid,
              role: data.role as UserRole,
              firstName: data.firstName,
              lastName: data.lastName,
              contactNumber: data.contactNumber,
              email: data.email,
              isVerified: data.isVerified,
              accountStatus: data.accountStatus,
              suspendReason: data.suspendReason,
              suspendUntil: toDate(data.suspendUntil) ?? undefined,
              suspendedAt: toDate(data.suspendedAt) ?? undefined,
              banReason: data.banReason,
              bannedAt: toDate(data.bannedAt) ?? undefined,
              creditPoints: data.creditPoints,
              mustChangePassword: Boolean(data.mustChangePassword),
              profilePhotoUrl: data.profilePhotoUrl,
              biometricEnrolled: Boolean(data.biometricEnrolled),
              lastFingerprintVerification: data.lastFingerprintVerification
                ? {
                    verified: Boolean(data.lastFingerprintVerification.verified),
                    timestamp: toDate(data.lastFingerprintVerification.timestamp),
                  }
                : undefined,
              workerData: data.workerData,
            });
            setLoading(false);
          },
          () => {
            setUserProfile(null);
            setLoading(false);
          }
        );
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
      }
    };
  }, []);

  // Sign in with contact number (converted to email format) and password
  async function signIn(identifier: string, password: string) {
    const trimmedIdentifier = identifier.trim().toLowerCase();
    const isEmailLogin = trimmedIdentifier.includes("@");
    let lastError: unknown = null;

    const candidates = isEmailLogin
      ? [trimmedIdentifier]
      : buildAuthEmailCandidates(trimmedIdentifier);

    if (!isEmailLogin) {
      try {
        const response = await api.post("/api/auth/resolve-login-identifier", {
          contactNumber: trimmedIdentifier,
        });
        const resolvedEmail = response.data?.email;
        if (typeof resolvedEmail === "string" && resolvedEmail.trim()) {
          candidates.unshift(resolvedEmail.trim().toLowerCase());
        }
      } catch {
        // Fall back to legacy contact-number-derived auth aliases.
      }
    }

    for (const email of Array.from(new Set(candidates))) {
      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );

        await reload(credential.user);

        const userDoc = await getDoc(doc(firestore, "users", credential.user.uid));
        const profileData = userDoc.data();

        if (
          profileData?.role === "resident" &&
          credential.user.emailVerified &&
          !profileData?.isVerified
        ) {
          await api.post("/api/auth/profile/sync-email-verification");
        }

        return;
      } catch (error: any) {
        lastError = error;
        if (error.code !== "auth/invalid-credential") {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async function signInWithFingerprintToken(customToken: string) {
    const credential = await signInWithCustomToken(firebaseAuth, customToken);
    await reload(credential.user);
  }

  // Sign out
  async function signOut() {
    await firebaseSignOut(firebaseAuth);
    window.localStorage.removeItem(ADMIN_ACTIVITY_STORAGE_KEY);
    setUserProfile(null);
  }

  useEffect(() => {
    if (!firebaseUser || !userProfile || !isPrivilegedRole(userProfile.role)) {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      return;
    }

    let isDisposed = false;

    const clearIdleTimeout = () => {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };

    const forceSignOutForInactivity = async () => {
      clearIdleTimeout();
      window.localStorage.removeItem(ADMIN_ACTIVITY_STORAGE_KEY);

      if (!isDisposed) {
        await firebaseSignOut(firebaseAuth);
        setUserProfile(null);
      }
    };

    const scheduleIdleTimeout = (lastActivityAt: number) => {
      clearIdleTimeout();
      const elapsed = Date.now() - lastActivityAt;

      if (elapsed >= ADMIN_IDLE_TIMEOUT_MS) {
        void forceSignOutForInactivity();
        return;
      }

      idleTimeoutRef.current = window.setTimeout(() => {
        void forceSignOutForInactivity();
      }, ADMIN_IDLE_TIMEOUT_MS - elapsed);
    };

    const recordActivity = () => {
      const now = Date.now();
      window.localStorage.setItem(ADMIN_ACTIVITY_STORAGE_KEY, String(now));
      scheduleIdleTimeout(now);
    };

    const syncActivityFromStorage = () => {
      const rawValue = window.localStorage.getItem(ADMIN_ACTIVITY_STORAGE_KEY);
      const lastActivityAt = rawValue ? Number(rawValue) : NaN;

      if (!Number.isFinite(lastActivityAt)) {
        recordActivity();
        return;
      }

      scheduleIdleTimeout(lastActivityAt);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncActivityFromStorage();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    syncActivityFromStorage();

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }
    window.addEventListener("focus", syncActivityFromStorage);
    window.addEventListener("storage", syncActivityFromStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isDisposed = true;
      clearIdleTimeout();
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
      window.removeEventListener("focus", syncActivityFromStorage);
      window.removeEventListener("storage", syncActivityFromStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [firebaseUser, userProfile]);

  // Refresh profile data (kept for backward compatibility but works via onSnapshot now)
  async function refreshProfile() {
    if (firebaseUser) {
      const userDoc = await getDoc(doc(firestore, "users", firebaseUser.uid));
      if (!userDoc.exists()) {
        setUserProfile(null);
        return;
      }

      const data = userDoc.data();
      setUserProfile({
        uid: firebaseUser.uid,
        role: data.role as UserRole,
        firstName: data.firstName,
        lastName: data.lastName,
        contactNumber: data.contactNumber,
        email: data.email,
        isVerified: data.isVerified,
        accountStatus: data.accountStatus,
        suspendReason: data.suspendReason,
        suspendUntil: toDate(data.suspendUntil) ?? undefined,
        suspendedAt: toDate(data.suspendedAt) ?? undefined,
        banReason: data.banReason,
        bannedAt: toDate(data.bannedAt) ?? undefined,
        creditPoints: data.creditPoints,
        mustChangePassword: Boolean(data.mustChangePassword),
        profilePhotoUrl: data.profilePhotoUrl,
        biometricEnrolled: Boolean(data.biometricEnrolled),
        lastFingerprintVerification: data.lastFingerprintVerification
          ? {
              verified: Boolean(data.lastFingerprintVerification.verified),
              timestamp: toDate(data.lastFingerprintVerification.timestamp),
            }
          : undefined,
        workerData: data.workerData,
      });
    }
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
      signIn,
      signInWithFingerprintToken,
      signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
