import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * DB-backed single-flight lock. Same intent as the admin-simulation tick's
 * module-level `lastTickAt` throttle (lib/simulation/tick.ts), but held in
 * Mongo so it holds ACROSS serverless instances — a module variable only
 * throttles the one instance that happens to own it, which with N instances
 * means N concurrent refreshes at every staleness boundary instead of one.
 *
 * Domain-agnostic and shared across every sync source in the app — the
 * admin-simulation tick, the legacy (settlement-only) api-football jobs, and
 * the new ilotbet jobs all import from here, each with their own SyncJob
 * key/TTL table (lib/api-football/sync/jobs.ts, lib/ilotbet/sync/jobs.ts).
 */
export interface SyncJob {
  /** Stable lock key, e.g. "af:fixtures:live" or "ilotbet:matches:live". */
  key: string;
  /** How stale the data may get before a refresh is ALLOWED. */
  ttlMs: number;
  /** How long a winner may hold the lease before it's presumed crashed. Must
   * exceed the job's realistic worst-case duration. */
  leaseMs: number;
  /** Extra delay added before a retry after a thrown run, so a failing
   * upstream gets a breather instead of a hot loop. */
  errorBackoffMs?: number;
}

export type RunOutcome = "ran" | "skipped" | "failed";

/** A job's run() can throw this to mean "this attempt didn't complete, but
 * it's an expected, self-resolving condition — not a sign anything is
 * actually broken" (e.g. lib/ilotbet/client.ts's reserveIlotbetSlot() losing
 * an internal pacing race against another of our own calls). runIfDue logs
 * it quietly and skips the errorBackoffMs penalty, instead of treating it
 * exactly like a genuine upstream failure — a real failure (HTTP error,
 * upstream backoff) should still use a plain throw so it stays loud and
 * pays the normal backoff. */
export class ExpectedRetry extends Error {}

/** P2034: MongoDB reports a WriteConflict when two of our own processes'
 * compare-and-set `updateMany` calls land on the exact same SyncLock
 * document at the same instant — routine under real traffic (this job runs
 * once per active SSE connection's poll tick, and every connection races the
 * same lock document), not a sign anything is broken. Prisma doesn't retry
 * this automatically on MongoDB, so left unhandled it crashes runIfDue
 * entirely — treating it as "lost the race" (same as count === 0) is the
 * correct read, not a real failure. */
function isWriteConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
}

/** Module scope, NOT per-connection — the exact mistake the old my-bets SSE
 * route made with its `tickCount` variable, which was declared inside the
 * stream's start() callback and so reset on every ~55-second browser
 * reconnect, meaning "every 15th tick" never actually throttled anything
 * with ~1000 concurrent streams. Living here, this survives reconnects and
 * is shared by every stream/request on this instance, bounding how often we
 * even ATTEMPT the lock (not just how often we win it) to once per
 * MIN_ATTEMPT_INTERVAL_MS per job key. */
const lastAttemptAt = new Map<string, number>();
const MIN_ATTEMPT_INTERVAL_MS = 5_000;

/** Idempotent — the create races harmlessly against a concurrent bootstrap
 * (P2002 on the unique `key` just means someone else got there first).
 * `lastRunAt: epoch 0` makes the very first compare-and-set always win. */
async function ensureLock(key: string): Promise<void> {
  try {
    await db.syncLock.create({ data: { key, lastRunAt: new Date(0) } });
  } catch (err) {
    const isDuplicateKey = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (!isDuplicateKey) throw err;
  }
}

/**
 * Runs `run()` if — and only if — this process wins the compare-and-set
 * against every other process racing the same job key. One atomic
 * `updateMany` IS the whole protocol: it asserts "the data is stale" AND
 * "nobody currently holds the lease" AND takes the lease, in a single round
 * trip. MongoDB re-evaluates the predicate on a write-conflict retry, which
 * is what makes this a true compare-and-set rather than a read-then-write
 * with a window in the middle for two instances to both "win".
 */
export async function runIfDue(job: SyncJob, run: () => Promise<void>): Promise<RunOutcome> {
  const now = Date.now();
  const lastAttempt = lastAttemptAt.get(job.key) ?? 0;
  if (now - lastAttempt < MIN_ATTEMPT_INTERVAL_MS) return "skipped";
  lastAttemptAt.set(job.key, now);

  await ensureLock(job.key);

  const nowDate = new Date(now);
  const staleBefore = new Date(now - job.ttlMs);

  let count: number;
  try {
    ({ count } = await db.syncLock.updateMany({
      where: {
        key: job.key,
        lastRunAt: { lt: staleBefore },
        // Mongo distinguishes "field absent" from "explicitly null" — both
        // mean unheld here (same quirk lib/bets/serialize.ts already handles
        // for Bet.winNotifiedAt).
        OR: [{ leaseUntil: null }, { leaseUntil: { isSet: false } }, { leaseUntil: { lt: nowDate } }],
      },
      data: { leaseUntil: new Date(now + job.leaseMs) },
    }));
  } catch (err) {
    if (isWriteConflict(err)) return "skipped";
    throw err;
  }
  if (count === 0) return "skipped";

  const startedAt = Date.now();
  try {
    await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isExpectedRetry = err instanceof ExpectedRetry;
    // Re-arm lastRunAt to now - ttlMs + backoff, so the NEXT attempt is
    // delayed by `backoff` rather than immediately eligible again (which
    // would otherwise hot-loop against a genuinely-down upstream). An
    // ExpectedRetry gets a short, capped delay instead of the job's full
    // errorBackoffMs — it isn't evidence of trouble, just "try again very
    // soon" (see the class doc comment).
    const backoff = isExpectedRetry ? Math.min(job.errorBackoffMs ?? job.ttlMs, 2_000) : (job.errorBackoffMs ?? job.ttlMs);
    try {
      await db.syncLock.updateMany({
        where: { key: job.key },
        data: {
          lastRunAt: new Date(now - job.ttlMs + backoff),
          leaseUntil: null,
          lastDurationMs: Date.now() - startedAt,
          lastError: message.slice(0, 500),
        },
      });
    } catch (bookkeepingErr) {
      if (!isWriteConflict(bookkeepingErr)) throw bookkeepingErr;
    }
    if (isExpectedRetry) {
      console.warn(`sync job "${job.key}" skipped this cycle (${message})`);
    } else {
      console.error(`sync job "${job.key}" failed:`, err);
    }
    return "failed";
  }

  // A write conflict here just means this bookkeeping write (runCount,
  // lastRunAt) lost to a concurrent one — run() itself already succeeded, so
  // this must NOT be reported as a job failure the way the catch block above
  // does; the next scheduled run corrects the bookkeeping either way.
  try {
    await db.syncLock.updateMany({
      where: { key: job.key },
      data: {
        lastRunAt: new Date(),
        leaseUntil: null,
        runCount: { increment: 1 },
        lastDurationMs: Date.now() - startedAt,
        lastError: null,
      },
    });
  } catch (err) {
    if (!isWriteConflict(err)) throw err;
  }
  return "ran";
}

/** True once the data is old enough that serving the cache would be
 * actively misleading (cold start, or a long idle) — the one case a read
 * path should AWAIT a refresh instead of backgrounding it. */
export async function isHardStale(key: string, hardTtlMs: number): Promise<boolean> {
  const lock = await db.syncLock.findUnique({ where: { key } });
  if (!lock) return true;
  return Date.now() - lock.lastRunAt.getTime() > hardTtlMs;
}
