import { db } from "@/lib/db";
import { settleBetIfReady } from "./settle-bet";
import { lookupFixtureInfo } from "./fixture-lookup";
import { settleOneBet } from "./settle-one-bet";
import { generateUniqueVerificationCode } from "@/lib/bets/verification-code";
import type { Bet } from "@prisma/client";

/**
 * How many ACCOUNTS settle in parallel. Deliberately low, and lowered from 10
 * when settlement moved onto interactive transactions: an interactive
 * transaction holds a connection for its whole lifetime, and Prisma's MongoDB
 * pool defaults to roughly `cpus * 2 + 1` — about 5 on a serverless function.
 * Running more concurrent transactions than the pool can seat makes the excess
 * block on `maxWait` and fail with P2028, turning a capacity problem into
 * spurious settlement failures.
 */
const SETTLE_CONCURRENCY = 4;

/**
 * Wall-clock ceiling for one batch. Settlement runs inside jobs with finite
 * leases (SYNC_JOBS.liveMatches, SIM_TICK_JOB) and inside HTTP requests with a
 * hard platform timeout; overrunning either used to abort mid-batch with no
 * error at all. Stopping cleanly and reporting `remaining` lets the next cycle
 * pick up where this one stopped.
 */
const SETTLE_BUDGET_MS = 30_000;

export interface SettleBatchResult {
  settled: number;
  failed: number;
  /** Bets that were ready but the batch ran out of time for. */
  remaining: number;
}

export interface SettleOptions {
  /** Absolute wall-clock deadline (Date.now() ms). The batch stops cleanly at
   * whichever is sooner, this or its own SETTLE_BUDGET_MS. Callers that live
   * inside a hard platform timeout — a Vercel function is killed at 60s — must
   * pass one, because several bounded steps run in sequence and their budgets
   * are not additive within one request. */
  deadlineMs?: number;
}

/**
 * Given a set of fixture ids that just reached a terminal state, settles every
 * OPEN bet touching any of them that is actually ready (a multi-leg bet waits
 * for every one of its legs) and credits REAL-mode payouts. Shared by the
 * admin-fixture tick (lib/simulation/tick.ts), the ilotbet live sync, the
 * authoritative resolver (lib/settlement/resolve-fixtures.ts) and the admin
 * force-settle/cancel routes — every fixture source funnels through here.
 *
 * Each bet is settled by settleOneBet(), which is a single all-or-nothing
 * transaction; see that file for the atomicity and idempotency argument. This
 * function's own job is the three things that must happen AROUND it:
 *
 *   - **Per-bet isolation.** One bet failing must never abort the rest of the
 *     batch. Combined with the fixture-id guards in lookupFixtureInfo(), a
 *     single bad bet or leg can no longer stop the whole platform settling.
 *   - **Grouping by account.** Every bet belonging to one account writes that
 *     account's balance document. Settling them concurrently guarantees
 *     write-conflict churn (P2034) against each other, so one account's bets
 *     go sequentially while different accounts go in parallel.
 *   - **Bounded runtime.** See SETTLE_BUDGET_MS.
 */
export async function settleBetsForFixtures(
  fixtureIds: string[],
  options: SettleOptions = {}
): Promise<SettleBatchResult> {
  if (fixtureIds.length === 0) return { settled: 0, failed: 0, remaining: 0 };

  const bets = await db.bet.findMany({
    where: { status: "OPEN", legs: { some: { fixtureId: { in: fixtureIds } } } },
  });
  if (bets.length === 0) return { settled: 0, failed: 0, remaining: 0 };

  // Every leg of every matched bet, not just the passed ids — readiness is
  // all-or-nothing across a bet's legs.
  const allLegFixtureIds = bets.flatMap((bet) => bet.legs.map((leg) => leg.fixtureId));
  const fixturesById = await lookupFixtureInfo(allLegFixtureIds);

  // Bulk-prefetched once for the whole batch: Transaction.phone is required and
  // Bet doesn't carry one, and looking it up per bet inside the transaction
  // would hold a pool connection open for an avoidable round trip.
  const userIds = [...new Set(bets.filter((b) => b.accountKind === "USER").map((b) => b.accountId))];
  const adminIds = [...new Set(bets.filter((b) => b.accountKind === "ADMIN").map((b) => b.accountId))];
  const [users, admins] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, phone: true } }) : [],
    adminIds.length
      ? db.adminAccount.findMany({ where: { id: { in: adminIds } }, select: { id: true, phone: true } })
      : [],
  ]);
  const phoneByAccountId = new Map<string, string>([
    ...users.map((u): [string, string] => [u.id, u.phone]),
    ...admins.map((a): [string, string] => [a.id, a.phone]),
  ]);

  let settled = 0;
  let failed = 0;
  let skipped = 0;

  async function settleOne(bet: Bet): Promise<void> {
    const settlement = settleBetIfReady(
      { status: bet.status, stakeMinor: Number(bet.stakeMinor), legs: bet.legs },
      fixturesById
    );
    if (!settlement) return; // not ready — every leg must be terminal first

    // Freeze the scores onto the legs. The halftime score matters as much as
    // the final one: IlotbetFixtureCache is pruned and only OPEN bets protect
    // a row, so once this bet settles its halftime evidence is gone unless it
    // is copied here — and without it a mis-graded half-market leg could never
    // be re-graded.
    // `?? null`, not `?? undefined`: the whole legs array is replaced wholesale,
    // so every field is written explicitly — an omitted key would leave the
    // field absent rather than recording "we had no score here".
    const updatedLegs: Bet["legs"] = bet.legs.map((leg, i) => {
      const info = fixturesById.get(leg.fixtureId);
      return {
        ...leg,
        result: settlement.legResults[i],
        finalScoreHome: info?.score?.home ?? null,
        finalScoreAway: info?.score?.away ?? null,
        halftimeScoreHome: info?.halftimeScore?.home ?? null,
        halftimeScoreAway: info?.halftimeScore?.away ?? null,
      };
    });

    // Generated outside the transaction on purpose — it runs several sequential
    // uniqueness probes of its own, which would keep a pool connection tied up
    // for far longer than the three writes inside actually need.
    const verificationCode = settlement.status === "WON" ? await generateUniqueVerificationCode() : undefined;

    const outcome = await settleOneBet({
      bet,
      settlement,
      updatedLegs,
      verificationCode,
      phone: phoneByAccountId.get(bet.accountId) ?? "",
    });

    if (outcome === "settled") settled += 1;
    else if (outcome === "failed") failed += 1;

    if (outcome === "settled" && settlement.status === "WON" && bet.accountKind === "USER") {
      // Cosmetic ("has this player ever won?") and idempotent — deliberately
      // outside the money transaction so it can never be the reason a payout
      // rolls back.
      await db.user
        .updateMany({ where: { id: bet.accountId, hasWonBet: false }, data: { hasWonBet: true } })
        .catch((err) => console.error(`failed to set hasWonBet for ${bet.accountId}:`, err));
    }
  }

  const byAccount = new Map<string, Bet[]>();
  for (const bet of bets) {
    const key = `${bet.accountKind}:${bet.accountId}`;
    const group = byAccount.get(key);
    if (group) group.push(bet);
    else byAccount.set(key, [bet]);
  }

  const groups = [...byAccount.values()];
  const deadline = Math.min(Date.now() + SETTLE_BUDGET_MS, options.deadlineMs ?? Number.POSITIVE_INFINITY);

  for (let i = 0; i < groups.length; i += SETTLE_CONCURRENCY) {
    if (Date.now() >= deadline) {
      skipped += groups.slice(i).reduce((n, g) => n + g.length, 0);
      break;
    }
    await Promise.all(
      groups.slice(i, i + SETTLE_CONCURRENCY).map(async (group) => {
        for (const bet of group) {
          if (Date.now() >= deadline) {
            skipped += 1;
            continue;
          }
          await settleOne(bet);
        }
      })
    );
  }

  if (skipped > 0) {
    console.warn(`settlement batch ran out of time with ${skipped} bet(s) unprocessed — they settle next cycle`);
  }
  return { settled, failed, remaining: skipped };
}

/**
 * Backstop for any bet that slipped through its fixture's own settlement
 * trigger: re-derives fixture ids from every currently-OPEN bet (admin,
 * ilotbet and legacy alike — lookupFixtureInfo resolves all three) and runs
 * them back through settleBetsForFixtures(). Safe to call as often as
 * convenient: a bet whose fixtures aren't all terminal yet is simply skipped.
 *
 * Note what this can and cannot fix. It re-ASKS whether each bet is ready; it
 * cannot make a fixture reach a result. A fixture stuck without a final score
 * will be re-examined by this sweep forever and never settle — resolving that
 * is lib/settlement/resolve-fixtures.ts's job, which is why the two run
 * together.
 */
export async function sweepOrphanedOpenBets(options: SettleOptions = {}): Promise<SettleBatchResult> {
  const openBets = await db.bet.findMany({
    where: { status: "OPEN" },
    select: { legs: { select: { fixtureId: true } } },
  });
  const fixtureIds = [...new Set(openBets.flatMap((b) => b.legs.map((l) => l.fixtureId)))];
  return settleBetsForFixtures(fixtureIds, options);
}
