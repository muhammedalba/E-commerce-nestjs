/**
 * Origin of a URL ("https://site.com/a?b" → "https://site.com"), or undefined
 * when missing or malformed. Compare origins with ===, never a prefix, so
 * "https://site.com.evil.com" does not pass for "https://site.com".
 */
export function toOrigin(value?: string): string | undefined {
  try {
    return value ? new URL(value).origin : undefined;
  } catch {
    return undefined;
  }
}

/** Website origins allowed by CORS: CLIENT_URL, plus local hosts in development. */
export function getAllowedOrigins(): string[] {
  const origins =
    process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          'http://10.5.50.6:3000',
          'http://172.20.10.7:3000',
          process.env.CLIENT_URL,
        ]
      : [process.env.CLIENT_URL];
  return origins.filter((o): o is string => !!o);
}
