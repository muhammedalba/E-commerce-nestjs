import { FileAsset } from 'src/shared/schema/file-asset.schema';

/**
 * Prepends BASE_URL to a relative file path or FileAsset object only if
 * the url value doesn't already start with "http".
 *
 * This is the **single source of truth** for building absolute asset URLs.
 * Both `FileUploadService` and `CustomI18nService` delegate to this helper.
 */

const resolveBaseUrl = (): string =>
  process.env.BASE_URL || 'http://localhost:4000';

function transformSinglePath(
  pathOrUrl: string | null | undefined,
): string | null | undefined {
  if (!pathOrUrl || pathOrUrl.startsWith('http')) return pathOrUrl;
  const baseUrl = resolveBaseUrl();
  try {
    return new URL(pathOrUrl, baseUrl).toString();
  } catch {
    return `${baseUrl.replace(/\/$/, '')}${pathOrUrl}`;
  }
}

function transformItem<T extends FileAsset | string | null | undefined>(
  item: T,
): T {
  if (!item) return item;
  if (typeof item === 'string') {
    return transformSinglePath(item) as T;
  }
  if (typeof item === 'object' && item !== null && 'url' in item) {
    return {
      ...item,
      url: transformSinglePath((item as FileAsset).url) || '',
    };
  }
  return item;
}

export function withBaseUrl<T extends FileAsset | string | null | undefined>(
  input: T,
): T;
export function withBaseUrl<T extends FileAsset | string | null | undefined>(
  input: T[],
): T[];
export function withBaseUrl<T extends FileAsset | string | null | undefined>(
  input: T | T[],
): T | T[] {
  if (Array.isArray(input)) {
    return input.map((item) => transformItem(item));
  }
  return transformItem(input);
}
