"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Play, Flag, Check, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreEventEditor, type DraftScoreEvent } from "./score-event-editor";
import { MatchStatusBadge } from "./match-status-badge";
import { useTabVisible } from "@/hooks/use-tab-visible";
import type { AdminFixture } from "@/types";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function LiveScoreControl({ fixtureId }: { fixtureId: string }) {
  const router = useRouter();
  const [fixture, setFixture] = useState<AdminFixture | null | undefined>(undefined);
  const [drafts, setDrafts] = useState<DraftScoreEvent[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const tabVisible = useTabVisible();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/fixtures/${fixtureId}`, { cache: "no-store" });
      const data = await readJson(res);
      if (!cancelled) setFixture(res.ok ? data.fixture : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  // Keeps this panel live without navigating away and back — same
  // self-contained polling-SSE stream the player-facing live views use.
  // Closed while the tab is hidden, and for good once the match is finished
  // (nothing left to control).
  useEffect(() => {
    if (!tabVisible) return;
    const es = new EventSource(`/api/realtime/admin-fixtures/${fixtureId}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { fixture: AdminFixture };
        if (data.fixture && data.fixture.id === fixtureId) {
          setFixture(data.fixture);
          if (data.fixture.status === "finished") es.close();
        }
      } catch {
        // Ignore malformed/heartbeat frames.
      }
    };
    return () => es.close();
  }, [fixtureId, tabVisible]);

  if (fixture === undefined) return <Skeleton className="h-72 w-full" />;
  if (!fixture) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        Match not found.
      </div>
    );
  }

  const score = fixture.score ?? { home: 0, away: 0 };
  const editable = drafts ?? fixture.scheduledEvents.map((e) => ({ id: e.id, atMinute: e.atMinute, team: e.team }));

  async function setScore(next: { home: number; away: number }) {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/fixtures/${fixtureId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: Math.max(0, next.home), away: Math.max(0, next.away) }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't update the score.");
        return;
      }
      setFixture(data.fixture);
    } finally {
      setIsBusy(false);
    }
  }

  async function kickOffNow() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/fixtures/${fixtureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kickOffNow: true }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't kick off the match.");
        return;
      }
      setFixture(data.fixture);
      toast.success("Match kicked off.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveEvents() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/fixtures/${fixtureId}/schedule-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: editable }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't save scheduled goals.");
        return;
      }
      setFixture(data.fixture);
      setDrafts(null);
      toast.success("Scheduled goals updated.");
    } finally {
      setIsBusy(false);
    }
  }

  async function endAndSettle() {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/fixtures/${fixtureId}/settle`, { method: "POST" });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't settle this match.");
        return;
      }
      setFixture(data.fixture);
      toast.success("Match ended and bets settled.");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  async function cancelMatch() {
    if (!window.confirm("Cancel this match? Any bets already placed on it will be voided and refunded.")) return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/fixtures/${fixtureId}/cancel`, { method: "POST" });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't cancel this match.");
        return;
      }
      setFixture(data.fixture);
      toast.success("Match cancelled — any stakes on it have been refunded.");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{fixture.leagueName}</span>
          <MatchStatusBadge status={fixture.status} minute={fixture.minute} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-foreground">{fixture.homeTeam.name}</span>
          <span className="shrink-0 rounded-md bg-muted px-3 py-1 text-xl font-extrabold tabular-nums text-foreground">
            {score.home} - {score.away}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{fixture.awayTeam.name}</span>
        </div>
      </div>

      {fixture.status === "upcoming" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Kicks off {new Date(fixture.simKickoffTs).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })} (auto) — or start it now.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={kickOffNow} disabled={isBusy} className="gap-1.5">
              <Play className="size-4" />
              Kick off now
            </Button>
            <Button onClick={cancelMatch} disabled={isBusy} variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
              <Ban className="size-4" />
              Cancel match
            </Button>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <ScoreEventEditor
              events={editable}
              onChange={setDrafts}
              homeName={fixture.homeTeam.name}
              awayName={fixture.awayTeam.name}
            />
            {drafts !== null && (
              <Button onClick={saveEvents} disabled={isBusy} variant="outline" size="sm" className="mt-2">
                Save scheduled goals
              </Button>
            )}
          </div>
        </div>
      )}

      {(fixture.status === "live" || fixture.status === "halftime") && (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-xs font-bold text-muted-foreground uppercase">Adjust score live</p>
            <div className="grid grid-cols-2 gap-4">
              {(["home", "away"] as const).map((side) => (
                <div key={side} className="flex flex-col items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{fixture[`${side}Team`].name}</span>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => setScore({ ...score, [side]: score[side] - 1 })}
                      aria-label={`Decrease ${side} score`}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center text-2xl font-extrabold tabular-nums text-foreground">{score[side]}</span>
                    <Button
                      size="icon"
                      disabled={isBusy}
                      onClick={() => setScore({ ...score, [side]: score[side] + 1 })}
                      aria-label={`Increase ${side} score`}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {fixture.scheduledEvents.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-xs font-bold text-muted-foreground uppercase">Scheduled goals</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {[...fixture.scheduledEvents]
                  .sort((a, b) => a.atMinute - b.atMinute)
                  .map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-foreground">
                      {e.applied ? (
                        <Check className="size-4 text-success" />
                      ) : (
                        <span className="size-4 text-center text-xs text-muted-foreground">{e.atMinute}</span>
                      )}
                      <span className={e.applied ? "text-muted-foreground line-through" : ""}>
                        {e.atMinute}&apos; — {e.team === "home" ? fixture.homeTeam.name : fixture.awayTeam.name} scores
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={endAndSettle} disabled={isBusy} variant="outline" className="gap-1.5">
              <Flag className="size-4" />
              End match &amp; settle now
            </Button>
            <Button onClick={cancelMatch} disabled={isBusy} variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
              <Ban className="size-4" />
              Cancel match
            </Button>
          </div>
        </>
      )}

      {fixture.status === "finished" && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Match finished. Final score {score.home} - {score.away}. Bets have been settled from this result.
        </div>
      )}

      {fixture.status === "cancelled" && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          This match was cancelled. Any bets placed on it were voided and refunded.
        </div>
      )}
    </div>
  );
}
