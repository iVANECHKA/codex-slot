import { GameCard } from "@/components/lobby/game-card";
import { Panel } from "@/components/ui/panel";
import { gameCatalog } from "@/lib/casino/catalog";

export default function LobbyPage() {
  return (
    <div className="space-y-8">
      <Panel className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Лобби казино</p>
        <h1 className="font-display text-5xl">Выбери свою игру</h1>
        <p className="max-w-2xl text-sm leading-7 text-zinc-400">
          Слоты, краш и мины работают в едином mobile-first shell, а баланс и расчеты ведутся на сервере. Каждая игра уже подготовлена к конфигам и замене символов через backend.
        </p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {gameCatalog.map((game, index) => (
          <GameCard key={game.slug} game={game} index={index} />
        ))}
      </div>
    </div>
  );
}