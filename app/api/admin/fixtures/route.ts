import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";
import { buildMarketsForFixture, overrideMarkets } from "@/data/mock/market-builder";
import { nanoid } from "nanoid";
import { REALTIME_SIM_COMPRESSION } from "@/lib/constants";
import { SPORT_SLUGS } from "@/types";

// Full time can run to 90 + up to 6 added minutes (lib/simulation/phase.ts),
// so a goal needs to be schedulable past 90 — matches the client-side bound
// in components/admin/score-event-editor.tsx.
const scheduledEventSchema = z.object({ atMinute: z.number().int().min(1).max(92), team: z.enum(["home", "away"]) });
const marketOverridesSchema = z.record(z.string(), z.array(z.tuple([z.string(), z.number().min(1.01).max(1000)])));

const bodySchema = z.object({
  homeTeamName: z.string().trim().min(1),
  awayTeamName: z.string().trim().min(1),
  homeTeamLogoUrl: z.string().trim().url(),
  awayTeamLogoUrl: z.string().trim().url(),
  leagueName: z.string().trim().min(1),
  sportSlug: z.enum(SPORT_SLUGS).default("football"),
  kickoffAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), "Kickoff must be in the future."),
  scheduledEvents: z.array(scheduledEventSchema).default([]),
  seed: z.string().trim().min(1).max(40).optional(),
  marketOverrides: marketOverridesSchema.optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.status !== "ACTIVE") {
    return NextResponse.json({ error: "Your account isn't approved yet." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Please check the match details." }, { status: 400 });

  const { homeTeamName, awayTeamName, homeTeamLogoUrl, awayTeamLogoUrl, leagueName, sportSlug, kickoffAt, scheduledEvents } =
    parsed.data;

  // Built + frozen exactly once, right here — never rebuilt on read, so bet
  // legs' selectionId references never orphan (ids are content-derived from
  // the seed, see market-builder.ts's stableSelId/stableMktId). The admin's
  // hand-edited odds (if any) come in as marketOverrides, keyed by the SAME
  // seed the client previewed with, so overrideMarkets() reuses identical ids.
  const seed = parsed.data.seed ?? nanoid(12);
  const base = buildMarketsForFixture(seed);
  const markets = parsed.data.marketOverrides ? overrideMarkets(seed, base, parsed.data.marketOverrides) : base;

  const fixture = await db.adminFixture.create({
    data: {
      ownerAdminId: admin.id,
      homeTeamName,
      awayTeamName,
      homeTeamLogoUrl,
      awayTeamLogoUrl,
      leagueName,
      sportSlug,
      kickoffAt,
      simKickoffTs: BigInt(kickoffAt.getTime()),
      // Always real-time — 90 real minutes per match, no fast-demo pace choice.
      compression: REALTIME_SIM_COMPRESSION,
      status: "UPCOMING",
      markets,
      marketSeed: seed,
      scheduledEvents: scheduledEvents.map((e) => ({ id: nanoid(10), atMinute: e.atMinute, team: e.team, deltaGoals: 1, applied: false })),
    },
  });

  return NextResponse.json({ fixture: serializeAdminFixtureFull(fixture) }, { status: 201 });
}

export async function GET() {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fixtures = await db.adminFixture.findMany({ where: { ownerAdminId: admin.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ fixtures: fixtures.map(serializeAdminFixtureFull) });
}
