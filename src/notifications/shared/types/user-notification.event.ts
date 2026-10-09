/** Payload of a `user.notification.<userId>` event. */
export interface UserNotificationEvent {
  userId: string;
  /** Action code, e.g. `ORDER_SHIPPED`, `REVIEW_APPROVED`, `FORCE_LOGOUT`. */
  action: string;
  message: string | { ar: string; en: string };
  payload?: Record<string, unknown>;
}
