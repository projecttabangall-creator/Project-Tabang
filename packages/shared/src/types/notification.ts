export type NotificationType =
  | "assignment"
  | "acceptance"
  | "arrival"
  | "payment"
  | "dispute"
  | "system";

export type NotificationRefType = "request" | "dispute" | "payment";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType: NotificationRefType;
  referenceId: string;
  isRead: boolean;
  createdAt: Date;
}
