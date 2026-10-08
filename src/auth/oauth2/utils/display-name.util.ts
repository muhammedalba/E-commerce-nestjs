// Mirrors the User schema's name length rules (4 to 30 characters).
const NAME_MIN_LENGTH = 4;
const NAME_MAX_LENGTH = 30;
// Apple's "Hide My Email" addresses: their local part is random characters.
const PRIVATE_RELAY_DOMAIN = '@privaterelay.appleid.com';

/**
 * A name the User schema accepts for an account created through social login.
 *
 * @description The provider's name can be too short ("Ali"), too long (a full
 * four-part name) or missing, and the schema rejects those, which would fail
 * the whole sign-in. Tries in order: the provider's name (cut to the maximum),
 * the email's local part (not for private relay addresses), then `fallback`.
 * The user can change it later in the profile.
 *
 * @param name - The name the provider gave, if any.
 * @param email - The account email.
 * @param fallback - Placeholder when nothing usable remains (e.g. 'Google User').
 */
export function oauthDisplayName(
  name: string | undefined,
  email: string,
  fallback: string,
): string {
  const candidates = [name];
  if (!email.toLowerCase().endsWith(PRIVATE_RELAY_DOMAIN)) {
    candidates.push(email.split('@')[0]);
  }
  for (const candidate of candidates) {
    const usable = candidate?.trim().slice(0, NAME_MAX_LENGTH).trim();
    if (usable && usable.length >= NAME_MIN_LENGTH) return usable;
  }
  return fallback;
}
