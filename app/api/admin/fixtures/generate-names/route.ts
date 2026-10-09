import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { generateFictionalMatchup, isGroqConfigured } from "@/lib/groq";

export async function POST() {
  // Any staff account can create matches (merchants and head office).
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGroqConfigured()) {
    return NextResponse.json(
      { error: "Auto-fill isn't available right now — enter the names manually." },
      { status: 503 }
    );
  }

  try {
    const matchup = await generateFictionalMatchup();
    return NextResponse.json(matchup);
  } catch (err) {
    console.error("Groq name generation failed:", err);
    return NextResponse.json(
      { error: "Couldn't generate names right now. Please try again or enter them manually." },
      { status: 502 }
    );
  }
}
