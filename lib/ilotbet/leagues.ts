import { ensureIlotbetFresh } from "./sync/scheduler";
import { getCachedLeagueCounts } from "./cache/read";
import { sportSlugFromIlotbetId } from "./sports";
import type { League } from "@/types";

/**
 * No curated league allowlist — the sidebar simply lists whichever
 * tournaments currently have live or upcoming fixtures, straight from the
 * cache via a groupBy. No ilotbet calls here at all.
 *
 * Each league carries its sport (lib/ilotbet/cache/read.ts looks it up per
 * tournament), so the sports page can list only the selected sport's leagues.
 * Merged by id defensively, in case a tournament ever comes back twice.
 */
export async function getRealLeagues(): Promise<League[]> {
  await ensureIlotbetFresh();
  const groups = await getCachedLeagueCounts();
  const byId = new Map<string, League>();
  for (const g of groups) {
    const existing = byId.get(g.tournamentId);
    if (existing) {
      existing.fixtureCount += g.count;
      if (g.sportId) existing.sportSlug = sportSlugFromIlotbetId(g.sportId);
      continue;
    }
    byId.set(g.tournamentId, {
      id: g.tournamentId,
      sportSlug: sportSlugFromIlotbetId(g.sportId),
      name: g.tournamentName,
      fixtureCount: g.count,
      logoUrl: g.tournamentIcon ?? undefined,
    });
  }
  return [...byId.values()];
}
