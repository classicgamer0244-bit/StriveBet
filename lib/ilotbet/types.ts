/** Minimal shapes for the subset of ilotbet.com's internal frontend API
 * fields this app actually reads. Type-only, so safe to import from both
 * server (lib/ilotbet/sync/*, the backend cache jobs) and client code
 * (lib/ilotbet/browser-fetch.ts, the direct-from-the-browser path) — types
 * are erased at compile time, nothing runtime-y leaks either way. Confirmed
 * empirically (direct fetches during planning), not from any published
 * documentation — this is an unauthenticated internal API with no
 * versioning guarantee, so treat these as "true as of 2026-07-30," not a
 * contract. */

export interface IlotbetOddRaw {
  id: string;
  /** Absent (not 0/null) when a suspended ("active": 0) outcome hasn't been
   * priced since — confirmed on a real "under 4.5" row. Never assume present. */
  odds?: number;
  name: string;
  /** 1 = active, 0 = suspended. */
  active?: number;
  hname?: string;
  outcomeAbbr?: string;
  sid?: string;
}

export interface IlotbetMarketRaw {
  eventId: string;
  groupType: string;
  nameAlias?: string;
  name: string;
  viewType: string;
  id: string;
  specifiersAlias?: string;
  /** JSON-encoded object, e.g. `"{\"total\":\"2.5\"}"` — needs its own
   * JSON.parse(), see parseSpecifiers() in ./mapper. */
  specifiers: string;
  marketType: number;
  /** The stable cross-match market identifier — mapper keys on this, not on
   * `name` (which varies per match/team) or `hname` (sometimes absent even
   * within the same market type — confirmed on a real "Handicap(1X2)" row). */
  marketId: number;
  status: boolean;
  odds: IlotbetOddRaw[];
}

export interface IlotbetMatchRaw {
  /** Globally unique join key — used verbatim as our fixture id (see
   * ./fixture-id.ts). */
  matchId: string;
  /** A separate, shorter numeric id ilotbet also returns per match — used
   * only for the player-facing "Game ID" display. */
  id: number;
  sportId: string;
  sportName: string;
  name: string;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  /** Absent (not 0) on a not_started match — confirmed empirically. Default
   * to 0 when mapping, never assume presence. */
  homeScore?: number;
  awayScore?: number;
  categoryId?: string;
  categoryName: string;
  tournamentId?: string;
  tournamentName: string;
  tournamentIcon?: string;
  /** ISO 8601 with a numeric offset, e.g. "2026-07-30T16:00:00+0000". */
  scheduledTime: string;
  /** Raw status string — only "not_started"/"live" confirmed empirically.
   * See ./status.ts for the full (partly inferred) mapping. */
  eventStatus: string;
  /** NOT a reliable "is this in play" signal — a confirmed not_started match
   * still had `live: true`. Use `eventStatus` instead. */
  live?: boolean;
  /** Seconds elapsed since kickoff — inferred (not confirmed) to NOT reset
   * at halftime. See ./status.ts's formatMinute(). */
  takeUpTime?: number;
  periodDesc?: string;
  /** JSON-encoded array — needs its own JSON.parse(); not currently read
   * (per-period scores aren't part of the Fixture shape this app renders),
   * kept typed here for when that changes. */
  periodScoresList?: string;
  markets: IlotbetMarketRaw[];
  hot?: boolean;
}

/** GET /api/sbu/un/m/live/matches — `data` is a single per-sport group
 * directly (only one sport is ever queried, so this is a flat shape). */
export interface IlotbetLiveMatchesResponse {
  code: number;
  msg: string;
  r: boolean;
  data: {
    sportId: string;
    name: string;
    sportName: string;
    matchCount: number;
    matchList: IlotbetMatchRaw[];
  };
}

/** GET /api/sbu/un/m/pre/matches — genuinely different shape from
 * /live/matches, confirmed empirically (not from the docs/paste, which
 * never showed it): `data` is a PAGE of per-sport groups (`list`), each
 * holding its own `matchList` — since only one sportId is ever queried,
 * `list` has at most one entry in practice, but the type reflects the real
 * envelope. No `matchCount` total anywhere in this response (unlike
 * /live/matches) — confirmed via direct pagination probing that a page
 * shorter than `pageSize` means "no more pages," not a total to compare
 * against. */
export interface IlotbetDailyMatchesResponse {
  code: number;
  msg: string;
  r: boolean;
  data: {
    pageNum: number;
    pageSize: number;
    list: Array<{
      sportId: string;
      name: string;
      sportName: string;
      matchList: IlotbetMatchRaw[];
    }>;
  };
}

/** GET /api/sbu/un/m/match?id={matchId}&easy=false — a single match, no
 * matchList wrapper, with a far richer market set (confirmed up to 81
 * markets vs 25 in list responses). */
export interface IlotbetMatchDetailResponse {
  code: number;
  msg: string;
  r: boolean;
  data: IlotbetMatchRaw;
}
