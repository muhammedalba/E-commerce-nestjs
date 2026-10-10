/**
 * App version as the stores show it: `major[.minor[.patch]]`, optionally with
 * a `+build` suffix that is ignored when comparing (e.g. `1.4.2+37`).
 */
export const APP_VERSION_PATTERN =
  /^\d{1,6}(\.\d{1,6}){0,2}(\+[0-9A-Za-z.-]{1,32})?$/;

export function isValidAppVersion(version: unknown): version is string {
  return typeof version === 'string' && APP_VERSION_PATTERN.test(version);
}

/** `[major, minor, patch]`; missing parts count as 0 (`1.2` == `1.2.0`). */
function parts(version: string): [number, number, number] {
  if (!isValidAppVersion(version)) {
    throw new Error(`Invalid app version: ${JSON.stringify(version)}`);
  }
  const [major, minor = 0, patch = 0] = version
    .split('+')[0]
    .split('.')
    .map(Number);
  return [major, minor, patch];
}

/**
 * Compares two app versions numerically (`1.10.0` > `1.9.0`).
 * @returns a negative number if `a < b`, 0 if equal, positive if `a > b`.
 * @throws if either version does not match {@link APP_VERSION_PATTERN}.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
