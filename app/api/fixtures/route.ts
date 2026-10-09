import { NextResponse } from "next/server";
import { getFixturesByLeague, getLiveFixtures, getUpcomingFixtures } from "@/lib/fixtures";
import { SPORT_SLUGS, type SportSlug } from "@/types";

function parseSport(value: string | null): SportSlug | undefined {
  return value && (SPORT_SLUGS as readonly string[]).includes(value) ? (value as SportSlug) : undefined;
}

/** Client-facing counterpart to lib/fixtures.ts — used by hooks/use-fixtures.ts
 * (client components can't import server-only Prisma/api-football-key code
 * directly). Server Components should call lib/fixtures.ts directly instead
 * of fetching this route internally. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sport = parseSport(searchParams.get("sport"));
  const league = searchParams.get("league");

  if (league) {
    return NextResponse.json({ fixtures: await getFixturesByLeague(league) });
  }
  if (status === "live") {
    return NextResponse.json({ fixtures: await getLiveFixtures(sport) });
  }
  if (status === "upcoming") {
    return NextResponse.json({ fixtures: await getUpcomingFixtures(sport) });
  }

  const [live, upcoming] = await Promise.all([getLiveFixtures(sport), getUpcomingFixtures(sport)]);
  return NextResponse.json({ fixtures: [...live, ...upcoming] });
}
