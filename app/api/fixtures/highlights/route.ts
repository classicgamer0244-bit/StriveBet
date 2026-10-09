import { NextResponse } from "next/server";
import { getHighlightFixtures } from "@/lib/fixtures";

export async function GET() {
  return NextResponse.json({ fixtures: await getHighlightFixtures() });
}
