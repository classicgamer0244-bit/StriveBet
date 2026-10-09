/**
 * One-off recovery: settle real-fixture bets stranded by the ilotbet outage.
 *
 * ## What happened
 *
 * ilotbet began returning HTTP 403 to the production deployment — an egress-IP
 * block, not an auth or header problem: the identical bare request still returns
 * 200 from a developer machine. IlotbetFixtureCache froze, every real fixture
 * stayed at `not_started` with no score, and settleBetIfReady() quite correctly
 * refused to grade any of them. 126 bets across 94 players, GHS 291k of stake,
 * sat OPEN — the oldest 17 days past its last kickoff. Admin-simulated fixtures
 * were unaffected throughout, because they are settled entirely from local data.
 *
 * Three layered backstops all failed to catch it, each for its own reason (the
 * 3h review flag never matched, the 24h auto-void was deadlocked by its own
 * attempt precondition, and the resolver's ilotbet branch was skipped wholesale
 * during backoff). Those are fixed separately; this script is about the money
 * already stuck.
 *
 * ## Why this can work at all
 *
 * ilotbet has NOT purged the data. Probing the 12 oldest stranded fixtures
 * (17+ days) returned `closed`/`ended` with final scores for all 12. So these
 * bets can be graded for real — winners paid what they actually won — rather
 * than voided and refunded, which is what the overdue sweep would eventually do
 * and which hands losing tickets their stake back.
 *
 * ## Two deliberate choices
 *
 * **It fetches ilotbet directly, not through lib/ilotbet/client.ts.** That
 * client calls assertNotInBackoff() against the SHARED production
 * IlotbetSyncState — currently pinned in a permanent backoff by the 403s — so
 * every call would throw instantly. Going direct also avoids competing with the
 * production cron for the single global pacing slot. The same ~1.1s spacing is
 * kept regardless.
 *
 * **It settles through settleBetsForFixtures(), not a bespoke path.** Money
 * moves only in lib/settlement/settle-one-bet.ts, whose CAS on `status: "OPEN"`
 * and unique `win_<betId>` / `void_<betId>` ledger references are what make this
 * safe to re-run and safe to race against the live cron. A second copy of that
 * logic here would be a second place for it to be wrong.
 *
 * Run it from a machine ilotbet still serves — that is the whole point.
 *
 * Usage:  npx tsx scripts/backfill-real-fixtures.mts               (dry run)
 *         npx tsx scripts/backfill-real-fixtures.mts --limit 10    (probe a few)
 *         npx tsx scripts/backfill-real-fixtures.mts --apply       (moves real money)
 */
import { db } from "@/lib/db";
import { toFacts } from "@/lib/ilotbet/sync/raw-to-facts";
import { upsertFixtureFacts } from "@/lib/ilotbet/cache/write";
import { mapEventStatus } from "@/lib/ilotbet/status";
import { isRealFixtureId } from "@/lib/ilotbet/fixture-id";
import { lookupFixtureInfo } from "@/lib/settlement/fixture-lookup";
import { settleBetIfReady, type SettlementFixtureInfo } from "@/lib/settlement/settle-bet";
import { settleBetsForFixtures } from "@/lib/settlement/settle-bets-for-fixtures";
import type { IlotbetMatchDetailResponse, IlotbetMatchRaw } from "@/lib/ilotbet/types";

const BASE_URL = "https://www.ilotbet.com";
/** Matches lib/ilotbet/client.ts's REQUEST_SPACING_MS. We are bypassing that
 *  client's pacing gate, not its courtesy. */
const REQUEST_SPACING_MS = 1_100;
const REQUEST_TIMEOUT_MS = 20_000;

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const ghs = (minor: number) =>
  `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchMatchDetail(matchId: string): Promise<IlotbetMatchRaw | null> {
  const url = new URL(`${BASE_URL}/api/sbu/un/m/match`);
  const params: Record<string, string> = {
    platform: "3",
    platformModel: "1.0",
    id: matchId,
    easy: "false",
    timestamp: String(Date.now()),
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as IlotbetMatchDetailResponse;
  if (body.code !== 0) throw new Error(`code ${body.code} (${body.msg})`);
  const raw = body.data;
  // Same identity check syncMatchDetail() makes — ilotbet can answer with a
  // different match than the one asked for, and grading on that would be worse
  // than not grading at all.
  if (!raw || raw.matchId !== matchId) return null;
  return raw;
}

/** Mirrors getRealFixtureStates()'s mapping exactly, so the preview cannot
 *  drift from what settlement will actually see once the facts are written. */
function toSettlementInfo(raw: IlotbetMatchRaw): SettlementFixtureInfo {
  const f = toFacts(raw);
  return {
    status: mapEventStatus(f.eventStatus),
    score:
      f.homeScore !== null && f.homeScore !== undefined && f.awayScore !== null && f.awayScore !== undefined
        ? { home: f.homeScore, away: f.awayScore }
        : undefined,
    halftimeScore:
      f.halftimeHomeScore !== null &&
      f.halftimeHomeScore !== undefined &&
      f.halftimeAwayScore !== null &&
      f.halftimeAwayScore !== undefined
        ? { home: f.halftimeHomeScore, away: f.halftimeAwayScore }
        : undefined,
  };
}

async function main() {
  console.log(
    APPLY
      ? "=== APPLY MODE — this settles bets and moves real money ===\n"
      : "=== DRY RUN — nothing is written; re-run with --apply to settle ===\n"
  );

  const openBets = await db.bet.findMany({ where: { status: "OPEN" }, orderBy: { placedAt: "asc" } });
  if (openBets.length === 0) {
    console.log("No OPEN bets. Nothing to do.");
    return;
  }

  const allLegIds = [...new Set(openBets.flatMap((b) => b.legs.map((l) => l.fixtureId)))];
  const realIds = allLegIds.filter(isRealFixtureId);

  console.log(`OPEN bets                : ${openBets.length}`);
  console.log(`distinct fixtures on them: ${allLegIds.length}  (real: ${realIds.length})`);

  const targets = realIds.slice(0, LIMIT);
  if (targets.length < realIds.length) {
    console.log(`--limit ${LIMIT} → fetching ${targets.length} of ${realIds.length}`);
  }
  console.log(`\nfetching ${targets.length} fixture(s) from ilotbet at ~${REQUEST_SPACING_MS}ms spacing…\n`);

  const fetched = new Map<string, IlotbetMatchRaw>();
  let notFound = 0;
  let failed = 0;

  for (const [i, id] of targets.entries()) {
    try {
      const raw = await fetchMatchDetail(id);
      if (!raw) {
        notFound += 1;
        console.log(`  [${i + 1}/${targets.length}] ${id.padEnd(22)} NOT FOUND upstream`);
      } else {
        fetched.set(id, raw);
        const info = toSettlementInfo(raw);
        const score = info.score ? `${info.score.home}-${info.score.away}` : "—";
        console.log(
          `  [${i + 1}/${targets.length}] ${id.padEnd(22)} ${String(raw.eventStatus).padEnd(12)} ` +
            `→ ${info.status.padEnd(9)} score=${score}`
        );
      }
    } catch (err) {
      failed += 1;
      console.log(`  [${i + 1}/${targets.length}] ${id.padEnd(22)} ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
    if (i < targets.length - 1) await sleep(REQUEST_SPACING_MS);
  }

  console.log(`\nfetched ${fetched.size} | not found ${notFound} | errors ${failed}`);

  // Preview against the REAL settlement rule: start from what the router
  // currently resolves (admin fixtures, legacy ids, whatever is already
  // cached), then overlay only what we just fetched.
  const current = await lookupFixtureInfo(allLegIds);
  const preview = new Map(current);
  for (const [id, raw] of fetched) preview.set(id, toSettlementInfo(raw));

  const outcomes = { WON: 0, LOST: 0, VOID: 0 };
  let payoutMinor = 0;
  let stillOpen = 0;
  const blocking = new Map<string, number>();

  for (const bet of openBets) {
    const result = settleBetIfReady(
      { status: "OPEN", stakeMinor: Number(bet.stakeMinor), legs: bet.legs },
      preview
    );
    if (!result) {
      stillOpen += 1;
      for (const leg of bet.legs) {
        const info = preview.get(leg.fixtureId);
        const resolved = info && (info.status === "cancelled" || (info.status === "finished" && info.score));
        if (!resolved) blocking.set(leg.fixtureId, (blocking.get(leg.fixtureId) ?? 0) + 1);
      }
      continue;
    }
    outcomes[result.status] += 1;
    payoutMinor += result.payoutMinor;
  }

  console.log("\n--- projected settlement -------------------------------------");
  console.log(`  WON  : ${String(outcomes.WON).padStart(4)}`);
  console.log(`  LOST : ${String(outcomes.LOST).padStart(4)}`);
  console.log(`  VOID : ${String(outcomes.VOID).padStart(4)}   (stake refunded)`);
  console.log(`  still OPEN afterwards: ${stillOpen}`);
  console.log(`\n  TOTAL TO PAY OUT: ${ghs(payoutMinor)}`);

  if (blocking.size > 0) {
    const top = [...blocking.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`\n  ${blocking.size} fixture(s) still unresolvable. Most-blocking:`);
    for (const [id, n] of top) {
      const info = preview.get(id);
      console.log(`    ${id.padEnd(22)} blocks ${String(n).padStart(3)} bet(s)  status=${info?.status ?? "(unknown)"}`);
    }
    console.log("    → left OPEN here; the overdue sweep voids and refunds what stays unknowable.");
  }

  if (!APPLY) {
    console.log("\n(dry run — read the payout total above, then re-run with --apply)");
    return;
  }

  if (fetched.size === 0) {
    console.log("\nNothing fetched, so there is nothing new to settle. Stopping.");
    return;
  }

  console.log("\napplying — writing fixture facts…");
  await upsertFixtureFacts(
    [...fetched.values()].map(toFacts),
    // "detail" is truthful: this is the single-match detail endpoint, the same
    // source syncMatchDetail() uses. The field is diagnostics only.
    "detail"
  );
  console.log(`  wrote ${fetched.size} fixture fact row(s)`);

  console.log("settling…");
  const settled = await settleBetsForFixtures([...fetched.keys()]);
  console.log(`\nDONE — settled ${settled.settled} bet(s).`);

  const remaining = await db.bet.count({ where: { status: "OPEN" } });
  console.log(`OPEN bets remaining: ${remaining}`);
  console.log(
    "\nRe-run with --apply to confirm idempotency: it should settle 0 more " +
      "(settle-one-bet's CAS on status OPEN short-circuits an already-settled bet)."
  );
}

await main();
await db.$disconnect();
