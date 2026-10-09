import Link from "next/link";
import Image from "next/image";
import { getPopularLeagues } from "@/data/selectors";
import { Globe } from "lucide-react";
import type { League } from "@/types";

function LeagueIcon({ league }: { league: League }) {
  if (league.logoUrl) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center">
        <Image src={league.logoUrl} alt={league.name} width={20} height={20} className="size-full object-contain" />
      </span>
    );
  }
  return (
    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Globe className="size-3.5" />
    </div>
  );
}

export async function MobileLeagueChips() {
  const leagues = await getPopularLeagues();

  return (
    <div className="flex gap-2 overflow-x-auto py-1 lg:hidden">
      {leagues.map((league) => (
        <Link
          key={league.id}
          href={`/sports?league=${league.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
        >
          <LeagueIcon league={league} />
          {league.name}
        </Link>
      ))}
    </div>
  );
}
