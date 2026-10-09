/**
 * Normalises a phone number to a canonical form for storage and lookup.
 * Ghana numbers are stored without the leading trunk prefix "0":
 *   "0545143333" -> "545143333"
 *   "545143333"  -> "545143333"  (already canonical)
 *
 * This means a user who registers with "0545143333" can log in with
 * "545143333" and vice versa — both resolve to the same DB row.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith("0") ? trimmed.slice(1) : trimmed;
}

/**
 * Returns all plausible variants of a phone number so a single DB query
 * can match any form the user might have registered with.
 *   "0545143333" -> ["0545143333", "545143333"]
 *   "545143333"  -> ["545143333",  "0545143333"]
 */
export function phoneVariants(phone: string): string[] {
  const raw = phone.trim();
  const withoutZero = raw.startsWith("0") ? raw.slice(1) : raw;
  const withZero = raw.startsWith("0") ? raw : `0${raw}`;
  return [withoutZero, withZero];
}
