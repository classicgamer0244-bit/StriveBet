import { Trophy } from "lucide-react";
import type { Fixture } from "@/types";
import { FixtureRow } from "./fixture-row";
import { FixtureColumnHeader } from "./fixture-column-header";
import { dateKey, formatDateHeader } from "@/lib/format-date";

function groupFixturesByDate(fixtures: Fixture[]) {
  const order: string[] = [];
  const map = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const key = dateKey(f.kickoffAt);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(f);
  }
  return order.map((key) => ({ key, label: formatDateHeader(map.get(key)![0].kickoffAt), fixtures: map.get(key)! }));
}

export function CompetitionGroup({
  leagueName,
  fixtures,
  showGoalsColumn = false,
  groupByDate = false,
  dark = false,
}: {
  leagueName: string;
  fixtures: Fixture[];
  showGoalsColumn?: boolean;
  groupByDate?: boolean;
  dark?: boolean;
}) {
  const dateGroups = groupByDate ? groupFixturesByDate(fixtures) : [{ key: "all", label: "", fixtures }];

  return (
    <div>
      <div
        className={
          dark
            ? "flex items-center gap-2 bg-white/5 px-4 py-2.5 text-xs font-bold text-white/70"
            : "flex items-center gap-2 border-y border-border bg-muted/40 px-4 py-2.5 text-[13px] font-bold text-foreground"
        }
      >
        <span className={`flex size-5 items-center justify-center rounded-md ${dark ? "bg-volt/15 text-volt" : "bg-primary/10 text-primary"}`}>
          <Trophy className="size-3" />
        </span>
        {leagueName}
      </div>
      {dateGroups.map((group) => (
        <div key={group.key}>
          {groupByDate && <FixtureColumnHeader date={group.label} showGoalsColumn={showGoalsColumn} />}
          {group.fixtures.map((fixture) => (
            <FixtureRow key={fixture.id} fixture={fixture} showGoalsColumn={showGoalsColumn} dark={dark} />
          ))}
        </div>
      ))}
    </div>
  );
}
