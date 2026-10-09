import Link from "next/link";
import { Dice5, Disc3, Layers, Sparkles } from "lucide-react";
import { getGames } from "@/data/selectors";
import { cn } from "@/lib/utils";

const ICONS = [Dice5, Disc3, Layers, Sparkles];

export function MiniGamesTeaser() {
  const games = getGames().slice(0, 4);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-extrabold text-foreground">Mini Games</h3>
      <div className="grid grid-cols-2 gap-2">
        {games.map((game, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <Link
              key={game.id}
              href="/games"
              className={cn(
                "group flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/70 px-2 py-4 text-center text-xs font-bold text-foreground transition-colors hover:bg-navy hover:text-white",
                game.comingSoon && "opacity-60"
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-volt group-hover:text-navy"><Icon className="size-4.5" /></span>
              {game.name}
            </Link>
          );
        })}
      </div>
      <Link
        href="/games"
        className="mt-3 block w-full rounded-xl bg-navy py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-primary"
      >
        Discover more games
      </Link>
    </div>
  );
}
