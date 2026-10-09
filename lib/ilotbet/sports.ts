import type { SportSlug } from "@/types";

/**
 * Our sport slugs <-> ilotbet's Sportradar sport ids. Client-safe (no server
 * imports) — shared by the backend sync jobs and lib/ilotbet/browser-fetch.ts.
 */
export const ILOTBET_SPORT_IDS: Record<SportSlug, string> = {
  football: "sr:sport:1",
  basketball: "sr:sport:2",
  tennis: "sr:sport:5",
  cricket: "sr:sport:21",
  baseball: "sr:sport:3",
  "ice-hockey": "sr:sport:4",
  handball: "sr:sport:6",
  "american-football": "sr:sport:16",
};

export const FOOTBALL_SPORT_ID = ILOTBET_SPORT_IDS.football;

const SLUG_BY_ID = new Map(Object.entries(ILOTBET_SPORT_IDS).map(([slug, id]) => [id, slug as SportSlug]));

/** A missing id means a row cached before multi-sport support — all football. */
export function sportSlugFromIlotbetId(sportId: string | null | undefined): SportSlug {
  return (sportId && SLUG_BY_ID.get(sportId)) || "football";
}

/**
 * Sports the SERVER caches and settles besides football. A sport belongs here
 * only once lib/ilotbet/sport-markets.ts maps markets for it that
 * lib/settlement/resolve-leg.ts can grade — otherwise there is nothing to bet
 * on and caching it would only spend ilotbet request budget. Cricket and
 * handball are deliberately absent: cricket results can be decided by
 * rain-rule (DLS) or super over, which a bare score comparison cannot grade
 * safely, and handball currently has no markets mapped. Both are still listed
 * for browsing straight from the browser.
 */
export const SERVER_SYNCED_OTHER_SPORTS: SportSlug[] = ["basketball", "tennis", "ice-hockey", "baseball", "american-football"];

/** Every sport listed to players (browser fetch), betting-enabled or not. */
export const BROWSABLE_SPORTS: SportSlug[] = [
  "football",
  "basketball",
  "tennis",
  "cricket",
  "baseball",
  "ice-hockey",
  "handball",
  "american-football",
];

/**
 * How long after kickoff a match is presumed over, for the authoritative
 * result resolver (lib/settlement/resolve-fixtures.ts). Asking before this
 * finds the match still in play and burns one of its limited attempts, so
 * these are deliberately generous per sport.
 */
export const COMPLETE_AFTER_MS: Record<SportSlug, number> = {
  football: 110 * 60_000,
  basketball: 160 * 60_000,
  "ice-hockey": 180 * 60_000,
  handball: 110 * 60_000,
  baseball: 240 * 60_000,
  "american-football": 240 * 60_000,
  tennis: 300 * 60_000,
  cricket: 480 * 60_000,
};
