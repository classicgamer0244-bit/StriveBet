import { getFixtureById } from "@/lib/fixtures";
import { marketDisplayName } from "@/lib/markets/market-label";
import { isSettleableMarket } from "@/lib/settlement/resolve-leg";
import { isAdminFixtureId } from "@/lib/fixture-id";
import { isRealFixtureId as isIlotbetFixtureId } from "@/lib/ilotbet/fixture-id";
import { getRealFeedHealth } from "@/lib/ilotbet/health";
import type { FixtureStatus } from "@/types";

/** How far past its own kickoff a real fixture may still read "upcoming" before
 * we treat the row as stale rather than merely early. Generous enough to absorb
 * a late kickoff and one missed sync cycle; far short of the hours or days a
 * genuinely abandoned row sits at. */
const STALE_UPCOMING_GRACE_MS = 15 * 60_000;

export interface SelectionRef {
  fixtureId: string;
  marketId: string;
  selectionId: string;
}

export interface ResolvedSelection {
  fixtureId: string;
  fixtureLabel: string;
  /** The short player-facing fixture reference shown elsewhere as "Game ID". */
  gameId: string;
  kickoffAt: string;
  marketId: string;
  marketName: string;
  marketLabel: string;
  selectionId: string;
  selectionLabel: string;
  odds: number;
  fixtureStatus: FixtureStatus;
}

/**
 * The server, never the client, is the source of truth for a selection's
 * label/odds — this re-resolves every {fixtureId, marketId, selectionId}
 * triple against the current fixture data (admin fixtures are frozen in
 * Mongo; real fixtures are deterministically rebuilt from the same seed
 * every time, see lib/api-football/fixtures.ts) rather than trusting
 * whatever the client last saw. Shared by bet placement and booking-slip
 * creation, which both need the identical integrity check.
 */
export async function resolveSelections(
  refs: SelectionRef[]
): Promise<{ resolved: ResolvedSelection[] } | { error: string }> {
  const uniqueFixtureIds = [...new Set(refs.map((r) => r.fixtureId))];
  const fixtures = await Promise.all(uniqueFixtureIds.map((id) => getFixtureById(id)));
  const fixturesById = new Map(uniqueFixtureIds.map((id, i) => [id, fixtures[i]]));

  // Checked ONCE per slip rather than per selection, and only when a real
  // fixture is actually involved — admin fixtures are settled from our own data
  // and are unaffected by an upstream outage.
  const health = uniqueFixtureIds.some(isIlotbetFixtureId) ? await getRealFeedHealth() : null;

  const resolved: ResolvedSelection[] = [];
  for (const ref of refs) {
    const fixture = fixturesById.get(ref.fixtureId);
    if (!fixture) return { error: "One of your selections is no longer available." };
    // Admin fixtures lock odds once the match goes live — no new bets accepted
    // during LIVE or HALFTIME. Real (ilotbet) fixtures remain open mid-match.
    if (isAdminFixtureId(ref.fixtureId) && (fixture.status === "live" || fixture.status === "halftime")) {
      return { error: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name} is already in progress — betting is closed.` };
    }
    const market = fixture.markets.find((m) => m.id === ref.marketId);
    const selection = market?.selections.find((s) => s.id === ref.selectionId);
    if (!market || !selection) return { error: "One of your selections is no longer available." };
    // /odds/live can suspend an individual selection mid-match (referee
    // stoppage, or the bookmaker pulling a price during an incident) — see
    // lib/api-football/live-odds.ts. Silently accepting a stake here would
    // book it at a price nobody upstream is actually honouring.
    if (selection.suspended) {
      return { error: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}: that selection is temporarily suspended.` };
    }
    // The guard that actually protects money. Withdrawing a market from
    // data/mock/market-builder.ts is not enough on its own: AdminFixture.markets
    // is frozen in Mongo at creation and IlotbetFixtureCache.markets is a cached
    // JSON blob, so previously-built fixtures keep offering the old market until
    // they're rebuilt. Every bet AND every booking slip funnels through here, so
    // this is the one place that can guarantee we never accept a stake on
    // something settlement cannot grade.
    if (!isSettleableMarket(market.name)) {
      return { error: `${marketDisplayName(market.name)} is no longer available for betting.` };
    }
    // Same principle as the market guard above, one level up: settlement can
    // only ever grade a real fixture from what the SERVER cached, and players
    // browse these straight from their own browser (lib/ilotbet/browser-fetch.ts).
    // So the listing staying visible proves nothing about our ability to settle,
    // and without this a server-side outage silently books stakes that can never
    // be graded — which is exactly how 126 bets and GHS 291k came to be stranded.
    if (health && !health.healthy && isIlotbetFixtureId(ref.fixtureId)) {
      return {
        error:
          "Live results are temporarily unavailable, so we can't accept bets on real matches " +
          "right now. Please try again shortly — simulated games are unaffected.",
      };
    }
    // A real fixture still reading "upcoming" well after its own kickoff is a
    // stale cache row, not a match about to start — the sync lost track of it.
    // Taking that bet means pricing a match that may already be decided, at
    // frozen odds, which is straightforwardly exploitable via a deep link or a
    // betslip restored from localStorage. Deliberately keyed on `upcoming` and
    // not on kickoff alone: a genuinely in-play fixture reads `live`, and
    // in-play betting on real matches is intended (see the admin-only guard
    // above), so this closes the hole without touching that.
    if (isIlotbetFixtureId(ref.fixtureId) && fixture.status === "upcoming") {
      const kickoff = new Date(fixture.kickoffAt).getTime();
      if (Number.isFinite(kickoff) && Date.now() - kickoff > STALE_UPCOMING_GRACE_MS) {
        return {
          error: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name} has already started — betting is closed.`,
        };
      }
    }

    resolved.push({
      fixtureId: fixture.id,
      fixtureLabel: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
      gameId: fixture.gameId,
      kickoffAt: fixture.kickoffAt,
      marketId: market.id,
      marketName: market.name,
      marketLabel: marketDisplayName(market.name),
      selectionId: selection.id,
      selectionLabel: selection.label,
      odds: selection.odds,
      fixtureStatus: fixture.status,
    });
  }

  return { resolved };
}
