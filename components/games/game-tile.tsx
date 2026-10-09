"use client";

import { toast } from "sonner";
import { Dice5, Disc3, Layers, Sparkles, Rocket, Bomb, Target, CircleDot, Coins, Zap } from "lucide-react";
import type { Game } from "@/types";
import { cn } from "@/lib/utils";

const ICONS = [Dice5, Disc3, Layers, Sparkles, Rocket, Bomb, Target, CircleDot, Coins, Zap];

export function GameTile({ game, iconIndex }: { game: Game; iconIndex: number }) {
  const Icon = ICONS[iconIndex % ICONS.length];

  return (
    <button
      type="button"
      onClick={() =>
        toast.info(game.comingSoon ? `${game.name} is coming soon.` : `${game.name} isn't playable in this demo yet.`)
      }
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-8 text-center transition-colors hover:border-primary-300 hover:bg-primary-50",
        game.comingSoon && "opacity-60"
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Icon className="size-5" />
      </span>
      <span className="text-sm font-semibold text-foreground">{game.name}</span>
      {game.comingSoon && <span className="text-[10px] font-bold text-muted-foreground uppercase">Coming soon</span>}
    </button>
  );
}
