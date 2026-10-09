import { db } from "@/lib/db";
import { requirePlayerAccount } from "@/lib/auth/session";
import { toAccountKind } from "@/lib/accounts/balance";
import { serializeBet } from "@/lib/bets/serialize";
import { lookupBetFixtureStates } from "@/lib/bets/fixture-state";
import { pumpIlotbetSyncs } from "@/lib/ilotbet/sync/scheduler";
import { pumpApiFootballSyncs } from "@/lib/api-football/sync/scheduler";
import { runIfDue } from "@/lib/sync/lock";
import { PENDING_DEPOSIT_SWEEP_JOB } from "@/lib/deposits/sweep-job";
import { sweepPendingDeposits } from "@/lib/deposits/sweep";
import { pumpSettlementJobs } from "@/lib/settlement/scheduler";
import { fromMinor } from "@/lib/money";
import { POLL_INTERVAL_MS, SOFT_MAX_DURATION_MS, SSE_HEADERS, safeEnqueue, sleep, sseEvent } from "@/lib/realtime/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How long one poll tick may spend on settlement work before yielding back to
 * serving this player's own data. Small on purpose: the stream's job is the
 * bet list, and settlement is a side effect it happens to be a convenient
 * trigger for. The cron route does the heavy lifting with a far larger budget. */
const SETTLEMENT_SLICE_MS = 8_000;

/** Backed off to once a player has zero open bets and zero pending wins —
 * this stream is held open for every logged-in user on every page
 * (context/open-bets-context.tsx), so idling it down matters a lot more than
 * the live-fixtures list's idle backoff. Still pushes balance changes (e.g.
 * an admin credit, a completed withdrawal) within this interval; snaps back
 * to POLL_INTERVAL_MS the instant a bet is placed or a win is pending. */
const IDLE_POLL_INTERVAL_MS = 20_000;

/**
 * Single shared live feed for everything the "My Bets" UI needs: open bets,
 * their fixtures' live status/score/phase (for the LIVE badge, the
 * "63' H2 | 0:1" line, kickoff countdown, and cashout eligibility), and any
 * bets that just won or were cashed out and haven't been celebrated yet
 * (the win modal doubles as the cashout confirmation — same queue, same
 * `winNotifiedAt` acknowledgement flag, different copy per bet.status). One
 * connection here replaces what would otherwise be three separate polling
 * fetches (bottom nav badge, bet-history tab count, open bets list) — see
 * context/open-bets-context.tsx, the sole consumer. Same self-contained
 * poll-loop-per-connection shape as app/api/realtime/fixtures — no shared
 * in-memory bus, since target hosting is serverless.
 */
export async function GET(request: Request) {
  const account = await requirePlayerAccount();
  if (!account) return new Response("Unauthorized", { status: 401 });

  const accountId = account.id;
  const accountKind = toAccountKind(account.kind);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      request.signal.addEventListener("abort", () => {
        closed = true;
      });

      let lastSent: string | null = null;
      const startedAt = Date.now();

      while (!closed && Date.now() - startedAt < SOFT_MAX_DURATION_MS) {
        let nextDelay = POLL_INTERVAL_MS;
        try {
          // Lock-guarded (lib/sync/lock.ts) — bounded by each job's own TTL
          // platform-wide, not by this loop's cadence, so calling these
          // every 2s here costs nothing extra: almost every call is a no-op
          // "skipped" against a lease another call (or another instance)
          // already holds or a job that isn't due yet. This is what
          // replaced the old tickCount-based throttle, which was declared
          // inside this same start() callback and so reset on every ~55s
          // browser reconnect — with ~1000 concurrent streams that meant
          // "every 15th tick" never actually throttled anything.
          // Both run: ilotbet is the primary settlement trigger now, but a
          // handful of bets still reference legacy "af-…" fixtures (see
          // app/api/superadmin/api-football/status's `legacyOpenBets`) and
          // need the trimmed api-football tail to keep resolving until they
          // settle.
          await pumpIlotbetSyncs().catch((err) => console.error("ilotbet sync failed:", err));
          await pumpApiFootballSyncs().catch((err) => console.error("api-football legacy-tail sync failed:", err));
          // Backstop for gateway deposits stuck PENDING after the webhook is
          // lost and the deposit form's own poll gave up — see
          // lib/deposits/sweep.ts. Lock-guarded the same way as the syncs
          // above, so this call is a no-op almost every cycle.
          await runIfDue(PENDING_DEPOSIT_SWEEP_JOB, async () => void (await sweepPendingDeposits())).catch((err) =>
            console.error("pending deposit sweep failed:", err)
          );
          // Authoritative fixture resolution + the overdue policy. Same
          // lock-guarded, near-free-per-tick shape as the pumps above. This is
          // the primary trigger whenever anyone is using the platform;
          // /api/cron/settle-sweep covers the hours when nobody is.
          //
          // Tightly bounded here, unlike in the cron route: this runs inside a
          // player's live stream, so the one connection that wins the lock must
          // not stall their bet list behind a full settlement batch. Whatever it
          // doesn't finish is picked up by the next tick or by cron.
          await pumpSettlementJobs({ deadlineMs: Date.now() + SETTLEMENT_SLICE_MS }).catch((err) =>
            console.error("settlement jobs failed:", err)
          );

          const [openBets, celebratableBets, account] = await Promise.all([
            db.bet.findMany({ where: { accountId, accountKind, status: "OPEN" }, orderBy: { placedAt: "desc" } }),
            db.bet.findMany({
              where: {
                accountId,
                accountKind,
                status: { in: ["WON", "CASHED_OUT"] },
                // Two independent "absent or null" checks, so they're ANDed
                // explicitly rather than fighting over one `OR` key. Mongo
                // distinguishes "field absent" from "explicitly null", and
                // every pre-existing row has both fields absent.
                AND: [
                  { OR: [{ winNotifiedAt: null }, { winNotifiedAt: { isSet: false } }] },
                  // Don't celebrate a bet the player has cleared from their
                  // history — the row is kept for accounting, not for display.
                  { OR: [{ hiddenAt: null }, { hiddenAt: { isSet: false } }] },
                ],
              },
              orderBy: { settledAt: "desc" },
            }),
            // Balance rides along on this stream so a settlement that lands
            // while the player is just sitting on a page is reflected within a
            // tick. Previously nothing pushed it: refreshBalance() only fired
            // on mount or an explicit action, so a player watching their bet
            // settle saw it leave the open list while their balance stayed
            // stale — indistinguishable, from their side, from not being paid
            // at all. That is what most "my winnings never arrived" reports
            // actually were; the money was there.
            accountKind === "ADMIN"
              ? db.adminAccount.findUnique({ where: { id: accountId }, select: { balanceMinor: true } })
              : db.user.findUnique({ where: { id: accountId }, select: { balanceMinor: true } }),
          ]);

          const fixtureIds = [...new Set(openBets.flatMap((bet) => bet.legs.map((leg) => leg.fixtureId)))];
          const fixtureStates = await lookupBetFixtureStates(fixtureIds);

          const payload = {
            bets: openBets.map(serializeBet),
            fixtureStates: Object.fromEntries(fixtureStates),
            wins: celebratableBets.map(serializeBet),
            balance: account ? fromMinor(account.balanceMinor) : undefined,
          };
          const serialized = JSON.stringify(payload);
          if (serialized !== lastSent) {
            lastSent = serialized;
            if (!safeEnqueue(controller, encoder.encode(sseEvent(payload)))) closed = true;
          }
          // Nothing open and nothing to celebrate — back off instead of
          // re-running the full query set (plus the sync/settlement pumps
          // above) every 2s for a player who's just idly browsing.
          if (openBets.length === 0 && celebratableBets.length === 0) nextDelay = IDLE_POLL_INTERVAL_MS;
        } catch (err) {
          console.error("Realtime my-bets poll failed:", err);
        }
        if (closed) break;
        await sleep(nextDelay);
      }

      try {
        controller.close();
      } catch {
        // Already closed by the client aborting — nothing to do.
      }
    },
    cancel() {
      // Client disconnected — the abort listener above already flips `closed`.
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
