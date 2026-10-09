import type { Game } from "@/types";
import { GameTile } from "./game-tile";

export function GameCategoryRow({ title, games }: { title: string; games: Game[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((game, i) => (
          <GameTile key={game.id} game={game} iconIndex={i} />
        ))}
      </div>
    </section>
  );
}
