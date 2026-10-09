/**
 * Notification actions that drive the app silently (sign-out, permission
 * refresh) and must never reach the phone's notification tray.
 */
export const SILENT_ACTIONS: ReadonlySet<string> = new Set([
  'FORCE_LOGOUT',
  'REFRESH_PERMISSIONS',
]);

/** i18n key of the push title, by action prefix (first match wins). */
export const PUSH_TITLE_KEYS: readonly [prefix: string, key: string][] = [
  ['ORDER_', 'notification.PUSH_TITLE_ORDER'],
  ['REVIEW_', 'notification.PUSH_TITLE_REVIEW'],
];
export const DEFAULT_PUSH_TITLE_KEY = 'notification.PUSH_TITLE_DEFAULT';
