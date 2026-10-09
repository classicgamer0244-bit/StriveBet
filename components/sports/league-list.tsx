import Link from "next/link";
import type { League } from "@/types";
import { cn } from "@/lib/utils";

export function LeagueList({
  title,
  leagues,
  activeLeagueId,
}: {
  title: string;
  leagues: League[];
  activeLeagueId?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-muted-foreground uppercase">{title}</p>
      <ul className="flex flex-col">
        {leagues.map((league) => (
          <li key={league.id}>
            <Link
              href={`/sports?sport=${league.sportSlug}&league=${league.id}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary-50 hover:text-primary-700",
                activeLeagueId === league.id ? "bg-primary-50 font-semibold text-primary-700" : "text-foreground"
              )}
            >
              <span className="truncate">{league.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{league.fixtureCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
