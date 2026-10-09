import { runIfDue } from "@/lib/sync/lock";
import { SETTLEMENT_JOBS } from "./jobs";
import { resolveOverdueFixtures } from "./resolve-fixtures";
import { processOverdueBets } from "./overdue";

/**
 * Runs settlement's own jobs if due. Mirrors lib/ilotbet/sync/scheduler.ts's
 * pumpIlotbetSyncs() exactly, and is wired into the same two places:
 *
 *   1. the my-bets SSE poll loop — covers any period with at least one
 *      logged-in session, which is most of the time; and
 *   2. /api/cron/settle-sweep — covers the period that caused this whole class
 *      of bug, namely overnight, when nobody is on the platform and the
 *      traffic-driven path simply never fires.
 *
 * Both are lock-guarded, so calling this on every 2-second SSE tick costs
 * essentially nothing: all but one caller per TTL window loses the
 * compare-and-set and returns immediately.
 *
 * `deadlineMs` is threaded all the way down rather than left to each job's own
 * budget. Both callers live inside a hard platform timeout (a Vercel function
 * is killed at 60s, and the SSE stream has its own soft limit), and these jobs
 * run in SEQUENCE — so their individual budgets add up and will blow past that
 * ceiling unless one shared deadline bounds the whole chain.
 */
export async function pumpSettlementJobs(options: { deadlineMs?: number } = {}): Promise<void> {
  await runIfDue(SETTLEMENT_JOBS.resolveFixtures, async () => void (await resolveOverdueFixtures(options)));

  // Skip rather than start something we can't finish — the overdue sweep walks
  // every open bet and settles in its own transactions, so entering it with no
  // time left just risks being killed mid-batch.
  if (options.deadlineMs !== undefined && Date.now() >= options.deadlineMs) return;

  await runIfDue(SETTLEMENT_JOBS.overdueBets, async () => void (await processOverdueBets(options)));
}
