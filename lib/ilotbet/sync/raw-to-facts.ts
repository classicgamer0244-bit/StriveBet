import type { IlotbetMatchRaw } from "../types";
import type { IlotbetFixtureFactsUpsert } from "../cache/write";
import { isTerminalStatus } from "../status";
import { ILOTBET_SPORT_IDS } from "../sports";

interface IlotbetPeriodScore {
  homeScore: number;
  awayScore: number;
  periodNumber: number;
  periodType?: string;
}

/** `periodScoresList` is a JSON-ENCODED array (own field, not nested JSON) —
 * period 1 is the first half. Returns undefined (never a guessed 0-0) on
 * anything malformed/missing, so a fixture facts row never gets its
 * halftime score overwritten with a wrong value — see write.ts's upsert:
 * `undefined` fields are left untouched by Prisma, unlike `null`, which is
 * exactly the behavior wanted here (ilotbet's /pre/matches can still touch
 * an already-finished fixture's facts well after the match ended, per
 * daily-matches.ts's own doc history, and its periodScoresList at that
 * point is unconfirmed — better to keep whatever was captured while the
 * match was actually live than risk clobbering it). */
function parseHalftimeScore(periodScoresList: string | undefined): { home: number; away: number } | undefined {
  if (!periodScoresList) return undefined;
  try {
    const periods = JSON.parse(periodScoresList) as IlotbetPeriodScore[];
    const firstHalf = periods.find((p) => p.periodNumber === 1);
    if (!firstHalf || typeof firstHalf.homeScore !== "number" || typeof firstHalf.awayScore !== "number") return undefined;
    return { home: firstHalf.homeScore, away: firstHalf.awayScore };
  } catch {
    return undefined;
  }
}

/**
 * Ice hockey regulation-time score (periods 1-3, no overtime/shootout), or
 * undefined unless periods 1-3 are KNOWN to be complete:
 *  - an overtime/shootout period has started (so regulation is over), or
 *  - the match is over and periods 1-3 add up exactly to the final score
 *    (so nothing was played beyond regulation).
 * Mid-third-period partial sums are never written, and an inconsistent final
 * score leaves it unset — the "Regular Time" legs then void rather than being
 * graded on a guess (see lib/settlement/resolve-leg.ts).
 */
function parseRegulationScore(raw: IlotbetMatchRaw): { home: number; away: number } | undefined {
  if (raw.sportId !== ILOTBET_SPORT_IDS["ice-hockey"] || !raw.periodScoresList) return undefined;
  let periods: IlotbetPeriodScore[];
  try {
    periods = JSON.parse(raw.periodScoresList) as IlotbetPeriodScore[];
  } catch {
    return undefined;
  }
  if (!Array.isArray(periods)) return undefined;
  const regular = [1, 2, 3].map((n) => periods.find((p) => p.periodNumber === n && (p.periodType ?? "RegularPeriod") === "RegularPeriod"));
  if (regular.some((p) => !p || typeof p.homeScore !== "number" || typeof p.awayScore !== "number")) return undefined;
  const home = regular.reduce((s, p) => s + p!.homeScore, 0);
  const away = regular.reduce((s, p) => s + p!.awayScore, 0);

  const extraTimeStarted = periods.some((p) => p.periodNumber > 3 || (p.periodType && p.periodType !== "RegularPeriod"));
  if (extraTimeStarted) return { home, away };
  if (isTerminalStatus(raw.eventStatus) && raw.homeScore === home && raw.awayScore === away) return { home, away };
  return undefined;
}

/** Shared by daily-matches.ts and live-matches.ts — both consume the exact
 * same IlotbetMatchRaw shape, so this stays one implementation rather than
 * two copies that can silently drift (unlike api-football's per-file
 * toFacts(), which was safe to duplicate only because each sync's raw shape
 * had already-different field sets by the time it existed). */
export function toFacts(raw: IlotbetMatchRaw): IlotbetFixtureFactsUpsert {
  // Football halves only — for other sports "period 1" is a quarter/set/
  // period, which no football half-time market should ever be graded on.
  const halftime = !raw.sportId || raw.sportId === ILOTBET_SPORT_IDS.football ? parseHalftimeScore(raw.periodScoresList) : undefined;
  const regulation = parseRegulationScore(raw);
  return {
    matchId: raw.matchId,
    numericId: raw.id,
    // Lowercased at the single write boundary so every stored value is already
    // normalized. The status helpers (mapEventStatus, isTerminalStatus…) all
    // lowercase before comparing, but the CACHE QUERIES don't — they match the
    // raw stored string against lowercase sets, so an upstream "LIVE" or
    // "Not_Started" would be invisible to getCachedLiveMatchIds() and friends,
    // silently disabling the dropped-fixture diff entirely. Normalizing here
    // rather than at read time keeps those queries able to use the
    // [eventStatus, scheduledTime] index (a case-insensitive `equals` compiles
    // to a regex, which cannot).
    eventStatus: raw.eventStatus.toLowerCase(),
    periodDesc: raw.periodDesc,
    takeUpTime: raw.takeUpTime,
    scheduledTime: new Date(raw.scheduledTime),
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    tournamentId: raw.tournamentId,
    tournamentName: raw.tournamentName,
    tournamentIcon: raw.tournamentIcon,
    homeName: raw.homeName,
    homeLogo: raw.homeLogo,
    awayName: raw.awayName,
    awayLogo: raw.awayLogo,
    homeScore: raw.homeScore,
    awayScore: raw.awayScore,
    halftimeHomeScore: halftime?.home,
    halftimeAwayScore: halftime?.away,
    sportId: raw.sportId || undefined,
    regulationHomeScore: regulation?.home,
    regulationAwayScore: regulation?.away,
  };
}

/** ilotbet can return the same match more than once within a response (same
 * caution as api-football's fixture sweeps) — de-duplicate before mapping. */
export function dedupeRawByMatchId(raw: IlotbetMatchRaw[]): IlotbetMatchRaw[] {
  const seen = new Set<string>();
  const out: IlotbetMatchRaw[] = [];
  for (const m of raw) {
    if (seen.has(m.matchId)) continue;
    seen.add(m.matchId);
    out.push(m);
  }
  return out;
}
