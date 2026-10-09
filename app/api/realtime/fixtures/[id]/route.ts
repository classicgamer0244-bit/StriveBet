import { getFixtureById } from "@/lib/fixtures";
import { isRealFixtureId } from "@/lib/fixture-id";
import { tickAdminFixturesIfDue } from "@/lib/simulation/tick";
import { nowMs } from "@/lib/id";
import { POLL_INTERVAL_MS, SOFT_MAX_DURATION_MS, SSE_HEADERS, safeEnqueue, sleep, sseEvent } from "@/lib/realtime/sse";

// Prisma needs the Node runtime (not Edge); this route must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cap on settlement work per poll tick, so serving fixtures stays responsive. */
const SETTLEMENT_SLICE_MS = 8_000;

/**
 * Live-push counterpart to GET /api/fixtures/[id] — a single fixture's
 * score/minute/odds, streamed as Server-Sent Events. Admin-simulated
 * fixtures only: real (ilotbet) fixtures are fetched directly from
 * ilotbet.com by the browser on a plain interval instead (see
 * hooks/use-fixtures.ts, lib/ilotbet/browser-fetch.ts), so a real id gets
 * one snapshot and an immediate close rather than a 55-second poll loop
 * nobody's listening to. Each connection runs its own self-contained poll
 * loop (tick → fetch → diff → send if changed) rather than subscribing to a
 * shared in-memory bus, since this app's target hosting is serverless and a
 * bus in one instance's memory would be invisible to another instance
 * handling a different connection.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  if (isRealFixtureId(id)) {
    const fixture = await getFixtureById(id);
    const body = fixture ? sseEvent({ fixture }) : "";
    return new Response(body, { headers: SSE_HEADERS });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      request.signal.addEventListener("abort", () => {
        closed = true;
      });

      let lastSent: string | null = null;
      const startedAt = Date.now();

      while (!closed && Date.now() - startedAt < SOFT_MAX_DURATION_MS) {
        try {
          // Bounded: the tick hides a full settlement backstop sweep, and this
          // is a live stream — it must never stall behind one. Whatever it
          // doesn't finish, the cron route picks up with a far larger budget.
          await tickAdminFixturesIfDue(nowMs(), { deadlineMs: Date.now() + SETTLEMENT_SLICE_MS });
          const fixture = await getFixtureById(id);
          if (fixture) {
            const serialized = JSON.stringify(fixture);
            if (serialized !== lastSent) {
              lastSent = serialized;
              if (!safeEnqueue(controller, encoder.encode(sseEvent({ fixture })))) closed = true;
            }
            // Nothing will ever change again — stop polling. The client
            // (hooks/use-fixtures.ts's useFixtureById) also calls es.close()
            // on receipt of this frame so the browser doesn't reconnect.
            if (fixture.status === "finished") closed = true;
          }
        } catch (err) {
          console.error("Realtime fixture poll failed:", err);
        }
        if (closed) break;
        await sleep(POLL_INTERVAL_MS);
      }

      try {
        controller.close();
      } catch {
        // Already closed by the client aborting — nothing to do.
      }
    },
    cancel() {
      // Client disconnected — the abort listener above already flips `closed`.
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
