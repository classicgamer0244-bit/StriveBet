import { Radio } from "lucide-react";
import type { Fixture } from "@/types";
import { ChangeMatchSelect } from "./change-match-select";
import { LiveBadge } from "./live-badge";
import { TeamCrest } from "./team-crest";

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${weekday} ${time}`;
}

export function FixtureDetailHeader({ fixture, siblingFixtures }: { fixture: Fixture; siblingFixtures: Fixture[] }) {
  const isLive = fixture.status === "live" || fixture.status === "halftime";

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs text-muted-foreground">
        {isLive ? (
          <div className="flex items-center gap-2">
            <LiveBadge />
            <span className="font-bold tabular-nums text-live">
              {fixture.minute} {fixture.period}
            </span>
          </div>
        ) : (
          <span className="font-medium">{formatKickoff(fixture.kickoffAt)}</span>
        )}
        {isLive && (
          <span className="flex items-center gap-1 text-success">
            <Radio className="size-3.5" /> In-Play Available
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-start justify-center gap-3 sm:justify-between">
          <div className="flex flex-1 flex-col items-center gap-2 min-w-0 sm:flex-none sm:w-40">
            <TeamCrest team={fixture.homeTeam} />
            <span className="w-full truncate text-center text-sm font-bold text-foreground">
              {fixture.homeTeam.name}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 px-2 pt-3 text-center">
            {isLive && fixture.score ? (
              <span className="text-lg font-extrabold tabular-nums text-foreground">
                {fixture.score.home} - {fixture.score.away}
              </span>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">VS</span>
            )}
          </div>
          <div className="flex flex-1 flex-col items-center gap-2 min-w-0 sm:flex-none sm:w-40">
            <TeamCrest team={fixture.awayTeam} />
            <span className="w-full truncate text-center text-sm font-bold text-foreground">
              {fixture.awayTeam.name}
            </span>
          </div>
        </div>
        <ChangeMatchSelect fixtures={siblingFixtures} currentId={fixture.id} />
      </div>
    </div>
  );
}
