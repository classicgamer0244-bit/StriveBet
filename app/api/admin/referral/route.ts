import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";

export async function GET() {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const referredCount = await db.user.count({ where: { referredById: admin.id } });
  return NextResponse.json({ referralCode: admin.referralCode, referredCount });
}
