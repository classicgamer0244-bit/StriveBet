import { NextResponse } from "next/server";
import { getFixtureById } from "@/lib/fixtures";
import { isRealFixtureId } from "@/lib/fixture-id";
import { rawIlotbetMatchToFixture } from "@/lib/ilotbet/browser-map";
import type { IlotbetMatchDetailResponse } from "@/lib/ilotbet/types";

async function fetchFromIlotbet(matchId: string) {
  const url = new URL("https://www.ilotbet.com/api/sbu/un/m/match");
  url.searchParams.set("platform", "3");
  url.searchParams.set("platformModel", "1.0");
  url.searchParams.set("id", matchId);
  url.searchParams.set("easy", "false");
  url.searchParams.set("timestamp", String(Date.now()));
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return undefined;
  const body = (await res.json()) as IlotbetMatchDetailResponse;
  if (body.code !== 0 || !body.data) return undefined;
  return rawIlotbetMatchToFixture(body.data);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isRealFixtureId(id)) {
    try {
      const fixture = await fetchFromIlotbet(id);
      if (fixture) return NextResponse.json({ fixture });
    } catch {
      // fall through to cache
    }
  }

  const fixture = await getFixtureById(id);
  if (!fixture) return NextResponse.json({ error: "Fixture not found." }, { status: 404 });
  return NextResponse.json({ fixture });
}
