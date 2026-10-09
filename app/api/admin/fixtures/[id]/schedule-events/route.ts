import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";

const bodySchema = z.object({
  // Full time can run to 90 + up to 6 added minutes (lib/simulation/phase.ts).
  events: z.array(z.object({ atMinute: z.number().int().min(1).max(92), team: z.enum(["home", "away"]) })),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid events." }, { status: 400 });

  const updated = await db.adminFixture.update({
    where: { id },
    data: {
      scheduledEvents: parsed.data.events.map((e) => ({
        id: nanoid(10),
        atMinute: e.atMinute,
        team: e.team,
        deltaGoals: 1,
        applied: false,
      })),
    },
  });
  return NextResponse.json({ fixture: serializeAdminFixtureFull(updated) });
}
