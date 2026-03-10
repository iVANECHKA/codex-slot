import { createSeedBundle, createRng, pickIndex } from "@/lib/casino/rng";
import type { SlotGameDefinition, SlotSymbol } from "@/lib/casino/types";

export interface SlotLineWin {
  lineIndex: number;
  symbol: string;
  count: number;
  multiplier: number;
  payout: number;
}

export interface SlotSpinResult {
  seed: string;
  grid: string[][];
  payout: number;
  lineWins: SlotLineWin[];
  scatterCount: number;
  triggeredBonus: boolean;
  bonusMultiplier: number;
  stops: number[];
}

function getSymbolMap(symbols: SlotSymbol[]) {
  return new Map(symbols.map((symbol) => [symbol.code, symbol]));
}

function buildGrid(reels: string[][], rows: number, rng: () => number) {
  const stops = reels.map((strip) => pickIndex(rng, strip.length));
  const grid = Array.from({ length: rows }, (_, rowIndex) =>
    reels.map((strip, reelIndex) => {
      const stop = stops[reelIndex];
      return strip[(stop + rowIndex) % strip.length];
    }),
  );

  return { grid, stops };
}

function evaluateLine(grid: string[][], line: number[], symbols: Map<string, SlotSymbol>) {
  const codes = line.map((row, reelIndex) => grid[row][reelIndex]);
  const nonWild = codes.find((code) => !symbols.get(code)?.wild);
  const baseCode = nonWild ?? codes[0];
  const baseSymbol = symbols.get(baseCode);

  if (!baseSymbol || baseSymbol.scatter) {
    return null;
  }

  let count = 0;
  for (const code of codes) {
    const symbol = symbols.get(code);
    if (code === baseCode || symbol?.wild) {
      count += 1;
      continue;
    }
    break;
  }

  const multiplier = baseSymbol.payouts?.[count as 3 | 4 | 5];
  if (!multiplier) {
    return null;
  }

  return {
    symbol: baseCode,
    count,
    multiplier,
  };
}

function simulateBonusFeature(
  rng: () => number,
  stake: number,
  minMultiplier: number,
  maxMultiplier: number,
) {
  const swing = minMultiplier + rng() * (maxMultiplier - minMultiplier);
  return Number((swing * stake).toFixed(2));
}

export function spinSlot(game: SlotGameDefinition, stake: number, seed?: string) {
  const bundle = createSeedBundle(seed);
  const rng = createRng(bundle.seed);
  const symbols = getSymbolMap(game.config.symbols);
  const { grid, stops } = buildGrid(game.config.reels, game.config.rows, rng);
  const stakePerLine = stake / game.config.paylines.length;
  const lineWins: SlotLineWin[] = [];

  game.config.paylines.forEach((line, lineIndex) => {
    const match = evaluateLine(grid, line, symbols);
    if (!match) {
      return;
    }

    lineWins.push({
      lineIndex,
      symbol: match.symbol,
      count: match.count,
      multiplier: match.multiplier,
      payout: Number((stakePerLine * match.multiplier).toFixed(2)),
    });
  });

  const scatterSymbol = game.config.symbols.find((symbol) => symbol.scatter);
  const flatGrid = grid.flat();
  const scatterCount = scatterSymbol
    ? flatGrid.filter((code) => code === scatterSymbol.code).length
    : 0;

  const triggeredBonus = scatterCount >= 3;
  const bonusMultiplier = triggeredBonus
    ? Number((6 + rng() * 24).toFixed(2))
    : 0;

  const payout = Number(
    (
      lineWins.reduce((sum, lineWin) => sum + lineWin.payout, 0) +
      (triggeredBonus ? bonusMultiplier * stake : 0)
    ).toFixed(2),
  );

  return {
    ...bundle,
    payout,
    lineWins,
    grid,
    scatterCount,
    triggeredBonus,
    bonusMultiplier,
    stops,
  } satisfies SlotSpinResult & {
    publicSeed: string;
    secretHash: string;
  };
}

export function buySlotBonus(game: SlotGameDefinition, stake: number, seed?: string) {
  const bundle = createSeedBundle(seed);
  const rng = createRng(bundle.seed);
  const payout = simulateBonusFeature(
    rng,
    stake,
    game.config.bonusBuy.minMultiplier,
    game.config.bonusBuy.maxMultiplier,
  );
  const scatterCode = game.config.symbols.find((symbol) => symbol.scatter)?.code ?? "SC";
  const filler = game.config.symbols.find((symbol) => !symbol.scatter)?.code ?? "A";

  const grid = Array.from({ length: game.config.rows }, (_, rowIndex) =>
    Array.from({ length: 5 }, (_, reelIndex) => {
      if (rowIndex === 1 && reelIndex < 3) {
        return scatterCode;
      }
      return filler;
    }),
  );

  return {
    ...bundle,
    payout,
    lineWins: [],
    grid,
    scatterCount: 3,
    triggeredBonus: true,
    bonusMultiplier: Number((payout / stake).toFixed(2)),
    stops: [0, 0, 0, 0, 0],
  } satisfies SlotSpinResult & {
    publicSeed: string;
    secretHash: string;
  };
}

