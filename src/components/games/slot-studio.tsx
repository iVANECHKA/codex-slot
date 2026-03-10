"use client";

import { useMemo, useState } from "react";
import type { SlotGameDefinition } from "@/lib/casino/types";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCoins } from "@/lib/utils";

interface SlotApiResult {
  result: {
    roundId: string;
    payout: number;
    balance: number;
    grid: string[][];
    lineWins: Array<{ lineIndex: number; symbol: string; count: number; payout: number }>;
    bonusMultiplier: number;
  };
  error?: string;
}

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

function getSymbolLabel(game: SlotGameDefinition, code: string) {
  return game.config.symbols.find((symbol) => symbol.code === code)?.label ?? code;
}

export function SlotStudio({ game }: { game: SlotGameDefinition }) {
  const { user, refresh } = useSession();
  const [stake, setStake] = useState(20);
  const [grid, setGrid] = useState<string[][]>(() =>
    Array.from({ length: game.config.rows }, () => Array.from({ length: 5 }, () => "A")),
  );
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("Готово к следующему спину.");
  const [lastPayout, setLastPayout] = useState(0);

  const lines = useMemo(() => game.config.paylines.length, [game.config.paylines.length]);

  async function play(endpoint: string) {
    if (isStaticExport) {
      setSummary("Backend API is unavailable on GitHub Pages.");
      return;
    }

    setLoading(true);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: game.slug, stake }),
    });
    const payload = (await response.json()) as SlotApiResult;
    setLoading(false);

    if (!response.ok || payload.error) {
      setSummary(payload.error ?? "Не удалось выполнить действие");
      return;
    }

    setGrid(payload.result.grid);
    setLastPayout(payload.result.payout);
    setSummary(
      payload.result.payout > 0
        ? `Выигрыш ${formatCoins(payload.result.payout)} монет${payload.result.bonusMultiplier ? `, бонус x${payload.result.bonusMultiplier}` : ""}`
        : "Линия не собрана. Попробуй еще один спин.",
    );
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">{game.eyebrow}</p>
            <h2 className="font-display text-4xl">{game.title}</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
            {lines} линий
          </div>
        </div>

        <div className="grid gap-3 rounded-[28px] border border-white/10 bg-black/30 p-4 sm:grid-cols-5">
          {grid[0]?.map((_, reelIndex) => (
            <div key={reelIndex} className="grid gap-3">
              {grid.map((row, rowIndex) => {
                const code = row[reelIndex];
                const symbol = game.config.symbols.find((item) => item.code === code);
                return (
                  <div
                    key={`${reelIndex}-${rowIndex}`}
                    className={`flex aspect-square items-center justify-center rounded-[24px] border border-white/10 bg-gradient-to-br ${symbol?.accent ?? "from-slate-700 to-slate-900"} text-center text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]`}
                  >
                    <span className="font-display text-2xl uppercase tracking-[0.18em]">{getSymbolLabel(game, code)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
          <span>{summary}</span>
          <span className="font-semibold text-amber-200">Последний выигрыш: {formatCoins(lastPayout)} монет</span>
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Профиль</p>
          <h3 className="mt-2 font-display text-3xl">{user ? `${user.displayName}, баланс` : "Гостевой режим"}</h3>
          <p className="mt-2 text-sm text-zinc-400">Результат спина считается на сервере: барабаны, paylines, символы и стоимость бонуски настраиваются отдельно от клиента.</p>
        </div>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Ставка</span>
          <input
            type="number"
            min={game.config.minBet}
            max={game.config.maxBet}
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-amber-300/50"
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {[10, 20, 50].map((amount) => (
            <Button key={amount} variant="secondary" onClick={() => setStake(amount)}>
              {amount}
            </Button>
          ))}
        </div>

        <Button className="w-full py-3 text-base" disabled={loading || !user} onClick={() => void play("/api/games/slots/spin")}>
          {loading ? "Крутим..." : "Крутить барабаны"}
        </Button>
        <Button className="w-full py-3 text-base" variant="secondary" disabled={loading || !user} onClick={() => void play("/api/games/slots/bonus")}>
          Купить бонус x{game.config.bonusBuy.priceMultiplier}
        </Button>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
          <p className="font-semibold text-white">Параметры слота</p>
          <ul className="mt-3 space-y-2 text-zinc-400">
            <li>Целевой RTP: {game.config.rtpTarget}%</li>
            <li>Волатильность: {game.config.volatility.replaceAll("_", " ")}</li>
            <li>Бонус-фича: {game.config.bonusBuy.featureKey}</li>
          </ul>
        </div>
      </Panel>
    </div>
  );
}