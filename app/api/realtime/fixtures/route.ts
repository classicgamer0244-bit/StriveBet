import { getLiveAdminFixtures } from "@/lib/fixtures";
import { tickAdminFixturesIfDue } from "@/lib/simulation/tick";
import { nowMs } from "@/lib/id";
import { POLL_INTERVAL_MS, SOFT_MAX_DURATION_MS, SSE_HEADERS, safeEnqueue, sleep, sseEvent } from "@/lib/realtime/sse";
import { SPORT_SLUGS, type SportSlug } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cap on settlement work per poll tick, so serving fixtures stays responsive. */
const SETTLEMENT_SLICE_MS = 8_000;

/** Backed off to when there's currently nothing live to watch for changes —
 * no reason to hit the DB every 2s for an empty result. Snaps back to
 * POLL_INTERVAL_MS the moment a fixture goes live. */
const IDLE_POLL_INTERVAL_MS = 10_000;

function parseSport(value: string | null): SportSlug | undefined {
  return value && (SPORT_SLUGS as readonly string[]).includes(value) ? (value as SportSlug) : undefined;
}

/**
 * Live-push counterpart to GET /api/fixtures?status=live — admin-simulated
 * fixtures ONLY, never real (ilotbet) ones. Real fixtures are fetched
 * directly from ilotbet.com by the browser on a plain interval instead (see
 * hooks/use-fixtures.ts, lib/ilotbet/browser-fetch.ts) — deliberately not
 * routed through this backend at all, so this app's own cache can never be
 * a stale middleman between "ilotbet says it's live" and what the player
 * sees. The client (hooks/use-fixtures.ts) merges this push with its
 * independently-polled real fixtures without ever touching the real ones it
 * already has. Same self-contained poll-loop-per-connection design as
 * app/api/realtime/fixtures/[id] — see that route's comment for why
 * (serverless hosting, no shared in-memory bus).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = parseSport(searchParams.get("sport"));
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
        let nextDelay = POLL_INTERVAL_MS;
        try {
          // Bounded: the tick hides a full settlement backstop sweep, and this
          // is a live stream — it must never stall behind one. Whatever it
          // doesn't finish, the cron route picks up with a far larger budget.
          await tickAdminFixturesIfDue(nowMs(), { deadlineMs: Date.now() + SETTLEMENT_SLICE_MS });
          const fixtures = await getLiveAdminFixtures(sport);
          const serialized = JSON.stringify(fixtures);
          if (serialized !== lastSent) {
            lastSent = serialized;
            if (!safeEnqueue(controller, encoder.encode(sseEvent({ fixtures })))) closed = true;
          }
          // Nothing live right now — back off instead of hitting the DB
          // every 2s for an empty result. Snaps back the instant a fixture
          // goes live.
          if (fixtures.length === 0) nextDelay = IDLE_POLL_INTERVAL_MS;
        } catch (err) {
          console.error("Realtime live-fixtures poll failed:", err);
        }
        if (closed) break;
        await sleep(nextDelay);
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
