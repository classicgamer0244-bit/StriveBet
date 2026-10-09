import type { SportSlug } from "./sport";
import type { Team } from "./team";
import type { Market } from "./market";

export type FixtureStatus = "upcoming" | "live" | "halftime" | "finished" | "cancelled";

export interface FixtureScore {
  home: number;
  away: number;
}

/** Wall-clock anchors an admin-simulated fixture's minute display is derived
 * from — lets the client recompute the current minute every second on its
 * own, with no extra network traffic, and without ever "resetting" on a page
 * reload (it's always a pure function of these fixed timestamps + now). Only
 * ever set for admin-origin fixtures; absent for real (api-football) ones. */
export interface FixturePhase {
  simKickoffTs: number;
  compression: number;
  secondHalfKickoffTs?: number;
  stoppageMinutes?: number;
  firstHalfStoppageMinutes?: number;
}

export interface Fixture {
  id: string;
  gameId: string;
  sportSlug: SportSlug;
  leagueId: string;
  leagueName: string;
  /** Only present for real (api-football) fixtures. */
  leagueLogo?: string;
  kickoffAt: string;
  status: FixtureStatus;
  homeTeam: Team;
  awayTeam: Team;
  score?: FixtureScore;
  minute?: string;
  period?: string;
  markets: Market[];
  isHighlight?: boolean;
  phase?: FixturePhase;
}
