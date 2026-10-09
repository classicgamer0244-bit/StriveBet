/** Shared helpers for the polling-SSE routes under app/api/realtime — see
 * those routes for why this is a self-contained poll loop per connection
 * rather than a shared in-memory event bus (this app's target hosting is
 * serverless, where a bus in one instance's memory is invisible to another). */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/** enqueue() on a stream whose client just disconnected throws — the
 * `abort` listener each route uses to flip its `closed` flag fires
 * asynchronously, so there's always a window (during an `await` inside the
 * poll loop) where the flag hasn't been set yet but the controller has
 * already been torn down by the runtime. Checking `closed` first narrows
 * that window but can't close it; only catching the throw here is reliable.
 * Returns false when the enqueue was dropped (caller can treat that as its
 * own signal to stop looping), true when it went through. */
export function safeEnqueue(controller: ReadableStreamDefaultController, chunk: Uint8Array): boolean {
  try {
    controller.enqueue(chunk);
    return true;
  } catch {
    return false;
  }
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export const POLL_INTERVAL_MS = 2000;
/** Self-imposed close, well under each route's maxDuration=300 (Vercel Pro's
 * serverless ceiling) — ends the stream cleanly so the browser's EventSource
 * reconnects promptly, instead of relying on the platform to hard-kill the
 * connection. Kept well under 300s on purpose (not equal to it): every
 * reconnect is a fresh Vercel invocation, and invocation count is the
 * cheapest of the three Fluid compute cost lines, so this trades a few extra
 * invocations for a safety margin against any infra-level timeout below the
 * plan's stated maxDuration. Previously 55_000 — raised so a stream that's
 * actually busy needs ~5x fewer reconnects for the same total connected
 * time (invocation count drops accordingly; total Provisioned Memory time is
 * unchanged either way, since that's driven by how long a tab stays open and
 * visible, not by how the connection is chunked). */
export const SOFT_MAX_DURATION_MS = 285_000;
