"use client";

import { gsap } from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { SlotGameDefinition } from "@/lib/casino/types";
import { staticPlaySlot } from "@/lib/static-export-demo";
import { formatCoins } from "@/lib/utils";
import { SlotAudioEngine } from "@/lib/slots/audio-engine";
import {
  ROYAL_HEIST_PAYLINES_20,
  type SlotLineWin,
  type SlotSpinOutcome,
  type SlotSymbolCode,
  type WinTier,
} from "@/lib/slots/demo-engine";
import { createInitialRoyalHeistGrid } from "@/lib/slots/demo-engine";
import { SlotPixiScene } from "@/lib/slots/pixi-slot-scene";

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

interface SlotApiLineWin {
  lineIndex: number;
  symbol: string;
  count: number;
  payout: number;
}

interface SlotApiResult {
  result?: {
    roundId: string;
    payout: number;
    balance: number;
    grid: string[][];
    lineWins: SlotApiLineWin[];
    bonusMultiplier: number;
  };
  error?: string;
}

function tierLabel(tier: WinTier) {
  if (tier === "small") {
    return "SMALL WIN";
  }
  if (tier === "big") {
    return "BIG WIN";
  }
  if (tier === "mega") {
    return "MEGA WIN";
  }
  return "NO WIN";
}

function tierTextClass(tier: WinTier) {
  if (tier === "mega") {
    return "text-[color:#ffd166]";
  }
  if (tier === "big") {
    return "text-[color:#ff9f5a]";
  }
  if (tier === "small") {
    return "text-[color:#86efac]";
  }
  return "text-zinc-400";
}

function resolveTier(totalMultiplier: number): WinTier {
  if (totalMultiplier >= 20) {
    return "mega";
  }
  if (totalMultiplier >= 8) {
    return "big";
  }
  if (totalMultiplier > 0) {
    return "small";
  }
  return "none";
}

function mapSymbolCode(code: string): SlotSymbolCode {
  if (code === "W") {
    return "wild";
  }
  if (code === "S") {
    return "scatter";
  }
  if (code === "K") {
    return "crown";
  }
  if (code === "Q") {
    return "star";
  }
  if (code === "J") {
    return "bar";
  }
  if (code === "A") {
    return "gem";
  }
  return "seven";
}

function buildSpinStatus(outcome: SlotSpinOutcome) {
  if (outcome.tier === "mega") {
    return `MEGA WIN x${outcome.totalMultiplier.toFixed(2)}! Линии: ${outcome.lineWins.length}, scatter: ${outcome.scatterCount}.`;
  }

  if (outcome.tier === "big") {
    return `BIG WIN x${outcome.totalMultiplier.toFixed(2)}! Линии: ${outcome.lineWins.length}.`;
  }

  if (outcome.tier === "small") {
    return `Small win x${outcome.totalMultiplier.toFixed(2)}.`;
  }

  return "Без выплаты. Пробуем следующий спин.";
}

function mapLineWins(lineWins: SlotApiLineWin[]): SlotLineWin[] {
  return lineWins.map((lineWin) => {
    const line = ROYAL_HEIST_PAYLINES_20[lineWin.lineIndex] ?? ROYAL_HEIST_PAYLINES_20[0];
    const count = Math.min(5, Math.max(3, lineWin.count)) as 3 | 4 | 5;

    return {
      lineIndex: lineWin.lineIndex,
      symbol: mapSymbolCode(lineWin.symbol),
      count,
      multiplier: 0,
      payout: lineWin.payout,
      positions: Array.from({ length: count }, (_, index) => ({
        reel: index,
        row: line[index],
      })),
    };
  });
}

function mapOutcomeFromApi(stake: number, result: NonNullable<SlotApiResult["result"]>): SlotSpinOutcome {
  const grid = result.grid.map((row) => row.map((code) => mapSymbolCode(code)));
  const lineWins = mapLineWins(result.lineWins);
  const scatterCount = result.grid.flat().reduce((count, code) => (code === "S" ? count + 1 : count), 0);
  const totalMultiplier = stake > 0 ? Number((result.payout / stake).toFixed(2)) : 0;

  return {
    seed: result.roundId,
    stake,
    lineStake: Number((stake / ROYAL_HEIST_PAYLINES_20.length).toFixed(4)),
    stops: [0, 0, 0, 0, 0],
    grid,
    lineWins,
    scatterCount,
    scatterPayout: Number((result.bonusMultiplier * stake).toFixed(2)),
    payout: result.payout,
    totalMultiplier,
    tier: resolveTier(totalMultiplier),
  };
}

export function SlotStudio({ game }: { game: SlotGameDefinition }) {
  const { user, refresh } = useSession();

  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const stageSceneRef = useRef<SlotPixiScene | null>(null);
  const audioRef = useRef<SlotAudioEngine | null>(null);

  const autoSpinTimeoutRef = useRef<number | null>(null);
  const runSpinRef = useRef<(() => Promise<void>) | null>(null);
  const creditsTweenRef = useRef<gsap.core.Tween | null>(null);
  const winTweenRef = useRef<gsap.core.Tween | null>(null);

  const spinningRef = useRef(false);
  const autoSpinRef = useRef(false);
  const balanceRef = useRef(0);
  const displayedCreditsRef = useRef(0);

  const [stakeInput, setStakeInput] = useState("20");
  const [displayedCredits, setDisplayedCredits] = useState(0);
  const [displayedWin, setDisplayedWin] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [lastTier, setLastTier] = useState<WinTier>("none");
  const [multiplier, setMultiplier] = useState(0);
  const [status, setStatus] = useState("Слот готов. Результат определяется до старта анимации.");
  const [autoSpin, setAutoSpin] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const linesCount = useMemo(() => {
    return game.config.paylines.length >= 20 ? game.config.paylines.length : ROYAL_HEIST_PAYLINES_20.length;
  }, [game.config.paylines.length]);

  useEffect(() => {
    const nextBalance = Number(user?.balance ?? 0);
    balanceRef.current = nextBalance;

    creditsTweenRef.current?.kill();
    const animated = { value: displayedCreditsRef.current };
    creditsTweenRef.current = gsap.to(animated, {
      value: nextBalance,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        const value = Number(animated.value.toFixed(2));
        displayedCreditsRef.current = value;
        setDisplayedCredits(value);
      },
    });
  }, [user?.balance]);

  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) {
      return;
    }

    const audio = new SlotAudioEngine();
    audioRef.current = audio;

    const onFirstPointer = () => {
      void audio.unlock().then(() => {
        audio.startMusic();
      });
    };

    window.addEventListener("pointerdown", onFirstPointer, { once: true });

    let active = true;

    void SlotPixiScene.create(host, {
      onSpinStart: () => {
        audio.startSpinLoop();
      },
      onReelStop: (reelIndex) => {
        audio.playReelStop(reelIndex);
      },
      onSpinEnd: () => {
        audio.stopSpinLoop();
      },
    }).then((scene) => {
      if (!active) {
        scene.destroy();
        return;
      }

      stageSceneRef.current = scene;
      scene.setGrid(createInitialRoyalHeistGrid());
    });

    return () => {
      active = false;
      window.removeEventListener("pointerdown", onFirstPointer);

      if (autoSpinTimeoutRef.current !== null) {
        window.clearTimeout(autoSpinTimeoutRef.current);
      }

      creditsTweenRef.current?.kill();
      winTweenRef.current?.kill();

      stageSceneRef.current?.destroy();
      stageSceneRef.current = null;

      audio.destroy();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(!soundEnabled);
  }, [soundEnabled]);

  const animateWinWindow = useCallback((targetWin: number, tier: WinTier) => {
    winTweenRef.current?.kill();

    if (targetWin <= 0) {
      setDisplayedWin(0);
      return;
    }

    const animated = { value: 0 };
    winTweenRef.current = gsap.to(animated, {
      value: targetWin,
      duration: tier === "mega" ? 2 : tier === "big" ? 1.35 : 0.85,
      ease: "power2.out",
      onUpdate: () => {
        setDisplayedWin(Number(animated.value.toFixed(2)));
      },
    });
  }, []);

  const runSpin = useCallback(async () => {
    if (spinningRef.current) {
      return;
    }

    const scene = stageSceneRef.current;
    if (!scene) {
      return;
    }

    if (!user) {
      setStatus("Нужно войти в аккаунт, чтобы крутить слот.");
      return;
    }

    const parsedStake = Number(stakeInput);
    if (!Number.isFinite(parsedStake)) {
      setStatus("Введите корректную ставку.");
      return;
    }

    if (parsedStake < game.config.minBet || parsedStake > game.config.maxBet) {
      setStatus(`Ставка должна быть от ${game.config.minBet} до ${game.config.maxBet}.`);
      return;
    }

    const currentBalance = balanceRef.current;
    if (currentBalance < parsedStake) {
      setStatus("Недостаточно средств на общем балансе.");
      setAutoSpin(false);
      autoSpinRef.current = false;
      return;
    }

    spinningRef.current = true;
    setSpinning(true);

    const audio = audioRef.current;
    void audio?.unlock();
    audio?.startMusic();
    audio?.playButton();

    let payload: SlotApiResult;

    if (isStaticExport) {
      payload = staticPlaySlot({ game, stake: parsedStake, bonus: false });
    } else {
      const response = await fetch("/api/games/slots/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: game.slug, stake: parsedStake }),
      });

      payload = (await response.json()) as SlotApiResult;
      if (!response.ok || payload.error || !payload.result) {
        setStatus(payload.error ?? "Не удалось выполнить спин.");
        spinningRef.current = false;
        setSpinning(false);
        return;
      }
    }

    if (!payload.result) {
      setStatus(payload.error ?? "Не удалось выполнить спин.");
      spinningRef.current = false;
      setSpinning(false);
      return;
    }

    const outcome = mapOutcomeFromApi(parsedStake, payload.result);
    await scene.spin(outcome);

    const nextBalance = Number(payload.result.balance.toFixed(2));
    balanceRef.current = nextBalance;

    creditsTweenRef.current?.kill();
    const creditTween = { value: displayedCreditsRef.current };
    creditsTweenRef.current = gsap.to(creditTween, {
      value: nextBalance,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        const value = Number(creditTween.value.toFixed(2));
        displayedCreditsRef.current = value;
        setDisplayedCredits(value);
      },
    });

    setLastWin(outcome.payout);
    setMultiplier(outcome.totalMultiplier);
    setLastTier(outcome.tier);
    setStatus(buildSpinStatus(outcome));
    animateWinWindow(outcome.payout, outcome.tier);

    if (outcome.tier !== "none") {
      audio?.playWin(outcome.tier);
    }

    await refresh();

    spinningRef.current = false;
    setSpinning(false);

    if (!autoSpinRef.current) {
      return;
    }

    if (nextBalance < parsedStake) {
      setAutoSpin(false);
      autoSpinRef.current = false;
      setStatus("Авто-режим остановлен: не хватает средств на общем балансе.");
      return;
    }

    autoSpinTimeoutRef.current = window.setTimeout(() => {
      void runSpinRef.current?.();
    }, 650);
  }, [animateWinWindow, game, refresh, stakeInput, user]);

  useEffect(() => {
    runSpinRef.current = runSpin;
  }, [runSpin]);

  return (
    <div className="space-y-4 pb-28 sm:pb-0">      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel className="space-y-5 border-amber-200/10 bg-[radial-gradient(circle_at_30%_10%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_90%_95%,rgba(14,165,233,0.18),transparent_35%),linear-gradient(165deg,rgba(21,11,52,0.95),rgba(11,5,31,0.9))] p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">Neon Casino Demo</p>
            <h2 className="font-display text-3xl text-white sm:text-4xl">{game.title}</h2>
          </div>
          <div className="rounded-full border border-amber-200/30 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
            {linesCount} lines
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-cyan-200/20 bg-[radial-gradient(circle_at_20%_5%,rgba(34,211,238,0.22),transparent_33%),radial-gradient(circle_at_85%_95%,rgba(251,191,36,0.2),transparent_35%),linear-gradient(180deg,#12082e,#050311)] p-2">
          <div ref={stageHostRef} className="h-[330px] w-full sm:h-[460px]" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-200/70">Balance</p>
            <p className="mt-1 font-display text-2xl leading-none text-emerald-200">{formatCoins(displayedCredits)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Win</p>
            <p className={`mt-1 font-display text-2xl leading-none ${tierTextClass(lastTier)}`}>{formatCoins(displayedWin)}</p>
            <p className="mt-1 text-[10px] text-zinc-400">x{multiplier.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-200">
          <p>{status}</p>
        </div>
      </Panel>

      <Panel id="slot-controls" className="space-y-5 border-amber-200/10 bg-[radial-gradient(circle_at_75%_10%,rgba(251,191,36,0.16),transparent_38%),linear-gradient(160deg,rgba(24,11,60,0.95),rgba(8,4,24,0.95))]">
        <div className="hidden rounded-3xl border border-emerald-300/35 bg-emerald-500/10 p-4 sm:block">
          <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-200/80">Demo Credits</p>
          <p className="mt-2 font-display text-4xl text-emerald-200">{formatCoins(displayedCredits)}</p>
        </div>

        <div className="hidden rounded-3xl border border-white/10 bg-black/25 p-4 sm:block">
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Win Window</p>
          <p className={`mt-2 font-display text-4xl ${tierTextClass(lastTier)}`}>{tierLabel(lastTier)}</p>
          <p className="mt-1 font-display text-3xl text-white">{formatCoins(displayedWin)}</p>
          <p className="mt-2 text-sm text-zinc-400">Последний выигрыш: {formatCoins(lastWin)} | x{multiplier.toFixed(2)}</p>
        </div>

        <label className="block space-y-2 text-sm text-zinc-300">
          <span>Ставка</span>
          <input
            type="number"
            min={game.config.minBet}
            max={game.config.maxBet}
            value={stakeInput}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "") {
                setStakeInput("");
                return;
              }

              const parsed = Number(value);
              if (!Number.isFinite(parsed)) {
                return;
              }

              setStakeInput(String(parsed));
            }}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-300/60"
          />
        </label>

        <div className="grid grid-cols-4 gap-2">
          {[10, 20, 50, 100].map((value) => (
            <Button key={value} variant="secondary" onClick={() => setStakeInput(String(value))}>
              {value}
            </Button>
          ))}
        </div>

        <Button
          className="w-full py-4 text-lg"
          disabled={spinning || !user}
          onClick={() => {
            void runSpin();
          }}
        >
          {spinning ? "SPINNING..." : "SPIN"}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={autoSpin ? "primary" : "secondary"}
            className="py-3"
            disabled={!user}
            onClick={() => {
              const nextValue = !autoSpinRef.current;
              autoSpinRef.current = nextValue;
              setAutoSpin(nextValue);

              if (!nextValue && autoSpinTimeoutRef.current !== null) {
                window.clearTimeout(autoSpinTimeoutRef.current);
                autoSpinTimeoutRef.current = null;
                return;
              }

              if (nextValue && !spinningRef.current) {
                void runSpinRef.current?.();
              }
            }}
          >
            {autoSpin ? "AUTO ON" : "AUTO"}
          </Button>

          <Button
            variant={soundEnabled ? "secondary" : "ghost"}
            className="py-3"
            onClick={() => {
              setSoundEnabled((current) => !current);
            }}
          >
            {soundEnabled ? "SOUND ON" : "SOUND OFF"}
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            void refresh();
            setStatus("Баланс обновлён из профиля.");
          }}
        >
          Refresh Balance
        </Button>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
          <p className="font-semibold text-white">Win Tiers</p>
          <ul className="mt-3 space-y-2 text-zinc-400">
            <li>Small win: x0.01 - x7.99</li>
            <li>Big win: x8.00 - x19.99</li>
            <li>Mega win: x20.00+</li>
          </ul>
        </div>
      </Panel>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 sm:hidden">
        <div className="rounded-2xl border border-cyan-200/25 bg-[linear-gradient(160deg,rgba(18,8,46,0.96),rgba(8,4,24,0.96))] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="mb-2 flex items-center justify-between px-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
            <span>Stake {stakeInput || "-"}</span>
            <button
              type="button"
              className="rounded-full border border-white/20 px-3 py-1 text-[10px] tracking-[0.18em]"
              onClick={() => {
                document.getElementById("slot-controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Bet
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={autoSpin ? "primary" : "secondary"}
              className="py-3"
              disabled={!user}
              onClick={() => {
                const nextValue = !autoSpinRef.current;
                autoSpinRef.current = nextValue;
                setAutoSpin(nextValue);

                if (!nextValue && autoSpinTimeoutRef.current !== null) {
                  window.clearTimeout(autoSpinTimeoutRef.current);
                  autoSpinTimeoutRef.current = null;
                  return;
                }

                if (nextValue && !spinningRef.current) {
                  void runSpinRef.current?.();
                }
              }}
            >
              {autoSpin ? "AUTO ON" : "AUTO"}
            </Button>

            <Button
              className="py-3 text-base"
              disabled={spinning || !user}
              onClick={() => {
                void runSpin();
              }}
            >
              {spinning ? "SPINNING..." : "SPIN"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}




