import { useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type WhereFilterOp,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";

type RefreshHandler = () => void | Promise<void>;

function useLatestRefresh(onRefresh: RefreshHandler) {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  return refreshRef;
}

export function useRequestDocumentLiveRefresh(
  requestId: string | undefined,
  onRefresh: RefreshHandler,
  enabled = true
) {
  const refreshRef = useLatestRefresh(onRefresh);

  useEffect(() => {
    if (!enabled || !requestId) return;

    let hasSeenInitialSnapshot = false;
    const unsubscribe = onSnapshot(
      doc(firestore, "serviceRequests", requestId),
      () => {
        if (!hasSeenInitialSnapshot) {
          hasSeenInitialSnapshot = true;
          return;
        }
        void refreshRef.current();
      },
      (error) => {
        console.warn("Request live refresh listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [enabled, requestId, refreshRef]);
}

export function useRequestCollectionLiveRefresh(
  field: "residentId" | "assignedWorkerId",
  operator: WhereFilterOp,
  value: string | undefined,
  onRefresh: RefreshHandler,
  enabled = true
) {
  const refreshRef = useLatestRefresh(onRefresh);

  useEffect(() => {
    if (!enabled || !value) return;

    let hasSeenInitialSnapshot = false;
    const liveQuery = query(
      collection(firestore, "serviceRequests"),
      where(field, operator, value)
    );

    const unsubscribe = onSnapshot(
      liveQuery,
      () => {
        if (!hasSeenInitialSnapshot) {
          hasSeenInitialSnapshot = true;
          return;
        }
        void refreshRef.current();
      },
      (error) => {
        console.warn("Request collection live refresh listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [enabled, field, operator, value, refreshRef]);
}

export function usePendingRequestPoolLiveRefresh(
  onRefresh: RefreshHandler,
  enabled = true
) {
  const refreshRef = useLatestRefresh(onRefresh);

  useEffect(() => {
    if (!enabled) return;

    let hasSeenInitialSnapshot = false;
    const unsubscribe = onSnapshot(
      doc(firestore, "requestSignals", "pendingPool"),
      () => {
        if (!hasSeenInitialSnapshot) {
          hasSeenInitialSnapshot = true;
          return;
        }
        void refreshRef.current();
      },
      (error) => {
        console.warn("Pending request pool live refresh listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [enabled, refreshRef]);
}
