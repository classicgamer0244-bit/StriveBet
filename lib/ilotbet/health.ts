import { db } from "@/lib/db";
import { sportWhere } from "./cache/read";

/**
 * Is the real-fixture RESULTS feed healthy enough to accept bets?
 *
 * ## Why this exists
 *
 * Listings and settlement come from different places. Players browse real
 * fixtures via lib/ilotbet/browser-fetch.ts — straight from their own browser to
 * ilotbet, no StriveBet server involved — while settlement can only ever grade what
 * the SERVER managed to cache in IlotbetFixtureCache. So when the server loses
 * upstream access the site keeps looking perfectly healthy and keeps taking real
 * bets, and every one of them is ungradeable the moment it's placed.
 *
 * That is not hypothetical: it ran for 17 days, stranding 126 bets and GHS 291k
 * of player money, and the backlog grew the entire time because nothing stopped
 * new bets arriving. This is the guard that stops it.
 *
 * ## Why staleness, not just errors
 *
 * `consecutiveErrors` is the faster signal but not the authoritative one — the
 * question settlement actually needs answered is "if a match ends right now, can
 * we find out?", and only fresh data answers that. A sync could also be silently
 * writing nothing without recording an error. Cache age is the ground truth;
 * the error count just gets us there sooner.
 */

/** The daily sync (10min TTL) rewrites `fetchedAt` on every fixture in its date
 * range regardless of whether anything is live, so a healthy cache is never more
 * than ~10 minutes old. Double that, so an ordinary slow cycle or a single
 * skipped run doesn't trip the breaker. */
const STALE_AFTER_MS = 20 * 60_000;

/** One or two failures is a blip the backoff already handles. This many in a row
 * is an outage, and waiting out STALE_AFTER_MS before reacting would just let
 * more ungradeable bets through. */
const MAX_CONSECUTIVE_ERRORS = 5;

/** Bet placement is hot and this answer moves slowly, so it's memoised rather
 * than costing two queries per selection. Short enough that recovery is picked
 * up almost immediately. */
const CACHE_TTL_MS = 15_000;

export interface RealFeedHealth {
  healthy: boolean;
  /** Player-safe explanation. Present only when unhealthy. */
  reason?: string;
  /** Diagnostics for the superadmin panel and logs. */
  staleForMs: number | null;
  consecutiveErrors: number;
}

let cached: { at: number; value: RealFeedHealth } | null = null;

async function read(): Promise<RealFeedHealth> {
  const [newest, state] = await Promise.all([
    // Football only, as before multi-sport support: the other sports run on
    // their own jobs, and their fresh rows must not mask a stalled football
    // feed — football is the one sport that always has fixtures to measure.
    db.ilotbetFixtureCache.aggregate({ where: sportWhere("football"), _max: { fetchedAt: true } }),
    db.ilotbetSyncState.findUnique({ where: { key: "default" } }),
  ]);

  const fetchedAt = newest._max.fetchedAt;
  const staleForMs = fetchedAt ? Date.now() - fetchedAt.getTime() : null;
  const consecutiveErrors = state?.consecutiveErrors ?? 0;

  // No rows at all is not "fresh" — it's a cache that has never been populated,
  // which is exactly as ungradeable as a stale one.
  if (staleForMs === null) {
    return { healthy: false, reason: "no fixture data", staleForMs, consecutiveErrors };
  }
  if (staleForMs >= STALE_AFTER_MS) {
    return {
      healthy: false,
      reason: `results feed last updated ${Math.round(staleForMs / 60_000)} minutes ago`,
      staleForMs,
      consecutiveErrors,
    };
  }
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    return {
      healthy: false,
      reason: `results feed failing (${consecutiveErrors} consecutive errors)`,
      staleForMs,
      consecutiveErrors,
    };
  }

  return { healthy: true, staleForMs, consecutiveErrors };
}

export async function getRealFeedHealth(): Promise<RealFeedHealth> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let value: RealFeedHealth;
  try {
    value = await read();
  } catch (err) {
    // Fail CLOSED. Refusing a bet costs a player one retry; accepting one we
    // can't grade costs them their stake and us a support case. And this reads
    // the same database the bet write itself needs, so an error here means
    // placement was going to fail anyway — nothing real is lost by stopping.
    console.error("[feed-health] Could not read real-feed health:", err);
    value = {
      healthy: false,
      reason: "results feed status unavailable",
      staleForMs: null,
      consecutiveErrors: 0,
    };
  }

  cached = { at: Date.now(), value };
  return value;
}

/** Drops the memo so a caller that just repaired the feed sees it immediately —
 *  the backfill script uses this after writing fresh fixture facts. */
export function invalidateRealFeedHealth(): void {
  cached = null;
}
