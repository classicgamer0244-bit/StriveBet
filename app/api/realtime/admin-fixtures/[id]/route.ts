import { requireFixtureController } from "@/lib/admin-fixtures/authorize";
import { serializeAdminFixtureFull } from "@/lib/admin-fixtures/serialize";
import { tickAdminFixturesIfDue } from "@/lib/simulation/tick";
import { nowMs } from "@/lib/id";
import { POLL_INTERVAL_MS, SOFT_MAX_DURATION_MS, SSE_HEADERS, safeEnqueue, sleep, sseEvent } from "@/lib/realtime/sse";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cap on settlement work per poll tick, so serving fixtures stays responsive. */
const SETTLEMENT_SLICE_MS = 8_000;

/**
 * Admin-facing counterpart to GET /api/admin/fixtures/[id] — the fuller
 * AdminFixture shape (scheduledEvents, ownerAdminId, etc.), streamed as SSE
 * so components/admin/live-score-control.tsx stays live without navigating
 * away and back. Distinct from app/api/realtime/fixtures/[id], which serves
 * the minimal player-facing Fixture shape — the two are not interchangeable.
 * Same self-contained poll-loop-per-connection design; see that route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireFixtureController(id);
  if (!auth.ok) return new Response(auth.error, { status: auth.status });

  const encoder = new TextEncoder();

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
          const fixture = await db.adminFixture.findUnique({ where: { id } });
          if (fixture) {
            const serialized = serializeAdminFixtureFull(fixture);
            const json = JSON.stringify(serialized);
            if (json !== lastSent) {
              lastSent = json;
              if (!safeEnqueue(controller, encoder.encode(sseEvent({ fixture: serialized })))) closed = true;
            }
            // Nothing left to control — stop polling. The client
            // (components/admin/live-score-control.tsx) also calls
            // es.close() on receipt of this frame so the browser doesn't
            // reconnect.
            if (serialized.status === "finished") closed = true;
          }
        } catch (err) {
          console.error("Realtime admin-fixture poll failed:", err);
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
