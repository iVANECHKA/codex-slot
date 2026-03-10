"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrashGameDefinition } from "@/lib/casino/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useSession } from "@/components/providers/session-provider";
import { formatCoins } from "@/lib/utils";
import {
  CRASH_PREP_DELAY_MS,
  elapsedToReachMultiplier,
  multiplierAtElapsed,
} from "@/lib/casino/engines/crash-engine";
import { staticCashoutCrash, staticStartCrashRound } from "@/lib/static-export-demo";
import Jetpack from "../../../public/jetpack.png"

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

interface LockedCashout {
  payout: number;
  multiplier: number;
}

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function CrashStudio({ game }: { game: CrashGameDefinition }) {
  const { user, refresh } = useSession();
  const [stakeInput, setStakeInput] = useState("20");
  const [autoCashoutInput, setAutoCashoutInput] = useState("2");
  const [round, setRound] = useState<CrashRoundResponse["round"] | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [lockedCashout, setLockedCashout] = useState<LockedCashout | null>(null);
  const [status, setStatus] = useState("Начало нового раунда");
  const [loading, setLoading] = useState(false);

  const cashout = useCallback(async (roundId?: string, options?: { keepFlight?: boolean }) => {
    const targetRoundId = roundId ?? round?.roundId;
    if (!targetRoundId) {
      return;
    }

    if (isStaticExport) {
      try {
        const payload = staticCashoutCrash({ game, roundId: targetRoundId });
        if (!payload.result) {
          throw new Error("Не получилось вывести");
        }

        if (options?.keepFlight) {
          setLockedCashout({
            payout: payload.result.payout,
            multiplier: payload.result.multiplier,
          });
          setStatus(`Автовывод сработал на x${payload.result.multiplier.toFixed(2)}. Полет продолжается.`);
          await refresh();
          return;
        }

        setStatus(
          payload.result.busted
            ? `Слишком поздно. Крашнулось на x${payload.result.multiplier.toFixed(2)}.`
            : `Вывод ${formatCoins(payload.result.payout)} монет на x${payload.result.multiplier.toFixed(2)}.`,
        );
        setRound(null);
        setMultiplier(payload.result.multiplier);
        setLastPayout(payload.result.payout);
        setLockedCashout(null);
        setElapsedMs(0);
        await refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Не получилось вывести");
      }
      return;
    }

    const response = await fetch("/api/games/crash/cashout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: targetRoundId }),
    });
    const payload = (await response.json()) as CrashRoundResponse;

    if (!response.ok || !payload.result) {
      setStatus(payload.error ?? "Не получилось забрать ставку");
      return;
    }

    if (options?.keepFlight) {
      setLockedCashout({
        payout: payload.result.payout,
        multiplier: payload.result.multiplier,
      });
      setStatus(`Автовывод сработал на x${payload.result.multiplier.toFixed(2)}. Полёт продолжается.`);
      await refresh();
      return;
    }

    setStatus(
      payload.result.busted
        ? `Сликшом поздно. Крашнулось на x${payload.result.multiplier.toFixed(2)}.`
        : `Вывод ${formatCoins(payload.result.payout)} монет на x${payload.result.multiplier.toFixed(2)}.`,
    );
    setRound(null);
    setMultiplier(payload.result.multiplier);
    setLastPayout(payload.result.payout);
    setLockedCashout(null);
    setElapsedMs(0);
    await refresh();
  }, [game, refresh, round?.roundId]);

  useEffect(() => {
    if (!round) {
      return;
    }

    let autoCashoutRequested = false;
    const timer = window.setInterval(() => {
      const currentElapsed = Date.now() - new Date(round.startedAt).getTime();
      setElapsedMs(currentElapsed);

      const next = multiplierAtElapsed(currentElapsed, game.config.growthFactor);
      setMultiplier(next);

      if (
        round.autoCashout &&
        !autoCashoutRequested &&
        !lockedCashout &&
        next >= round.autoCashout &&
        next < round.bustPoint
      ) {
        autoCashoutRequested = true;
        void cashout(round.roundId, { keepFlight: true });
      }

      if (next >= round.bustPoint) {
        const securedPayout = lockedCashout?.payout ?? 0;

        if (isStaticExport && !lockedCashout) {
          void cashout(round.roundId);
          return;
        }

        setStatus(
          lockedCashout
            ? `Крашнулось на x${round.bustPoint.toFixed(2)}. Автовывод сработал на x${lockedCashout.multiplier.toFixed(2)}.`
            : `Крашнулось на x${round.bustPoint.toFixed(2)}.`,
        );
        setRound(null);
        setMultiplier(round.bustPoint);
        setLastPayout(securedPayout);
        setLockedCashout(null);
        setElapsedMs(0);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [cashout, game.config.growthFactor, lockedCashout, round]);

  const roundDurationMs = useMemo(() => {
    if (!round) {
      return 1;
    }

    return elapsedToReachMultiplier(round.bustPoint, game.config.growthFactor);
  }, [game.config.growthFactor, round]);

  const activeDurationMs = useMemo(
    () => Math.max(1, roundDurationMs - CRASH_PREP_DELAY_MS),
    [roundDurationMs],
  );

  const flightProgress = useMemo(() => {
    if (!round) {
      return 0;
    }

    const activeElapsedMs = Math.max(0, elapsedMs - CRASH_PREP_DELAY_MS);
    return clamp(activeElapsedMs / activeDurationMs, 0, 1);
  }, [activeDurationMs, elapsedMs, round]);

  const progress = useMemo(() => {
    if (!round) {
      return 0;
    }

    return flightProgress * 100;
  }, [flightProgress, round]);

  const pilotPosition = useMemo(() => {
    const x = 8 + flightProgress * 84;
    const y = 8 + flightProgress * 74;

    return {
      left: `${x}%`,
      bottom: `${y}%`,
      rotation: 12 + flightProgress * 24,
    };
  }, [flightProgress]);

  const displayedWin = useMemo(() => {
    if (round && lockedCashout) {
      return lockedCashout.payout;
    }
    if (round) {
      return Number((round.stake * multiplier).toFixed(2));
    }
    return lastPayout;
  }, [lastPayout, lockedCashout, multiplier, round]);

  const winCaption = round
    ? lockedCashout
      ? "Locked Win"
      : "Current Win"
    : "Round Result";

  async function start() {
    const parsedStake = Number(stakeInput);
    if (!Number.isFinite(parsedStake) || parsedStake < 10) {
      setStatus("Stake must be at least 10.");
      return;
    }

    const normalizedAutoCashout = autoCashoutInput.replace(",", ".");
    const parsedAutoCashout = Number(normalizedAutoCashout);
    if (!Number.isFinite(parsedAutoCashout) || parsedAutoCashout < 1.1) {
      setStatus("Auto cashout must be at least 1.1.");
      return;
    }

    if (isStaticExport) {
      setLoading(true);
      try {
        const payload = staticStartCrashRound({ game, stake: parsedStake, autoCashout: parsedAutoCashout });
        if (!payload.round) {
          throw new Error("Failed to start crash round");
        }

        setRound(payload.round);
        setMultiplier(1);
        setElapsedMs(0);
        setLastPayout(null);
        setLockedCashout(null);
        setStatus(`Раунд начался. Public seed: ${payload.round.roundId.slice(0, 8)}.`);
        await refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to start crash round");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const response = await fetch("/api/games/crash/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: game.slug, stake: parsedStake, autoCashout: parsedAutoCashout }),
    });
    const payload = (await response.json()) as CrashRoundResponse;
    setLoading(false);

    if (!response.ok || !payload.round) {
      setStatus(payload.error ?? "Failed to start crash round");
      return;
    }

    setRound(payload.round);
    setMultiplier(1);
    setElapsedMs(0);
    setLastPayout(null);
    setLockedCashout(null);
    setStatus(`Раунд начался. Public seed: ${payload.round.roundId.slice(0, 8)}.`);
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="space-y-6 overflow-hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Crash Field</p>
          <h2 className="font-display text-4xl">{game.title}</h2>
        </div>

        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_15%_100%,rgba(14,116,144,0.3),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(251,191,36,0.25),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute left-8 right-8 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
            <div className="absolute bottom-8 left-10 right-10 h-[2px] origin-left rotate-[-29deg] bg-gradient-to-r from-cyan-300/20 via-amber-300/70 to-rose-400/20" />
          </div>

          <div
            className="pointer-events-none absolute h-9 w-9 rounded-full bg-amber-300/30 blur-xl transition-all duration-100"
            style={{
              left: pilotPosition.left,
              bottom: pilotPosition.bottom,
              transform: "translate(-50%, 50%)",
            }}
          />

          <div
            className="absolute z-10 flex h-11 w-11 items-center justify-center transition-all duration-100"
            style={{
              left: pilotPosition.left,
              bottom: pilotPosition.bottom,
              transform: `translate(-50%, 50%) rotate(${pilotPosition.rotation.toFixed(1)}deg)`,
            }}
          >
            <img src={Jetpack.src} alt="Jetpack" />
          </div>

          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="font-display text-7xl text-white drop-shadow-[0_6px_28px_rgba(250,204,21,0.25)] sm:text-8xl">
              x{multiplier.toFixed(2)}
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-5 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.26em] text-emerald-200/80">{winCaption}</p>
              <p className="mt-1 font-display text-3xl text-emerald-200">
                {displayedWin === null ? "-" : `${formatCoins(displayedWin)} coins`}
              </p>
            </div>
          </div>

          <div className="absolute inset-x-6 bottom-6 h-2 rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-300 to-rose-500 transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">{status}</div>
      </Panel>

      <Panel className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Solo Round</p>
          <h3 className="mt-2 font-display text-3xl">Flight Control</h3>
          <p className="mt-2 text-sm text-zinc-400">
            2-second pre-launch pause, then multiplier, bar, and pilot move in sync.
          </p>
        </div>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Stake</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
            type="number"
            value={stakeInput}
            min={10}
            onChange={(event) => {
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
            }}
          />
        </label>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Auto Cashout</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
            type="number"
            value={autoCashoutInput}
            step="0.1"
            min="1.1"
            onChange={(event) => {
              const nextValue = event.target.value;
              if (nextValue === "") {
                setAutoCashoutInput("");
                return;
              }
              const normalized = nextValue.replace(",", ".");
              if (!/^\d*\.?\d*$/.test(normalized)) {
                return;
              }
              setAutoCashoutInput(normalized);
            }}
          />
        </label>

        <Button className="w-full py-3 text-base" disabled={loading || !!round || !user} onClick={() => void start()}>
          {loading ? "Launching..." : "Start Round"}
        </Button>
        <Button
          className="w-full py-3 text-base"
          variant="secondary"
          disabled={!round || !!lockedCashout}
          onClick={() => void cashout()}
        >
          {lockedCashout ? "Cashout Locked" : "Cash Out Now"}
        </Button>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
          <p className="font-semibold text-white">Crash Params</p>
          <ul className="mt-3 space-y-2 text-zinc-400">
            <li>House edge: {(game.config.houseEdge * 100).toFixed(1)}%</li>
            <li>Growth factor: {game.config.growthFactor}</li>
            <li>Max multiplier: x{game.config.maxMultiplier}</li>
          </ul>
        </div>
      </Panel>
    </div>
  );
}
