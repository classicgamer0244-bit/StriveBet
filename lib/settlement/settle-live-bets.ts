import { syncBetFixtures } from "@/lib/api-football/sync/bet-fixtures";

/**
 * Legacy api-football settlement-tail backstop ONLY — ilotbet-sourced
 * fixtures settle entirely through syncLiveMatches()'s status-transition
 * diff (lib/ilotbet/sync/live-matches.ts), which needs no separate backstop
 * (see that file's doc comment). This function exists purely for whatever
 * bets still reference "af-…" fixtures (see
 * app/api/superadmin/api-football/status's `legacyOpenBets`) that the
 * legacy liveFixtures diff could still miss — a bet placed on a fixture that
 * had already reached a terminal state before it was ever cached. Runs via
 * the CRON_SECRET-protected /api/cron/settle-live-bets route, and as a
 * lock-guarded job inside the my-bets SSE loop (see
 * lib/api-football/sync/scheduler.ts).
 */
export async function settleLiveBets(): Promise<{ checked: number; settled: number }> {
  const result = await syncBetFixtures();
  return { checked: result.fetched, settled: result.terminal };
}
