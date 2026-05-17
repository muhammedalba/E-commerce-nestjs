/**
 * UTILITY: Enterprise-Grade Payload Sanitization
 * Safely strips 'undefined' values recursively to prevent Mongoose from
 * accidentally overwriting valid data with null/empty states.
 */
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    // CRITICAL FIX: Strip undefined items from arrays before sanitizing children
    return obj
      .filter((item) => item !== undefined)
      .map(sanitizePayload) as unknown as T;
  }

  const cleaned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (obj[key] !== undefined) {
        cleaned[key] = sanitizePayload(obj[key]);
      }
    }
  }
  return cleaned;
}
