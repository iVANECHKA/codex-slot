import { createSeedBundle, createRng } from "@/lib/casino/rng";
import type { CrashGameDefinition } from "@/lib/casino/types";

export const CRASH_PREP_DELAY_MS = 2000;
export const CRASH_GROWTH_QUADRATIC = 0.28;

export interface CrashRoundStart {
  seed: string;
  publicSeed: string;
  secretHash: string;
  bustPoint: number;
  autoCashout?: number;
}

export function multiplierAtElapsed(elapsedMs: number, growthFactor: number) {
  const seconds = Math.max(0, elapsedMs - CRASH_PREP_DELAY_MS) / 1000;
  return Number((1 + growthFactor * seconds + CRASH_GROWTH_QUADRATIC * seconds * seconds).toFixed(2));
}

export function elapsedToReachMultiplier(multiplier: number, growthFactor: number) {
  if (multiplier <= 1) {
    return CRASH_PREP_DELAY_MS;
  }

  const a = CRASH_GROWTH_QUADRATIC;
  const b = growthFactor;
  const c = 1 - multiplier;
  const discriminant = Math.max(0, b * b - 4 * a * c);
  const seconds = (-b + Math.sqrt(discriminant)) / (2 * a);

  return CRASH_PREP_DELAY_MS + Math.max(0, seconds) * 1000;
}

export function createCrashRound(
  game: CrashGameDefinition,
  autoCashout?: number,
  seed?: string,
) {
  const bundle = createSeedBundle(seed);
  const rng = createRng(bundle.seed);

  // Classic provably-fair crash distribution with fixed house edge.
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
