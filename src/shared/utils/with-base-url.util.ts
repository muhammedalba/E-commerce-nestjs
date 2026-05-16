/**
 * Prepends BASE_URL to a relative file path (or array of paths) only if
 * the value doesn't already start with "http".
 *
 * This is the **single source of truth** for building absolute asset URLs.
 * Both `FileUploadService` and `CustomI18nService` delegate to this helper,
 * avoiding duplicated logic and scattered `process.env.BASE_URL` checks.
 *
 * @example — single path
 * withBaseUrl('/uploads/User/avatar.webp')
 * // → 'http://localhost:4000/uploads/User/avatar.webp'
 *
 * @example — array of paths
 * withBaseUrl(['/uploads/Product/a.webp', null])
 * // → ['http://localhost:4000/uploads/Product/a.webp', null]
 */

const resolveBaseUrl = (): string =>
  process.env.BASE_URL || 'http://localhost:4000';

function transformPath(filePath: string | null | undefined): string | null | undefined {
  if (!filePath || filePath.startsWith('http')) return filePath;
  const baseUrl = resolveBaseUrl();
  try {
    return new URL(filePath, baseUrl).toString();
  } catch {
    return `${baseUrl.replace(/\/$/, '')}${filePath}`;
  }
}

export function withBaseUrl(filePath: string | null | undefined): string | null | undefined;
export function withBaseUrl(filePaths: (string | null | undefined)[]): (string | null | undefined)[];
export function withBaseUrl(
  input: string | null | undefined | (string | null | undefined)[],
): string | null | undefined | (string | null | undefined)[] {
  if (Array.isArray(input)) return input.map(transformPath);
  return transformPath(input);
}
