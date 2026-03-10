"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrashGameDefinition } from "@/lib/casino/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useSession } from "@/components/providers/session-provider";
import { formatCoins } from "@/lib/utils";
import { multiplierAtElapsed } from "@/lib/casino/engines/crash-engine";

interface CrashRoundResponse {
  round?: {
    roundId: string;
    stake: number;
    bustPoint: number;
    startedAt: string;
    autoCashout?: number;
  };
  result?: {
    roundId: string;
    busted: boolean;
    payout: number;
    multiplier: number;
    balance: number;
  };
  error?: string;
}

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export function CrashStudio({ game }: { game: CrashGameDefinition }) {
  const { user, refresh } = useSession();
  const [stake, setStake] = useState(20);
  const [autoCashout, setAutoCashout] = useState(2);
  const [round, setRound] = useState<CrashRoundResponse["round"] | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [status, setStatus] = useState("Запусти новый сольный раунд.");
  const [loading, setLoading] = useState(false);

  const cashout = useCallback(async (roundId?: string) => {
    const targetRoundId = roundId ?? round?.roundId;
    if (!targetRoundId) {
      return;
    }

    if (isStaticExport) {
      setStatus("Backend API is unavailable on GitHub Pages.");
      return;
    }

    const response = await fetch("/api/games/crash/cashout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: targetRoundId }),
    });
    const payload = (await response.json()) as CrashRoundResponse;

    if (!response.ok || !payload.result) {
      setStatus(payload.error ?? "Не удалось вывести ставку");
      return;
    }

    setStatus(
      payload.result.busted
        ? `Поздно. Ракета упала на x${payload.result.multiplier.toFixed(2)}.`
        : `Выведено ${formatCoins(payload.result.payout)} монет на x${payload.result.multiplier.toFixed(2)}.`,
    );
    setRound(null);
    setMultiplier(1);
    await refresh();
  }, [refresh, round?.roundId]);

  useEffect(() => {
    if (!round) {
      return;
    }

    let autoCashoutRequested = false;
    const timer = window.setInterval(() => {
      const next = multiplierAtElapsed(Date.now() - new Date(round.startedAt).getTime(), game.config.growthFactor);
      setMultiplier(next);

      if (round.autoCashout && !autoCashoutRequested && next >= round.autoCashout && next < round.bustPoint) {
        autoCashoutRequested = true;
        void cashout(round.roundId);
      }

      if (next >= round.bustPoint) {
        setStatus(`Краш на x${round.bustPoint.toFixed(2)}`);
        setRound(null);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [cashout, game.config.growthFactor, round]);

  const progress = useMemo(() => {
    if (!round) {
      return 4;
    }
    return Math.min(100, (multiplier / round.bustPoint) * 100);
  }, [multiplier, round]);

  async function start() {
    if (isStaticExport) {
      setStatus("Backend API is unavailable on GitHub Pages.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/games/crash/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: game.slug, stake, autoCashout }),
    });
    const payload = (await response.json()) as CrashRoundResponse;
    setLoading(false);

    if (!response.ok || !payload.round) {
      setStatus(payload.error ?? "Не удалось запустить краш-раунд");
      return;
    }

    setRound(payload.round);
    setMultiplier(1);
    setStatus(`Раунд запущен. Публичный seed: ${payload.round.roundId.slice(0, 8)}.`);
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="space-y-6 overflow-hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Краш-поле</p>
          <h2 className="font-display text-4xl">{game.title}</h2>
        </div>

        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_bottom,rgba(251,191,36,0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
          <div className="absolute inset-x-6 bottom-6 h-2 rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-500 to-rose-500 transition-[width] duration-75" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="font-display text-7xl text-white sm:text-8xl">x{multiplier.toFixed(2)}</div>
            <p className="mt-4 text-sm uppercase tracking-[0.3em] text-zinc-400">
              {round ? `Цель краша x${round.bustPoint.toFixed(2)}` : "Ожидание нового запуска"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">{status}</div>
      </Panel>

      <Panel className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Сольный раунд</p>
          <h3 className="mt-2 font-display text-3xl">Кривая риска</h3>
          <p className="mt-2 text-sm text-zinc-400">Точка краша рассчитывается на сервере по seed и edge-модели, а затем используется при расчете вывода.</p>
        </div>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Ставка</span>
          <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" type="number" value={stake} min={10} onChange={(event) => setStake(Number(event.target.value))} />
        </label>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Авто-вывод</span>
          <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" type="number" value={autoCashout} step="0.1" min="1.1" onChange={(event) => setAutoCashout(Number(event.target.value))} />
        </label>

        <Button className="w-full py-3 text-base" disabled={loading || !!round || !user} onClick={() => void start()}>
          {loading ? "Запуск..." : "Старт раунда"}
        </Button>
        <Button className="w-full py-3 text-base" variant="secondary" disabled={!round} onClick={() => void cashout()}>
          Вывести сейчас
        </Button>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
          <p className="font-semibold text-white">Параметры Crash</p>
          <ul className="mt-3 space-y-2 text-zinc-400">
            <li>Преимущество казино: {(game.config.houseEdge * 100).toFixed(1)}%</li>
            <li>Коэффициент роста: {game.config.growthFactor}</li>
            <li>Максимальный множитель: x{game.config.maxMultiplier}</li>
          </ul>
        </div>
      </Panel>
    </div>
  );
}