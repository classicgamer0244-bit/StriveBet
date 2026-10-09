import { ilotbetGet } from "../client";
import { upsertFixtureFacts, upsertDetailMarkets } from "../cache/write";
import { buildIlotbetMarkets } from "../sport-markets";
import { sportSlugFromIlotbetId } from "../sports";
import { toFacts } from "./raw-to-facts";
import type { IlotbetMatchDetailResponse } from "../types";

/**
 * On-demand, per-fixture — called only when lib/ilotbet/fixtures.ts's
 * getRealFixtureById() decides a fixture's detail markets are stale (see
 * DETAIL_MARKETS_TTL_MS/_LIVE_MS in ../constants), i.e. proportional to how
 * often a fixture is actually opened, not a fixed poll. Refreshes both facts
 * AND the far richer ~80-market set in one call — the single-match endpoint
 * carries both, unlike api-football's split facts/odds endpoints.
 *
 * Any sport can come through here (a player opening a basketball match, or
 * the result resolver checking one), so markets are built for the match's own
 * sport — see ../sport-markets.ts.
 */
export async function syncMatchDetail(matchId: string): Promise<{ found: boolean }> {
  const res = await ilotbetGet<IlotbetMatchDetailResponse>("/api/sbu/un/m/match", { id: matchId, easy: "false" });
  const raw = res.data;
  if (!raw || raw.matchId !== matchId) return { found: false };

  await upsertFixtureFacts([toFacts(raw)], "detail");

  if (raw.markets.length > 0) {
    const markets = buildIlotbetMarkets(matchId, sportSlugFromIlotbetId(raw.sportId), raw.markets);
    await upsertDetailMarkets(matchId, markets);
  }

  return { found: true };
}
