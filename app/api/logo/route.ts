import { NextResponse } from "next/server";
import { makeLogoTransparent } from "@/lib/images/transparent-logo";

function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (hostname.endsWith(".internal") || hostname.endsWith(".local")) return true;
  return false;
}

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

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new NextResponse(null, { status: 400 });
  }

  if (isPrivateHost(parsed.hostname)) {
    console.error("[logo-proxy] blocked private host:", parsed.hostname, "| full url:", src);
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

    const rawBuffer = Buffer.from(await upstream.arrayBuffer());
    const transparentBuffer = await makeLogoTransparent(rawBuffer);

    return new NextResponse(new Uint8Array(transparentBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
      },
    });
  } catch (err) {
    console.error("[logo-proxy] fetch error for:", src, err);
    return new NextResponse(null, { status: 502 });
  }
}
