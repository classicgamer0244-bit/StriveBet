import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";

/**
 * Cheap edge-runtime pre-check: is there even a valid admin-kind session
 * token? This can't tell ADMIN from SUPERADMIN or check pending/suspended
 * status (that needs a DB read, which route handlers do authoritatively via
 * lib/auth/session's getSession/requireAdmin) — it only blocks requests with
 * no session at all before they reach a handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAdminSession = pathname.startsWith("/api/admin") || pathname.startsWith("/api/superadmin");
  if (!needsAdminSession) return NextResponse.next();

  const token = request.cookies.get("maxbet_session")?.value;
  const payload = token ? await verifySessionToken(token) : null;
  if (!payload || payload.kind !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*", "/api/superadmin/:path*"],
};
