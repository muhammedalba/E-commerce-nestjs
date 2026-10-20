/**
 * Converts any unknown value to a JSON string safely.
 * Returns `'Unknown error'` if serialization fails (e.g., circular references).
 */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return 'Unknown error';
  }
}

/**
 * Strips anything that could be a credential from an error message before it
 * is stored, logged in a run record, returned to the client or emailed:
 * connection strings, bearer/OAuth tokens, `key=`/`token=` parameters.
 *
 * @param err      - The unknown error value to sanitize.
 * @param maxLength - Maximum length of the returned string (default: 500).
 */
export function sanitizeError(err: unknown, maxLength = 500): string {
  const raw =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === 'string'
        ? err
        : safeJson(err);
  return raw
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb://[redacted]')
    .replace(/https?:\/\/[^\s'"]*@[^\s'"]+/gi, '[redacted-url]')
    .replace(/(bearer\s+)[\w\-.~+/=]+/gi, '$1[redacted]')
    .replace(/ya29\.[\w\-.]+/g, '[redacted-token]')
    .replace(/1\/\/[\w\-.]{20,}/g, '[redacted-token]')
    .replace(
      /((?:access_token|refresh_token|client_secret|token|key|password|secret)["']?\s*[:=]\s*["']?)[^\s&"',}]+/gi,
      '$1[redacted]',
    )
    .slice(0, maxLength);
}
