import { db } from "@/lib/db";

const UPSERT_CONCURRENCY = 25;

async function runChunked<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export interface ApiFixtureFactsUpsert {
  apiFixtureId: number;
  statusShort: string;
  statusLong?: string;
  elapsed: number | null;
  kickoffAt: Date;
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  leagueCountry?: string;
  homeTeamId: number;
  homeTeamName: string;
  homeTeamLogo?: string;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamLogo?: string;
  goalsHome: number | null;
  goalsAway: number | null;
}

/**
 * Upserts fixture FACTS only — settlement-tail only (see the module doc
 * comment in ./read.ts): the odds/markets fields the schema still carries
 * are dead weight left over from before the ilotbet cutover and are never
 * written by this trimmed sync path any more.
 *
 * Plain chunked upsert()s rather than a single $runCommandRaw bulk write —
 * Prisma has no heterogeneous bulk upsert, and this runs off the request
 * path (inside a lock-guarded sync job), so the extra round trips cost
 * latency nobody's blocked on.
 */
export async function upsertFixtureFacts(rows: ApiFixtureFactsUpsert[], fetchedBy: string): Promise<void> {
  if (rows.length === 0) return;
  const fetchedAt = new Date();
  await runChunked(rows, UPSERT_CONCURRENCY, (r) =>
    db.apiFixtureCache.upsert({
      where: { apiFixtureId: r.apiFixtureId },
      create: { ...r, fetchedAt, fetchedBy },
      update: { ...r, fetchedAt, fetchedBy },
    })
  );
}
