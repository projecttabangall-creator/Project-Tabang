import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get the count of unread notifications for the current user.
 * Lightweight — only counts unread documents, doesn't fetch full data.
 */
export function useUnreadNotifications(): number {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(firestore, "notifications"),
      where("userId", "==", userProfile.uid),
      where("isRead", "==", false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
      },
      () => {
        // Silently fail on error
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  return unreadCount;
}
