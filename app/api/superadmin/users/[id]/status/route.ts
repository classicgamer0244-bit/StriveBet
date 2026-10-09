import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { serializeUser } from "@/lib/auth/serialize";

const bodySchema = z.object({ status: z.enum(["active", "suspended"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("SUPERADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const updated = await db.user.update({
    where: { id },
    data: { status: parsed.data.status === "active" ? "ACTIVE" : "SUSPENDED" },
  });
  return NextResponse.json({ user: serializeUser(updated) });
}
