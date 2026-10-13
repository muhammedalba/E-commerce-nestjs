/**
 * The `module` value of every audit entry. Stored lower-case: `AuditService.log`
 * normalises whatever it is given, so filters in the dashboard match exactly.
 */
export const AUDIT_MODULES = {
  ORDER: 'order',
  PAYMENT: 'payment',
  BACKUP: 'backup',
  APP_VERSIONS: 'app-versions',
  ROLES: 'roles',
  USERS: 'users',
  SETTINGS: 'settings',
} as const;

/** Audit entries expire (TTL index) one year after they are written. */
export const AUDIT_LOG_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Page size cap of `GET /audit-logs`. */
export const AUDIT_MAX_PAGE_LIMIT = 100;
export const AUDIT_DEFAULT_PAGE_LIMIT = 20;

const SENSITIVE_KEY =
  /password|passwd|token|secret|^otp|cvv|cvc|card_?number|api_?key|private_?key|authorization|cookie/i;
const MAX_DEPTH = 8;

export const REDACTED = '[REDACTED]';

/**
 * Deep copy of `value` with every sensitive key (passwords, tokens, secrets,
 * card data…) replaced by {@link REDACTED}. Applied when an entry is written
 * and again when it is read, so entries written before this existed are
 * covered too. Non-plain objects (ObjectId, Date) are kept as they are.
 */
export function redactSensitive<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    return value.map((v: unknown) => redactSensitive(v, depth + 1)) as T;
  }
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? REDACTED : redactSensitive(v, depth + 1),
      ]),
    ) as T;
  }
  return value;
}
