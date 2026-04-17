import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/config/firebase";
import { UserRole } from "@tabang/shared";

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

interface UserProfile {
  uid: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  contactNumber: string;
  email?: string;
  isVerified: boolean;
  accountStatus: string;
  creditPoints: number;
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

  // Fetch user profile from Firestore
  async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return {
      uid,
      role: data.role as UserRole,
      firstName: data.firstName,
      lastName: data.lastName,
      contactNumber: data.contactNumber,
      email: data.email,
      isVerified: data.isVerified,
      accountStatus: data.accountStatus,
      creditPoints: data.creditPoints,
      profilePhotoUrl: data.profilePhotoUrl,
      workerData: data.workerData,
    };
  }

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
        setFirebaseUser(user);
        if (user) {
          const profile = await fetchUserProfile(user.uid);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setFirebaseUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Sign in with contact number (converted to email format) and password
  async function signIn(contactNumber: string, password: string) {
    const email = `${contactNumber.replace(/\+/g, "")}@tabang.local`;
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  }

  // Sign out
  async function signOut() {
    await firebaseSignOut(firebaseAuth);
    setUserProfile(null);
  }

  // Refresh profile data
  async function refreshProfile() {
    if (firebaseUser) {
      const profile = await fetchUserProfile(firebaseUser.uid);
      setUserProfile(profile);
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
