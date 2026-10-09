import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";
import { nowMs } from "@/lib/id";
import { rollStoppageMinutes } from "@/lib/simulation/phase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ fixture: serializeAdminFixtureFull(result.fixture) });
}

const bodySchema = z.object({ kickOffNow: z.boolean().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.kickOffNow) {
    const updated = await db.adminFixture.update({
      where: { id },
      data: {
        status: "LIVE",
        scoreHome: 0,
        scoreAway: 0,
        minute: "1'",
        simKickoffTs: BigInt(nowMs()),
        stoppageMinutes: rollStoppageMinutes(),
        firstHalfStoppageMinutes: rollStoppageMinutes(),
      },
    });
    return NextResponse.json({ fixture: serializeAdminFixtureFull(updated) });
  }

  return NextResponse.json({ fixture: serializeAdminFixtureFull(result.fixture) });
}
