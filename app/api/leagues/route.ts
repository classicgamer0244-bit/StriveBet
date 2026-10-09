import { NextResponse } from "next/server";
import { getSidebarLeagues } from "@/lib/fixtures";

export async function GET() {
  return NextResponse.json({ leagues: await getSidebarLeagues() });
}
