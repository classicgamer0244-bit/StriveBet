import { isTerminalStatus } from "./status";
import { rawIlotbetMatchToFixture } from "./browser-map";
import type { IlotbetLiveMatchesResponse, IlotbetDailyMatchesResponse, IlotbetMatchDetailResponse, IlotbetMatchRaw } from "./types";
import { BROWSABLE_SPORTS, ILOTBET_SPORT_IDS } from "./sports";
import type { Fixture, SportSlug } from "@/types";

/**
 * Direct-from-the-browser ilotbet fetches — no MaxBet backend involved at
 * all. ilotbet's endpoints are public, unauthenticated, CORS-open
 * (access-control-allow-origin: *, confirmed directly) and already cache on
 * their own side, so this deliberately skips the pacing/backoff machinery
 * lib/ilotbet/client.ts uses for the backend sync jobs — those jobs still
 * exist and still run (needed for settlement and for the very first
 * server-rendered paint), this is a separate, simpler path purely for
 * keeping what's ALREADY on screen fresh without a manual reload.
 */

const ILOTBET_BASE_URL = "https://www.ilotbet.com";
const CLIENT_PARAMS = { platform: "3", platformModel: "1.0" } as const;

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`${ILOTBET_BASE_URL}${path}`);
  const all = { ...CLIENT_PARAMS, ...params, timestamp: Date.now() };
  for (const [key, value] of Object.entries(all)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function dedupeByMatchId(raw: IlotbetMatchRaw[]): IlotbetMatchRaw[] {
  const seen = new Set<string>();
  const out: IlotbetMatchRaw[] = [];
  for (const m of raw) {
    if (seen.has(m.matchId)) continue;
    seen.add(m.matchId);
    out.push(m);
  }
  return out;
}

/** No sport = every browsable sport, fetched in parallel. A sport whose
 * request fails is simply missing from this poll (the next one retries) —
 * except when they ALL fail, which is surfaced as an error like before so
 * callers keep their last good list instead of blanking it. */
async function acrossSports(sportSlug: SportSlug | undefined, fetchOne: (sport: SportSlug) => Promise<Fixture[]>): Promise<Fixture[]> {
  if (sportSlug) return fetchOne(sportSlug);
  const results = await Promise.allSettled(BROWSABLE_SPORTS.map(fetchOne));
  const ok = results.filter((r): r is PromiseFulfilledResult<Fixture[]> => r.status === "fulfilled");
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
  return ok.flatMap((r) => r.value);
}

export async function fetchIlotbetLiveFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  return acrossSports(sportSlug, fetchLiveForSport);
}

async function fetchLiveForSport(sportSlug: SportSlug): Promise<Fixture[]> {
  const res = await fetch(buildUrl("/api/sbu/un/m/live/matches", { sportId: ILOTBET_SPORT_IDS[sportSlug] }), { cache: "no-store" });
  if (!res.ok) throw new Error(`ilotbet live fetch failed: ${res.status}`);
  const body = (await res.json()) as IlotbetLiveMatchesResponse;
  if (body.code !== 0) throw new Error(`ilotbet live fetch error: code ${body.code} (${body.msg})`);

  // ilotbet's /live/matches occasionally still lists a match for one more
  // response after it's actually ended (eventStatus already flipped
  // terminal) before dropping it entirely — the date-range /pre/matches
  // fetch below already guards the equivalent case, this closes the same
  // gap here.
  const raw = dedupeByMatchId(body.data?.matchList ?? []).filter((m) => !isTerminalStatus(m.eventStatus));
  return raw.map(rawIlotbetMatchToFixture);
}

function formatBoundary(date: Date): string {
  // ilotbet expects "+00:00", not the "Z" Date#toISOString() produces.
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

const DAYS_AHEAD = 1;
const PAGE_SIZE = 100;
/** Football keeps its two pages; other sports list far fewer matches. */
const MAX_PAGES: Partial<Record<SportSlug, number>> = { football: 2 };

export async function fetchIlotbetUpcomingFixtures(sportSlug?: SportSlug): Promise<Fixture[]> {
  return acrossSports(sportSlug, fetchUpcomingForSport);
}

async function fetchUpcomingForSport(sportSlug: SportSlug): Promise<Fixture[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + DAYS_AHEAD);
  end.setUTCHours(23, 59, 59, 0);
  const st = formatBoundary(today);
  const et = formatBoundary(end);

  const all: IlotbetMatchRaw[] = [];
  const maxPages = MAX_PAGES[sportSlug] ?? 1;
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const res = await fetch(
      buildUrl("/api/sbu/un/m/pre/matches", { sportId: ILOTBET_SPORT_IDS[sportSlug], st, et, pageNum, pageSize: PAGE_SIZE }),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`ilotbet upcoming fetch failed: ${res.status}`);
    const body = (await res.json()) as IlotbetDailyMatchesResponse;
    if (body.code !== 0) throw new Error(`ilotbet upcoming fetch error: code ${body.code} (${body.msg})`);

    const matches = body.data?.list?.[0]?.matchList ?? [];
    all.push(...matches);
    if (matches.length < PAGE_SIZE) break;
  }

  const now = Date.now();
  const raw = dedupeByMatchId(all).filter(
    (m) => m.eventStatus === "not_started" && new Date(m.scheduledTime).getTime() > now
  );

  return raw.map(rawIlotbetMatchToFixture);
}

export async function fetchIlotbetMatchDetail(matchId: string): Promise<Fixture | undefined> {
  const res = await fetch(buildUrl("/api/sbu/un/m/match", { id: matchId, easy: "false" }), { cache: "no-store" });
  if (!res.ok) throw new Error(`ilotbet detail fetch failed: ${res.status}`);
  const body = (await res.json()) as IlotbetMatchDetailResponse;
  if (body.code !== 0) throw new Error(`ilotbet detail fetch error: code ${body.code} (${body.msg})`);
  if (!body.data) return undefined;
  return rawIlotbetMatchToFixture(body.data);
}
