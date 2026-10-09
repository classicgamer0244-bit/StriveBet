import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";

const bodySchema = z.object({ home: z.number().int().min(0), away: z.number().int().min(0) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireFixtureController(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid score." }, { status: 400 });

  const updated = await db.adminFixture.update({
    where: { id },
    data: { scoreHome: parsed.data.home, scoreAway: parsed.data.away },
  });
  return NextResponse.json({ fixture: serializeAdminFixtureFull(updated) });
}
