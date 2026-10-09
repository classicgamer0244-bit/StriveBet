"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface DraftScoreEvent {
  /** Stable row identity — either the persisted ScheduledScoreEventEmbed.id
   * (prisma/schema.prisma) for an already-saved goal, or a client-minted id
   * for one just added here. Used as the React key so re-sorting the list
   * (which only happens on blur, see MinuteField below) moves the ROW, not
   * the cursor inside it — keying by array index was the original bug:
   * React reused the same DOM input for whichever event now sat at that
   * index, mid-keystroke, so typing in one row could edit another. */
  id: string;
  atMinute: number;
  team: "home" | "away";
}

// Full time can run to 90 + up to 6 added minutes (lib/simulation/phase.ts),
// so a goal needs to be schedulable past 90 — 92 comfortably covers that and
// matches the server-side zod bound in app/api/admin/fixtures/route.ts and
// .../[id]/schedule-events/route.ts.
const MIN_MINUTE = 1;
const MAX_MINUTE = 92;

function clampMinute(n: number): number {
  return Math.min(MAX_MINUTE, Math.max(MIN_MINUTE, Math.round(n) || MIN_MINUTE));
}

function sortEvents(list: DraftScoreEvent[]): DraftScoreEvent[] {
  return [...list].sort((a, b) => a.atMinute - b.atMinute);
}

/**
 * The minute box is deliberately NOT a fully-controlled `value={number}`
 * input clamped on every keystroke — that was the original bug. Clearing the
 * box gave `""` -> `Number("") === 0` -> clamped straight back up to
 * MIN_MINUTE, so a `1` reappeared before the next keystroke could land.
 * Holding the typed text as local state and only clamping/committing on
 * blur lets the field go genuinely empty while it's being edited, and means
 * the list only re-sorts once editing is done rather than on every digit.
 */
function MinuteField({ initialMinute, onCommit }: { initialMinute: number; onCommit: (minute: number) => void }) {
  const [text, setText] = useState(String(initialMinute));

  function commit() {
    const parsed = Number.parseInt(text, 10);
    const clamped = clampMinute(Number.isNaN(parsed) ? initialMinute : parsed);
    setText(String(clamped));
    if (clamped !== initialMinute) onCommit(clamped);
  }

  return (
    <Input
      type="number"
      min={MIN_MINUTE}
      max={MAX_MINUTE}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-20"
    />
  );
}

export function ScoreEventEditor({
  events,
  onChange,
  homeName,
  awayName,
}: {
  events: DraftScoreEvent[];
  onChange: (events: DraftScoreEvent[]) => void;
  homeName: string;
  awayName: string;
}) {
  function commitMinute(id: string, atMinute: number) {
    onChange(sortEvents(events.map((e) => (e.id === id ? { ...e, atMinute } : e))));
  }
  function setTeam(id: string, team: "home" | "away") {
    onChange(events.map((e) => (e.id === id ? { ...e, team } : e)));
  }
  function remove(id: string) {
    onChange(events.filter((e) => e.id !== id));
  }
  function add() {
    const lastMinute = events.length ? events[events.length - 1].atMinute : 0;
    onChange(sortEvents([...events, { id: nanoid(8), atMinute: clampMinute(lastMinute + 15), team: "home" }]));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Scheduled goals (optional)</Label>
      <p className="text-xs text-muted-foreground">
        The engine scores these automatically at the given match-minute, so you don&apos;t have to click during the
        game. You can still adjust the score live.
      </p>

      {events.length > 0 && (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <MinuteField initialMinute={event.atMinute} onCommit={(minute) => commitMinute(event.id, minute)} />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
              <div className="flex flex-1 overflow-hidden rounded-md border border-border">
                {(["home", "away"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setTeam(event.id, side)}
                    className={cn(
                      "flex-1 truncate px-2 py-2 text-xs font-semibold",
                      event.team === side ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                    )}
                  >
                    {side === "home" ? homeName || "Home" : awayName || "Away"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => remove(event.id)}
                aria-label="Remove goal"
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-fit gap-1.5">
        <Plus className="size-3.5" />
        Add scheduled goal
      </Button>

      {events.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Final score: {events.filter((e) => e.team === "home").length} - {events.filter((e) => e.team === "away").length}
        </p>
      )}
    </div>
  );
}
