/**
 * `secretConfig` is write-only over the API: responses carry masked values,
 * and a masked value sent back means "unchanged". Real secrets never contain
 * this character, so it marks a value as masked.
 */
export const SECRET_MASK_CHAR = '•';

type Config = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Config =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Keeps the last 4 characters of longer values so admins can tell keys apart. */
function maskValue(value: string): string {
  const mask = SECRET_MASK_CHAR.repeat(8);
  return value.length > 8 ? `${mask}${value.slice(-4)}` : mask;
}

/**
 * Replaces every non-empty string in a (decrypted) secret config with a mask,
 * recursively. Non-string values are kept.
 */
export function maskSecretConfig(config: unknown): unknown {
  if (Array.isArray(config)) return config.map(maskSecretConfig);
  if (isPlainObject(config)) {
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        key,
        maskSecretConfig(value),
      ]),
    );
  }
  return typeof config === 'string' && config !== ''
    ? maskValue(config)
    : config;
}

/**
 * Applies an incoming secret config onto the stored (decrypted) one, per key:
 * - masked string → unchanged (dropped if the key does not exist yet);
 * - `null` → key removed;
 * - nested object → merged the same way;
 * - anything else → replaces the stored value.
 * Keys not sent are kept, so updating one key never wipes the others.
 */
export function mergeSecretConfig(existing: Config, incoming: Config): Config {
  const merged: Config = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null) {
      delete merged[key];
    } else if (typeof value === 'string' && value.includes(SECRET_MASK_CHAR)) {
      if (!(key in existing)) delete merged[key];
    } else if (isPlainObject(value)) {
      merged[key] = mergeSecretConfig(
        isPlainObject(existing[key]) ? existing[key] : {},
        value,
      );
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

const SECRET_KEY_NAME = /secret|private|password/i;
/** Moyasar (and Stripe-style) secret API keys. */
const SECRET_KEY_VALUE = /^sk_(live|test)_/;

/**
 * Paths in a `publicConfig` that look like secrets, e.g. `MOYASAR_SECRET_KEY`
 * or any `sk_live_…` value. publicConfig is served to every visitor, so such
 * values belong in secretConfig.
 */
export function findSecretLikePaths(config: unknown, path = ''): string[] {
  if (Array.isArray(config)) {
    return config.flatMap((item, i) =>
      findSecretLikePaths(item, `${path}[${i}]`),
    );
  }
  if (isPlainObject(config)) {
    return Object.entries(config).flatMap(([key, value]) => {
      const keyPath = path ? `${path}.${key}` : key;
      return SECRET_KEY_NAME.test(key)
        ? [keyPath]
        : findSecretLikePaths(value, keyPath);
    });
  }
  return typeof config === 'string' && SECRET_KEY_VALUE.test(config.trim())
    ? [path]
    : [];
}
