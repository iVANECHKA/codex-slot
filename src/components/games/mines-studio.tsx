"use client";

import { useMemo, useState } from "react";
import type { MinesGameDefinition } from "@/lib/casino/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { calculateMinesMultiplier } from "@/lib/casino/engines/mines-engine";
import { useSession } from "@/components/providers/session-provider";
import { formatCoins } from "@/lib/utils";
import BadMine from '../../../public/BadMine.png';
import GoodMine from '../../../public/GoodMine.png';
import { staticCashoutMines, staticRevealMinesTile, staticStartMinesRound } from "@/lib/static-export-demo";

interface MinesRound {
  roundId: string;
  boardSize: number;
  minesCount: number;
  revealedSafeIndexes: number[];
}

interface MinesResponse {
  round?: MinesRound;
  result?: {
    roundId: string;
    hitMine?: boolean;
    multiplier: number;
    payout?: number;
    revealedSafeIndexes?: number[];
    revealAllMines?: number[];
    balance?: number;
  };
  error?: string;
}

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export function MinesStudio({ game }: { game: MinesGameDefinition }) {
  const { user, refresh } = useSession();
  const [stakeInput, setStakeInput] = useState("20");
  const [minesCount, setMinesCount] = useState(5);
  const [round, setRound] = useState<MinesRound | null>(null);
  const [revealedMines, setRevealedMines] = useState<number[]>([]);
  const [status, setStatus] = useState("Запусти поле и открывай клетки, пока хранилище не взорвалось.");
  const [loading, setLoading] = useState(false);

  const currentMultiplier = useMemo(() => {
    if (!round) {
      return 1;
    }
    return calculateMinesMultiplier(
      round.boardSize,
      round.minesCount,
      round.revealedSafeIndexes.length,
      game.config.houseEdge,
    );
  }, [game.config.houseEdge, round]);

  async function start() {
    const parsedStake = Number(stakeInput);
    if (!Number.isFinite(parsedStake) || parsedStake <= 0) {
      setStatus("Ставка должна быть больше 0.");
      return;
    }
    if (isStaticExport) {
      setLoading(true);
      try {
        const payload = staticStartMinesRound({ game, stake: parsedStake, minesCount });
        if (!payload.round) {
          throw new Error("Failed to start Mines round");
        }

        setRound(payload.round);
        setRevealedMines([]);
        setStatus("Field is ready. Every safe tile increases the cashout multiplier.");
        await refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to start Mines round");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const response = await fetch("/api/games/mines/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: game.slug, stake: parsedStake, minesCount }),
    });
    const payload = (await response.json()) as MinesResponse;
    setLoading(false);

    if (!response.ok || !payload.round) {
      setStatus(payload.error ?? "Не удалось запустить раунд в мины");
      return;
    }

    setRound(payload.round);
    setRevealedMines([]);
    setStatus("Поле готово. Каждая безопасная клетка увеличивает множитель вывода.");
    await refresh();
  }

  async function reveal(tileIndex: number) {
    if (!round) {
      return;
    }

    if (isStaticExport) {
      try {
        const payload = staticRevealMinesTile({ game, roundId: round.roundId, tileIndex });
        if (!payload.result) {
          throw new Error("Failed to reveal tile");
        }

        if (payload.result.hitMine) {
          setStatus(`Boom. Round lost at x${payload.result.multiplier.toFixed(2)}.`);
          setRevealedMines(payload.result.revealAllMines ?? []);
          setRound(null);
          return;
        }

        setRound((current) =>
          current
            ? {
                ...current,
                revealedSafeIndexes: payload.result?.revealedSafeIndexes ?? current.revealedSafeIndexes,
              }
            : current,
        );
        setStatus(`Safe. You can cash out at x${payload.result.multiplier.toFixed(2)}.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to reveal tile");
      }
      return;
    }

    const response = await fetch("/api/games/mines/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: round.roundId, tileIndex }),
    });
    const payload = (await response.json()) as MinesResponse;

    if (!response.ok || !payload.result) {
      setStatus(payload.error ?? "Не удалось открыть клетку");
      return;
    }

    if (payload.result.hitMine) {
      setStatus(`Тебя наебали на 500 рубасов. Раунд проигран на x${payload.result.multiplier.toFixed(2)}.`);
      setRevealedMines(payload.result.revealAllMines ?? []);
      setRound(null);
      return;
    }

    setRound((current) =>
      current
        ? {
            ...current,
            revealedSafeIndexes: payload.result?.revealedSafeIndexes ?? current.revealedSafeIndexes,
          }
        : current,
    );
    setStatus(`Безопасно. Можно выводить по x${payload.result.multiplier.toFixed(2)}.`);
  }

  async function cashout() {
    if (!round) {
      return;
    }

    if (isStaticExport) {
      try {
        const payload = staticCashoutMines({ game, roundId: round.roundId });
        if (!payload.result) {
          throw new Error("Failed to cash out");
        }

        setStatus(`Cashed out ${formatCoins(payload.result.payout ?? 0)} coins at x${payload.result.multiplier.toFixed(2)}.`);
        setRound(null);
        setRevealedMines([]);
        await refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to cash out");
      }
      return;
    }

    const response = await fetch("/api/games/mines/cashout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: round.roundId }),
    });
    const payload = (await response.json()) as MinesResponse;

    if (!response.ok || !payload.result) {
      setStatus(payload.error ?? "Не удалось вывести выигрыш");
      return;
    }

    setStatus(`Выведено ${formatCoins(payload.result.payout ?? 0)} монет на x${payload.result.multiplier.toFixed(2)}.`);
    setRound(null);
    setRevealedMines([]);
    await refresh();
  }

  const totalTiles = game.config.boardSize * game.config.boardSize;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Поле шавермы</p>
          <h2 className="font-display text-4xl">{game.title}</h2>
        </div>

        <div className="grid grid-cols-5 gap-3 rounded-[32px] border border-white/10 bg-black/25 p-4">
          {Array.from({ length: totalTiles }, (_, tileIndex) => {
            const isSafe = round?.revealedSafeIndexes.includes(tileIndex);
            const isMine = revealedMines.includes(tileIndex);
            return (
              <button
                key={tileIndex}
                type="button"
                disabled={!round || isSafe || isMine}
                onClick={() => void reveal(tileIndex)}
                className={`aspect-square rounded-[24px] border text-sm font-semibold transition ${
                  isMine
                    ? "border-rose-300/30 bg-rose-500/30 text-rose-100"
                    : isSafe
                      ? "border-emerald-300/25 bg-emerald-500/25 text-emerald-100"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:border-amber-200/30 hover:bg-amber-300/10 hover:text-white"
                }`}
              >
                {isMine ? <img src={BadMine.src} /> : isSafe ? <img src={GoodMine.src} /> : tileIndex + 1}
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">{status}</div>
      </Panel>

      <Panel className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Правила хранилища</p>
          <h3 className="mt-2 font-display text-3xl">Прогрессивный вывод</h3>
          <p className="mt-2 text-sm text-zinc-400">Мины остаются на сервере до момента открытия через API. Можно забирать выигрыш после любой безопасной серии.</p>
        </div>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Ставка</span>
          <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" type="number" value={stakeInput} onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue === "") {
              setStakeInput("");
              return;
            }
            const parsed = Number(nextValue);
            if (!Number.isFinite(parsed)) {
              return;
            }
            setStakeInput(String(parsed));
          }} />
        </label>
        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Количество мин</span>
          <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" type="number" min={game.config.minMines} max={game.config.maxMines} value={minesCount} onChange={(event) => setMinesCount(Number(event.target.value))} />
        </label>

        <Button className="w-full py-3 text-base" disabled={loading || !!round || !user} onClick={() => void start()}>
          {loading ? "Подготавливаем поле..." : "Старт поля"}
        </Button>
        <Button className="w-full py-3 text-base" variant="secondary" disabled={!round || round.revealedSafeIndexes.length === 0} onClick={() => void cashout()}>
          Вывести x{currentMultiplier.toFixed(2)}
        </Button>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
          <p className="font-semibold text-white">Текущий множитель</p>
          <p className="mt-2 font-display text-4xl text-amber-200">x{currentMultiplier.toFixed(2)}</p>
        </div>
      </Panel>
    </div>
  );
}
