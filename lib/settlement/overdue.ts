import { db } from "@/lib/db";
import { isAdminFixtureId } from "@/lib/fixture-id";
import { settleOneBet } from "./settle-one-bet";
import { lookupFixtureInfo } from "./fixture-lookup";
import type { Bet } from "@prisma/client";

/**
 * # Overdue-bet policy
 *
 * The last line of defence, for the case the authoritative resolver
 * (./resolve-fixtures.ts) genuinely cannot answer: a third-party fixture that
 * ilotbet has purged, or that it keeps reporting in a state we can't grade. A
 * bet must never be able to sit OPEN forever with a player's money in it.
 *
 *   - **3 hours** past the last leg's kickoff → flag for superadmin review.
 *     No money moves. This is purely "a human should look at this".
 *   - **24 hours** → void and refund the stake, but only after the resolver has
 *     genuinely tried and failed (MIN_ATTEMPTS_BEFORE_VOID). Voiding a fixture
 *     nobody ever asked upstream about would be guessing, not policy.
 *
 * ## Admin fixtures are explicitly excluded from auto-voiding
 *
 * We own admin-created fixtures completely — their scores and scheduled events
 * are our own data — so "we don't know the result" is impossible for them by
 * construction. An overdue admin fixture means the tick stopped running, not
 * that the result is unknowable, and the correct repair is to force-complete it
 * (which resolve-fixtures.ts does) — never to refund a game we could simply
 * have graded. They are still eligible for the 3h review flag, so a stuck one
 * stays visible.
 */

const FLAG_AFTER_MS = 3 * 60 * 60_000;
const AUTO_VOID_AFTER_MS = 24 * 60 * 60_000;

/** The resolver must have actually tried, and failed, this many times before a
 * bet is voided on the assumption its fixture is unknowable. */
const MIN_ATTEMPTS_BEFORE_VOID = 3;

export interface OverdueResult {
  flagged: number;
  autoVoided: number;
  autoVoidRefundedMinor: number;
  skippedAdmin: number;
  skippedNotAttempted: number;
}

/** Latest kickoff across a bet's legs — the bet can't be judged overdue until
 * its LAST match should have finished. `placedAt` is the fallback when legs
 * carry no kickoff (older legs): always present, and late enough to be safe. */
function latestKickoff(bet: { placedAt: Date; legs: Array<{ kickoffAt: Date | null }> }): Date {
  let latest = bet.placedAt;
  for (const leg of bet.legs) {
    if (leg.kickoffAt && leg.kickoffAt > latest) latest = leg.kickoffAt;
  }
  return latest;
}

export async function processOverdueBets(options: { deadlineMs?: number } = {}): Promise<OverdueResult> {
  const result: OverdueResult = {
    flagged: 0,
    autoVoided: 0,
    autoVoidRefundedMinor: 0,
    skippedAdmin: 0,
    skippedNotAttempted: 0,
  };

  const openBets = await db.bet.findMany({ where: { status: "OPEN" } });
  if (openBets.length === 0) return result;

  const now = Date.now();
  const overdue = openBets.filter((b) => now - latestKickoff(b).getTime() >= FLAG_AFTER_MS);
  if (overdue.length === 0) return result;

  // --- 3h: flag for review (no money moves) --------------------------------
  const toFlag = overdue.filter((b) => b.reviewFlaggedAt === null);
  if (toFlag.length > 0) {
    const { count } = await db.bet.updateMany({
      where: {
        id: { in: toFlag.map((b) => b.id) },
        status: "OPEN",
        // Mongo distinguishes "field absent" from "explicitly null", and a bet
        // that has never been flagged has no field at all — so a bare
        // `reviewFlaggedAt: null` matched NOTHING and this flag had never fired
        // once in the platform's history. It read correctly in JS above (Prisma
        // returns null for an absent optional on read), which is exactly why it
        // looked fine. Same quirk, same fix, as lib/ilotbet/client.ts's
        // nextRequestAt guard.
        OR: [{ reviewFlaggedAt: null }, { reviewFlaggedAt: { isSet: false } }],
      },
      data: { reviewFlaggedAt: new Date(), reviewReason: "fixture_unresolved" },
    });
    result.flagged = count;
  }

  // --- 24h: void + refund ---------------------------------------------------
  const voidCandidates = overdue.filter((b) => now - latestKickoff(b).getTime() >= AUTO_VOID_AFTER_MS);
  if (voidCandidates.length === 0) return result;

  const candidateFixtureIds = [...new Set(voidCandidates.flatMap((b) => b.legs.map((l) => l.fixtureId)))];
  const states = await db.fixtureSettlementState.findMany({
    where: { fixtureId: { in: candidateFixtureIds } },
    select: { fixtureId: true, resolveAttempts: true },
  });
  const attemptsById = new Map(states.map((s) => [s.fixtureId, s.resolveAttempts]));

  // Phones for the refund's ledger row — same bulk prefetch settlement uses.
  const userIds = [...new Set(voidCandidates.filter((b) => b.accountKind === "USER").map((b) => b.accountId))];
  const adminIds = [...new Set(voidCandidates.filter((b) => b.accountKind === "ADMIN").map((b) => b.accountId))];
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

  const known = await lookupFixtureInfo(candidateFixtureIds);

  for (const bet of voidCandidates) {
    // Auto-voiding moves money, one transaction per bet. Stopping cleanly when
    // the caller's deadline passes is safe — every remaining bet is picked up
    // on the next run, and a bet that is 24h overdue is not 30 seconds urgent.
    if (options.deadlineMs !== undefined && Date.now() >= options.deadlineMs) break;

    const unresolvedLegs = bet.legs.filter((leg) => {
      const info = known.get(leg.fixtureId);
      if (!info) return true;
      if (info.status === "cancelled") return false;
      return !(info.status === "finished" && info.score);
    });
    if (unresolvedLegs.length === 0) continue; // resolvable — normal settlement will take it

    // We own admin fixtures outright; an unresolved one is a stalled tick, not
    // an unknowable result. resolve-fixtures.ts force-completes those.
    if (unresolvedLegs.some((leg) => isAdminFixtureId(leg.fixtureId))) {
      result.skippedAdmin += 1;
      continue;
    }

    // Never refund a fixture the resolver hasn't genuinely tried to resolve.
    const attempted = unresolvedLegs.every((leg) => (attemptsById.get(leg.fixtureId) ?? 0) >= MIN_ATTEMPTS_BEFORE_VOID);
    if (!attempted) {
      result.skippedNotAttempted += 1;
      continue;
    }

    // Routed through the SAME transactional path as normal settlement, so this
    // and a late authoritative resolution can race safely: the bet's status CAS
    // and the unique `void_<id>` ledger reference mean whichever lands first
    // wins, exactly once.
    const outcome = await settleOneBet({
      bet,
      settlement: { status: "VOID", payoutMinor: Number(bet.stakeMinor), legResults: bet.legs.map(() => "void" as const) },
      updatedLegs: bet.legs.map((leg) => ({ ...leg, result: "void" })) as Bet["legs"],
      phone: phoneByAccountId.get(bet.accountId) ?? "",
      settlementSource: "auto_void_overdue",
    });

    if (outcome === "settled") {
      result.autoVoided += 1;
      result.autoVoidRefundedMinor += Number(bet.stakeMinor);
      await db.fixtureSettlementState
        .updateMany({
          where: { fixtureId: { in: unresolvedLegs.map((l) => l.fixtureId) } },
          data: { autoVoidedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  if (result.autoVoided > 0) {
    console.warn(
      `overdue sweep auto-voided ${result.autoVoided} bet(s), refunding ${result.autoVoidRefundedMinor} minor units`
    );
  }
  return result;
}
