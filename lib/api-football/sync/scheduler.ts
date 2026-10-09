import { runIfDue, isHardStale } from "@/lib/sync/lock";
import { SYNC_JOBS, HARD_TTL_MS } from "./jobs";
import { syncLiveFixtures } from "./live-fixtures";
import { syncBetFixtures } from "./bet-fixtures";

/**
 * Settlement-only now — trimmed as part of the ilotbet cutover. There is no
 * "listings" scope any more (ilotbet fully replaces api-football for
 * browsing/odds); this only ever runs under the settlement path, alongside
 * ilotbet's own settlement watch (lib/ilotbet/sync/scheduler.ts) as two
 * independent, prefix-dispatched paths — see lib/settlement/fixture-lookup.ts.
 * Keep this running until app/api/superadmin/api-football/status's
 * `legacyOpenBets` reads 0, at which point what's left of this integration
 * can be deleted by hand.
 */
async function anyHardStale(): Promise<boolean> {
  const keys: Array<keyof typeof HARD_TTL_MS> = ["liveFixtures", "betFixtures"];
  const results = await Promise.all(keys.map((k) => isHardStale(SYNC_JOBS[k].key, HARD_TTL_MS[k])));
  return results.some(Boolean);
}

async function runJobs(): Promise<void> {
  await runIfDue(SYNC_JOBS.liveFixtures, async () => void (await syncLiveFixtures()));
  await runIfDue(SYNC_JOBS.betFixtures, async () => void (await syncBetFixtures()));
  await runIfDue(SYNC_JOBS.settlementBackstop, async () => void (await syncBetFixtures()));
}

/** Non-blocking except past a job's HARD ttl (cold start, or the app has
 * been idle a long time) — see lib/ilotbet/sync/scheduler.ts's twin for the
 * full rationale, identical here. */
export async function ensureApiFootballFresh(): Promise<void> {
  if (await anyHardStale()) {
    await runJobs();
    return;
  }
  void runJobs().catch((err) => console.error("api-football background sync (legacy settlement) failed:", err));
}

/** Always-awaited form — for the SSE poll loops and the cron routes. */
export async function pumpApiFootballSyncs(): Promise<void> {
  await runJobs();
}
