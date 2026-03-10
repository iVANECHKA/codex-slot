import { createSeedBundle, createRng } from "@/lib/casino/rng";
import type { CrashGameDefinition } from "@/lib/casino/types";

export interface CrashRoundStart {
  seed: string;
  publicSeed: string;
  secretHash: string;
  bustPoint: number;
  autoCashout?: number;
}

export function multiplierAtElapsed(elapsedMs: number, growthFactor: number) {
  const seconds = elapsedMs / 1000;
  return Number((1 + growthFactor * seconds + 0.28 * seconds * seconds).toFixed(2));
}

export function createCrashRound(
  game: CrashGameDefinition,
  autoCashout?: number,
  seed?: string,
) {
  const bundle = createSeedBundle(seed);
  const rng = createRng(bundle.seed);
  const sample = Math.min(0.999999, Math.max(0.000001, rng()));
  const raw = (1 - game.config.houseEdge) / (1 - sample);
  const bustPoint = Number(
    Math.min(game.config.maxMultiplier, Math.max(1, raw)).toFixed(2),
  );

  return {
    ...bundle,
    bustPoint,
    autoCashout,
  } satisfies CrashRoundStart;
}

export function settleCrashCashout(input: {
  game: CrashGameDefinition;
  bustPoint: number;
  stake: number;
  startedAt: string;
}) {
  const elapsed = Date.now() - new Date(input.startedAt).getTime();
  const currentMultiplier = multiplierAtElapsed(elapsed, input.game.config.growthFactor);
  const cappedMultiplier = Math.min(currentMultiplier, input.bustPoint);
  const busted = cappedMultiplier >= input.bustPoint;

  return {
    busted,
    multiplier: Number(cappedMultiplier.toFixed(2)),
    payout: busted ? 0 : Number((input.stake * cappedMultiplier).toFixed(2)),
  };
}

