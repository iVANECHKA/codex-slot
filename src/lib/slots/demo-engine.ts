export const ROYAL_HEIST_PAYLINES_20: number[][] = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 2, 1, 2, 0],
];

export const SLOT_SYMBOLS = [
  "gem",
  "crown",
  "seven",
  "bar",
  "star",
  "scatter",
  "wild",
] as const;

export type SlotSymbolCode = (typeof SLOT_SYMBOLS)[number];
export type WinTier = "none" | "small" | "big" | "mega";

export interface SymbolPosition {
  reel: number;
  row: number;
}

export interface SlotLineWin {
  lineIndex: number;
  symbol: SlotSymbolCode;
  count: 3 | 4 | 5;
  multiplier: number;
  payout: number;
  positions: SymbolPosition[];
}

export interface SlotSpinOutcome {
  seed: string;
  stake: number;
  lineStake: number;
  stops: number[];
  grid: SlotSymbolCode[][];
  lineWins: SlotLineWin[];
  scatterCount: number;
  scatterPayout: number;
  payout: number;
  totalMultiplier: number;
  tier: WinTier;
}

const REEL_STRIPS: SlotSymbolCode[][] = [
  ["gem", "crown", "bar", "star", "seven", "wild", "gem", "scatter", "crown", "seven", "bar", "gem", "star", "crown", "wild", "seven", "gem", "bar", "star", "crown", "gem", "seven", "bar", "wild"],
  ["star", "gem", "bar", "seven", "crown", "scatter", "wild", "gem", "bar", "crown", "seven", "star", "gem", "wild", "bar", "crown", "gem", "seven", "star", "bar", "gem", "crown", "wild", "seven"],
  ["bar", "seven", "gem", "crown", "wild", "star", "scatter", "gem", "seven", "bar", "crown", "star", "wild", "gem", "bar", "seven", "crown", "gem", "star", "bar", "seven", "wild", "crown", "gem"],
  ["seven", "bar", "crown", "gem", "star", "wild", "bar", "scatter", "crown", "gem", "seven", "star", "bar", "wild", "crown", "gem", "seven", "bar", "star", "crown", "gem", "wild", "seven", "bar"],
  ["gem", "wild", "bar", "seven", "crown", "star", "scatter", "gem", "bar", "crown", "seven", "star", "wild", "gem", "bar", "crown", "gem", "seven", "star", "bar", "wild", "crown", "seven", "gem"],
];

const PAYTABLE: Record<SlotSymbolCode, Partial<Record<3 | 4 | 5, number>>> = {
  gem: { 3: 1.6, 4: 4.2, 5: 12 },
  crown: { 3: 2.5, 4: 7.5, 5: 22 },
  seven: { 3: 3.2, 4: 10, 5: 28 },
  bar: { 3: 2.2, 4: 6.8, 5: 19 },
  star: { 3: 1.8, 4: 5.1, 5: 14 },
  scatter: {},
  wild: { 3: 4, 4: 13, 5: 42 },
};

const SCATTER_PAYOUTS: Partial<Record<3 | 4 | 5, number>> = {
  3: 2,
  4: 8,
  5: 22,
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndex(rng: () => number, length: number) {
  return Math.floor(rng() * length);
}

function buildGrid(stops: number[]) {
  return Array.from({ length: 3 }, (_, rowIndex) =>
    REEL_STRIPS.map((strip, reelIndex) => {
      const stop = stops[reelIndex];
      return strip[(stop + rowIndex) % strip.length];
    }),
  );
}

function evaluatePayline(grid: SlotSymbolCode[][], line: number[], lineIndex: number, lineStake: number): SlotLineWin | null {
  const lineCodes = line.map((row, reelIndex) => grid[row][reelIndex]);
  const firstBase = lineCodes.find((code) => code !== "wild" && code !== "scatter");
  const baseSymbol = firstBase ?? (lineCodes[0] === "scatter" ? null : lineCodes[0]);

  if (!baseSymbol) {
    return null;
  }

  const positions: SymbolPosition[] = [];
  let count = 0;

  for (let reelIndex = 0; reelIndex < lineCodes.length; reelIndex += 1) {
    const code = lineCodes[reelIndex];
    if (code === baseSymbol || code === "wild") {
      count += 1;
      positions.push({ reel: reelIndex, row: line[reelIndex] });
      continue;
    }
    break;
  }

  if (count < 3) {
    return null;
  }

  const multiplier = PAYTABLE[baseSymbol][count as 3 | 4 | 5];
  if (!multiplier) {
    return null;
  }

  return {
    lineIndex,
    symbol: baseSymbol,
    count: count as 3 | 4 | 5,
    multiplier,
    payout: Number((lineStake * multiplier).toFixed(2)),
    positions,
  } satisfies SlotLineWin;
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

export function createInitialRoyalHeistGrid(seed = "royal-heist-initial") {
  const rng = createRng(seed);
  const stops = REEL_STRIPS.map((strip) => pickIndex(rng, strip.length));
  return buildGrid(stops);
}

export function createRoyalHeistSpin(input: {
  stake: number;
  seed?: string;
  paylines?: number[][];
}) {
  const stake = Number(input.stake.toFixed(2));
  const lines = input.paylines ?? ROYAL_HEIST_PAYLINES_20;
  const seed = input.seed ?? `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
  const rng = createRng(seed);

  const stops = REEL_STRIPS.map((strip) => pickIndex(rng, strip.length));
  const grid = buildGrid(stops);
  const lineStake = Number((stake / lines.length).toFixed(4));

  const lineWins: SlotLineWin[] = [];
  lines.forEach((line, index) => {
    const lineWin = evaluatePayline(grid, line, index, lineStake);
    if (lineWin) {
      lineWins.push(lineWin);
    }
  });

  const scatterCount = grid
    .flat()
    .reduce((count, code) => (code === "scatter" ? count + 1 : count), 0);

  const scatterMultiplier = (SCATTER_PAYOUTS[scatterCount as 3 | 4 | 5] ?? 0) * (scatterCount >= 3 ? 1 : 0);
  const scatterPayout = Number((stake * scatterMultiplier).toFixed(2));

  const linePayout = lineWins.reduce((sum, lineWin) => sum + lineWin.payout, 0);
  const payout = Number((linePayout + scatterPayout).toFixed(2));
  const totalMultiplier = stake > 0 ? Number((payout / stake).toFixed(2)) : 0;

  return {
    seed,
    stake,
    lineStake,
    stops,
    grid,
    lineWins,
    scatterCount,
    scatterPayout,
    payout,
    totalMultiplier,
    tier: resolveTier(totalMultiplier),
  } satisfies SlotSpinOutcome;
}


