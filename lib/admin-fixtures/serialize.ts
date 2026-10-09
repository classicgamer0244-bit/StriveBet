import type { AdminFixture as PrismaAdminFixture } from "@prisma/client";
import type { AdminFixture, MarketTabKey, SportSlug } from "@/types";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
}

function shortName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "TBA";
}

const STATUS_MAP = {
  UPCOMING: "upcoming",
  LIVE: "live",
  HALFTIME: "halftime",
  FINISHED: "finished",
  CANCELLED: "cancelled",
} as const;

/** Full admin-facing shape (unlike lib/fixtures.ts's player-facing serializer,
 * this keeps ownerAdminId/simKickoffTs/compression/scheduledEvents — the
 * fields only the operator dashboards need). */
export function serializeAdminFixtureFull(f: PrismaAdminFixture): AdminFixture {
  return {
    id: f.id,
    gameId: f.id.slice(-8),
    sportSlug: f.sportSlug as SportSlug,
    leagueId: slugify(f.leagueName),
    leagueName: f.leagueName,
    kickoffAt: f.kickoffAt.toISOString(),
    status: STATUS_MAP[f.status],
    homeTeam: {
      id: slugify(f.homeTeamName),
      name: f.homeTeamName,
      shortName: shortName(f.homeTeamName),
      logoUrl: f.homeTeamLogoUrl ?? undefined,
    },
    awayTeam: {
      id: slugify(f.awayTeamName),
      name: f.awayTeamName,
      shortName: shortName(f.awayTeamName),
      logoUrl: f.awayTeamLogoUrl ?? undefined,
    },
    score: f.scoreHome !== null && f.scoreAway !== null ? { home: f.scoreHome, away: f.scoreAway } : undefined,
    minute: f.minute ?? undefined,
    markets: f.markets.map((m) => ({
      id: m.id,
      name: m.name,
      tab: m.tab as MarketTabKey,
      info: m.info ?? undefined,
      selections: m.selections.map((s) => ({ id: s.id, label: s.label, odds: s.odds })),
    })),
    origin: "admin",
    ownerAdminId: f.ownerAdminId,
    simKickoffTs: Number(f.simKickoffTs),
    compression: f.compression,
    phase: {
      simKickoffTs: Number(f.simKickoffTs),
      compression: f.compression,
      secondHalfKickoffTs: f.secondHalfKickoffTs !== null ? Number(f.secondHalfKickoffTs) : undefined,
      stoppageMinutes: f.stoppageMinutes ?? undefined,
      firstHalfStoppageMinutes: f.firstHalfStoppageMinutes ?? undefined,
    },
    scheduledEvents: f.scheduledEvents.map((e) => ({
      id: e.id,
      atMinute: e.atMinute,
      team: e.team as "home" | "away",
      deltaGoals: e.deltaGoals,
      applied: e.applied,
    })),
  };
}
