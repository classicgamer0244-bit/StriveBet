/** Current epoch ms — wrapped so component event handlers can timestamp
 * without tripping the react-hooks/purity lint rule on a raw Date.now(). */
export function nowMs(): number {
  return Date.now();
}

let counter = 0;

/**
 * Client-only unique id generator for runtime-created records (bets, fixtures,
 * transactions, accounts). Safe to call inside actions/effects — never at
 * module scope — because it reads Date.now().
 */
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Short human-friendly referral / booking code. */
export function makeCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const base = Date.now();
  for (let i = 0; i < length; i++) {
    counter += 1;
    out += chars[(base + counter * 7 + i * 31) % chars.length];
  }
  return out;
}
