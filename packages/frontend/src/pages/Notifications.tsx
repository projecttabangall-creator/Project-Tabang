import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/common/BackButton";
import {
  Bell,
  CheckCheck,
  ClipboardList,
  AlertTriangle,
  CreditCard,
  Wrench,
  MapPin,
  Info,
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  referenceType: string;
  referenceId: string;
  isRead: boolean;
  createdAt: Timestamp | Date;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  assignment: ClipboardList,
  acceptance: Wrench,
  arrival: MapPin,
  payment: CreditCard,
  dispute: AlertTriangle,
  system: Info,
};

const TYPE_COLORS: Record<string, string> = {
  assignment: "bg-primary-100 text-primary-600",
  acceptance: "bg-emerald-100 text-emerald-600",
  arrival: "bg-accent-100 text-accent-700",
  payment: "bg-emerald-100 text-emerald-600",
  dispute: "bg-rose-100 text-rose-600",
  system: "bg-slate-100 text-slate-600",
};

function getNotificationLink(
  role: string,
  referenceType: string,
  referenceId: string
): string {
  if (referenceType === "request") {
    if (role === "resident") return `/resident/request/${referenceId}`;
    if (role === "worker") return `/worker/job/${referenceId}`;
    return `/admin/requests`;
  }
  if (referenceType === "dispute") {
    if (role === "admin") return `/admin/disputes`;
    return `/${role}/notifications`;
  }
  if (referenceType === "payment") {
    if (role === "admin") return `/admin/payments`;
    if (role === "resident") return `/resident/request/${referenceId}`;
    return `/${role}/notifications`;
  }
  if (referenceType === "emergency") {
    if (role === "admin") return `/admin/emergencies/${referenceId}`;
    if (role === "resident") return `/resident/emergencies`;
    if (role === "worker") return `/worker/emergencies`;
  }
  return `/${role}/notifications`;
}

function formatTime(ts: Timestamp | Date | undefined): string {
  if (!ts) return "";
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

export function Notifications() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(firestore, "notifications"),
      where("userId", "==", userProfile.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId || "",
            type: data.type || "system",
            title: data.title || "",
            body: data.body || "",
            referenceType: data.referenceType || "",
            referenceId: data.referenceId || "",
            isRead: data.isRead ?? false,
            createdAt: data.createdAt,
          };
        }) as NotificationItem[];
        setNotifications(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAsRead(notifId: string) {
    await updateDoc(doc(firestore, "notifications", notifId), {
      isRead: true,
    });
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    const batch = writeBatch(firestore);
    unread.forEach((n) => {
      batch.update(doc(firestore, "notifications", n.id), { isRead: true });
    });
    await batch.commit();
  }

  function handleClick(notif: NotificationItem) {
    if (!notif.isRead) markAsRead(notif.id);
    if (userProfile?.role && notif.referenceType && notif.referenceId) {
      const link = getNotificationLink(
        userProfile.role,
        notif.referenceType,
        notif.referenceId
      );
      navigate(link);
    }
  }

  const backPath =
    userProfile?.role === "resident"
      ? "/resident/requests"
      : userProfile?.role === "worker"
      ? "/worker/home"
      : "/admin/dashboard";

  return (
    <div>
      <BackButton to={backPath} label="Back" />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="page-title">Notifications</h2>
          {unreadCount > 0 && (
            <span className="badge-accent">{unreadCount} new</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-12">
          <Bell size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No notifications yet.</p>
          <p className="text-sm text-slate-400 mt-2">
            You'll be notified about job updates, payments, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || Bell;
            const iconColor = TYPE_COLORS[notif.type] || TYPE_COLORS.system;

            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`card !p-4 w-full text-left flex items-start gap-3 transition-all ${
                  notif.isRead
                    ? "opacity-70"
                    : "!border-primary-200 !bg-primary-50/30"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}
                >
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm ${
                        notif.isRead
                          ? "font-medium text-slate-600"
                          : "font-semibold text-slate-900"
                      }`}
                    >
                      {notif.title}
                    </h4>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                    {notif.body}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatTime(notif.createdAt)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
