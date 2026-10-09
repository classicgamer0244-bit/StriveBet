/** Minimal shapes for the subset of api-football.com's v3 response fields
 * this app actually reads. Server-only — never import from a client component. */

export interface ApiFootballFixtureRaw {
  fixture: {
    id: number;
    date: string;
    /** Unix seconds — used to sort "upcoming" fixtures by soonest kickoff. */
    timestamp: number;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; logo?: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
}

export interface ApiFootballFixturesResponse {
  response: ApiFootballFixtureRaw[];
}

export interface ApiFootballOddValue {
  value: string;
  odd: string;
}

export interface ApiFootballBet {
  id: number;
  name: string;
  values: ApiFootballOddValue[];
}

export interface ApiFootballBookmaker {
  id: number;
  name: string;
  bets: ApiFootballBet[];
}

export interface ApiFootballOddsRaw {
  fixture: { id: number };
  bookmakers: ApiFootballBookmaker[];
}

export interface ApiFootballOddsResponse {
  response: ApiFootballOddsRaw[];
}

export interface ApiFootballLeagueRaw {
  league: { id: number; name: string; type: string; logo?: string };
  country: { name: string; code: string | null; flag: string | null };
}

export interface ApiFootballLeaguesResponse {
  response: ApiFootballLeagueRaw[];
}

/** /odds/live — the in-play odds endpoint. Structurally different from
 * pre-match /odds: an Over/Under line's number arrives in its own
 * `handicap` field rather than baked into `value`, and each value carries
 * its own `suspended` flag rather than only a fixture-level one. This
 * couldn't be verified against a live response in this environment (no API
 * key available) — same caveat as ApiFootballBet above, worth a sanity
 * check against a real payload the first time this runs for real. */
export interface ApiFootballLiveOddValue {
  value: string;
  odd: string;
  handicap: string | null;
  main?: boolean;
  suspended?: boolean;
}

export interface ApiFootballLiveBet {
  id: number;
  name: string;
  values: ApiFootballLiveOddValue[];
}

export interface ApiFootballLiveOddsEntry {
  fixture: { id: number };
  status?: {
    /** Referee has halted play — prices should be treated as unavailable. */
    stopped?: boolean;
    /** Bookmaker has temporarily suspended betting on this fixture. */
    blocked?: boolean;
    finished?: boolean;
  };
  odds: ApiFootballLiveBet[];
}

export interface ApiFootballLiveOddsResponse {
  response: ApiFootballLiveOddsEntry[];
  paging?: { current: number; total: number };
}

/** /odds/bookmakers — the plain {id, name} catalog (not the nested
 * bookmaker-with-bets shape /odds embeds), used to resolve a preferred
 * bookmaker id by name once (lib/api-football/sync/odds-config.ts). */
export interface ApiFootballBookmakerRaw {
  id: number;
  name: string;
}

export interface ApiFootballBookmakersResponse {
  response: ApiFootballBookmakerRaw[];
}

/** /odds/bets and /odds/live/bets — the {id, name} bet-name catalogs for
 * pre-match and live odds respectively (two DISJOINT id/name spaces — a
 * live bet id is not valid on the pre-match endpoint and vice versa, per
 * the docs). Fetched purely as a diagnostic: lets the mappers' hardcoded
 * candidate names be checked against what this account's plan actually
 * returns instead of trusting docs that may not exactly match. */
export interface ApiFootballBetNameRaw {
  id: number;
  name: string;
}

export interface ApiFootballBetNamesResponse {
  response: ApiFootballBetNameRaw[];
}
