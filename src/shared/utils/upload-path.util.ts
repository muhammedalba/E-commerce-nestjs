import * as path from 'path';

/**
 * Returns the absolute filesystem root for all user uploads.
 *
 * Resolution order:
 *   1. UPLOADS_ROOT env var  →  path.resolve(UPLOADS_ROOT)
 *      Works for both relative ("./uploads") and absolute ("/home/user/uploads").
 *   2. Fallback              →  path.resolve(process.cwd(), UPLOADS_FOLDER || 'uploads')
 *      Identical to the previous behaviour so local dev is unaffected.
 *
 * @example
 *   UPLOADS_ROOT=./uploads          → /project/server/uploads  (local dev)
 *   UPLOADS_ROOT=/home/user/uploads → /home/user/uploads       (production)
 *   (not set)                       → /project/server/uploads  (legacy fallback)
 */
export function getUploadsRoot(): string {
  const root = process.env.UPLOADS_ROOT?.trim();
  const nodeEnv = process.env.NODE_ENV;
  if (root && nodeEnv === 'production') {
    return path.resolve(root); // handles both relative & absolute paths
  }
  // Legacy fallback — keeps local development behaviour identical to before
  const folder = (process.env.UPLOADS_FOLDER || 'uploads').trim();
  return path.resolve(process.cwd(), folder);
}

/**
 * Safely converts a public URL path to an absolute filesystem path.
 *
 * Security guarantees (Defense in Depth):
 *   1. Rejects any path containing '..' segments BEFORE stripping the prefix.
 *   2. Verifies the path starts with the configured uploads route prefix.
 *   3. Extracts the relative part correctly after the prefix.
 *   4. Uses path.resolve() to compute the final absolute path.
 *   5. Containment check — verifies the resolved path is strictly inside UPLOADS_ROOT.
 *
 * @param publicPath  e.g. "/uploads/Product/abc.webp"
 * @returns           e.g. "/home/USERNAME/uploads/Product/abc.webp"  (production)
 *                         "/project/server/uploads/Product/abc.webp" (local dev)
 * @throws            Error with descriptive message if path is unsafe
 *
 * @example — safe path
 *   resolveToFilesystem('/uploads/Product/abc.webp')
 *   // → '/home/USERNAME/uploads/Product/abc.webp'
 *
 * @example — rejected paths
 *   resolveToFilesystem('/uploads/../.env')          → throws (path traversal)
 *   resolveToFilesystem('/uploads/../../etc/shadow') → throws (path traversal)
 *   resolveToFilesystem('/etc/passwd')               → throws (wrong prefix)
 *   resolveToFilesystem('/uploads/')                 → throws (resolves to root itself)
 */
export function resolveToFilesystem(publicPath: string): string {
  if (!publicPath || typeof publicPath !== 'string') {
    throw new Error('Invalid path: path must be a non-empty string');
  }

  // ── Step 1: normalise separators and reject '..' anywhere ──────────────
  // Replace backslashes so both Unix and Windows paths are handled uniformly.
  const normalised = publicPath.replace(/\\/g, '/');
  const segments = normalised.split('/');
  if (segments.some((seg) => seg === '..')) {
    throw new Error(`Path traversal detected in: ${publicPath}`);
  }

  // ── Step 2: verify the path starts with the uploads route prefix ────────
  const route = `/${process.env.UPLOADS_FOLDER || 'uploads'}`.replace(
    /\/+$/,
    '',
  );
  if (!normalised.startsWith(route + '/') && normalised !== route) {
    throw new Error(
      `Path "${publicPath}" does not start with uploads route "${route}"`,
    );
  }

  // ── Step 3: extract the relative part AFTER the route prefix ───────────
  const relativePart = normalised.slice(route.length).replace(/^\/+/, '');

  // ── Step 4: reject empty relative part (would resolve to root itself) ───
  if (!relativePart) {
    throw new Error(`Path resolves to uploads root itself: ${publicPath}`);
  }

  // ── Step 5: compute the absolute path ───────────────────────────────────
  const uploadsRoot = getUploadsRoot();
  const resolved = path.resolve(uploadsRoot, relativePart);

  // ── Step 6: containment check — must be strictly inside uploadsRoot ──────
  // Append path.sep so "/home/uploads-extra/..." cannot pass as "/home/uploads"
  const rootWithSep = uploadsRoot.endsWith(path.sep)
    ? uploadsRoot
    : uploadsRoot + path.sep;

  if (!resolved.startsWith(rootWithSep)) {
    throw new Error(
      `Path escapes uploads root. resolved="${resolved}", root="${uploadsRoot}"`,
    );
  }

  return resolved;
}
