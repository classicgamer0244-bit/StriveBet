import { NextResponse } from "next/server";

const ALLOWED_HOSTS = ["file.ilotbet.com", "api.ilotbet.com", "media.api-sports.io", "res.cloudinary.com"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");
  if (!src) return new NextResponse(null, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    console.error("[logo-proxy] invalid URL:", src);
    return new NextResponse(null, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    console.error("[logo-proxy] blocked host:", parsed.hostname, "| full url:", src);
    return new NextResponse(null, { status: 403 });
  }

  try {
    const upstream = await fetch(src, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!upstream.ok) {
      console.error("[logo-proxy] upstream", upstream.status, "for:", src);
      return new NextResponse(null, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/png";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("[logo-proxy] fetch error for:", src, err);
    return new NextResponse(null, { status: 502 });
  }
}
