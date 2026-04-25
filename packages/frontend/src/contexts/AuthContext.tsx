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
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/config/firebase";
import { UserRole } from "@tabang/shared";
import { buildAuthEmailCandidates } from "@/utils/phone";

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Credential {
  type: string;
  name?: string;
  fileUrl: string;
  uploadedAt: any;
}

interface WorkerData {
  specialization: string;
  credentials: Credential[];
  averageRating: number;
  completedJobsCount: number;
  isAvailable: boolean;
  availability: AvailabilitySlot[];
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
  workerData?: WorkerData;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (contactNumber: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);

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
  async function signIn(contactNumber: string, password: string) {
    let lastError: unknown = null;

    for (const email of buildAuthEmailCandidates(contactNumber)) {
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
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

  // Sign out
  async function signOut() {
    await firebaseSignOut(firebaseAuth);
    setUserProfile(null);
  }

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
