import * as crypto from 'crypto';

// 1. Key Length Safety: Guarantee exactly 32 bytes using SHA-256 hash
const RAW_SECRET =
  process.env.PAYMENT_CONFIG_SECRET || 'fallback_secret_do_not_use_in_prod';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_SECRET).digest();
const LEGACY_IV_LENGTH = process.env.LEGACY_IV_LENGTH || 16; // AES-CBC used a 16-byte IV
const IV_LENGTH = process.env.IV_LENGTH || 12; // GCM standard IV size is 12 bytes

function encryptString(text: string): string {
  const iv = crypto.randomBytes(Number(IV_LENGTH));
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get Auth Tag for GCM
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Backward-compatible decrypt for old AES-256-CBC encrypted values (2-part: iv:encrypted).
 * Data saved before the GCM migration used this format.
 */
function decryptStringLegacy(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 2) return text;

  try {
    const [ivHex, encryptedHex] = parts;
    // Sanity-check: old CBC IV was always 16 bytes = 32 hex chars
    if (ivHex.length !== Number(LEGACY_IV_LENGTH) * 2) return text;

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // CBC decryption failed — data was likely encrypted with a different key.
    // Admin must re-save the config value as plaintext through the admin panel.
    return text;
  }
}

function decryptString(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const textParts = text.split(':');

  // 3-part format → current AES-256-GCM (iv:authTag:encrypted)
  if (textParts.length === 3) {
    try {
      const [ivHex, authTagHex, encryptedHex] = textParts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        ENCRYPTION_KEY,
        iv,
      );

      decipher.setAuthTag(authTag); // Required for GCM

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Return original if decryption fails (e.g. tampered data)
      return text;
    }
  }

  // 2-part format → legacy AES-256-CBC (iv:encrypted) — backward compatibility
  if (textParts.length === 2) {
    return decryptStringLegacy(text);
  }

  return text;
}

// 2. Recursive encryption to handle nested config objects
export function encryptConfigValues(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;
  if (Array.isArray(config)) {
    return (config as unknown[]).map((item) => encryptConfigValues(item));
  }

  const encryptedConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    config as Record<string, unknown>,
  )) {
    if (typeof value === 'string' && value.trim() !== '') {
      encryptedConfig[key] = encryptString(value);
    } else if (typeof value === 'object' && value !== null) {
      encryptedConfig[key] = encryptConfigValues(value); // Recursive call
    } else {
      encryptedConfig[key] = value;
    }
  }
  return encryptedConfig;
}

// 3. Recursive decryption — exported so service can call it explicitly with .lean() results
export function decryptConfigValues(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;

  if (Array.isArray(config)) {
    return (config as unknown[]).map((item) => decryptConfigValues(item));
  }

  const decryptedConfig: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    config as Record<string, unknown>,
  )) {
    if (typeof value === 'string' && value.includes(':')) {
      decryptedConfig[key] = decryptString(value);
    } else if (typeof value === 'object' && value !== null) {
      decryptedConfig[key] = decryptConfigValues(value); // Recursive call
    } else {
      decryptedConfig[key] = value;
    }
  }
  return decryptedConfig;
}
