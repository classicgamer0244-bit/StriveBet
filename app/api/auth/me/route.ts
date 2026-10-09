import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { serializeAdmin, serializeUser } from "@/lib/auth/serialize";

/** Replaces PlatformState.session as the single source of truth for "who is
 * currently logged in" — always re-verified against the database. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ kind: null, account: null });

  if (session.kind === "user") {
    return NextResponse.json({ kind: "user", account: serializeUser(session.user) });
  }
  return NextResponse.json({ kind: "admin", account: serializeAdmin(session.admin) });
}
