import { createSeedBundle, createRng, pickIndex } from "@/lib/casino/rng";
import type { MinesGameDefinition } from "@/lib/casino/types";

export interface MinesBoardState {
  boardSize: number;
  mineIndexes: number[];
  revealedSafeIndexes: number[];
  minesCount: number;
}

export function calculateMinesMultiplier(
  boardSize: number,
  minesCount: number,
  safePicks: number,
  houseEdge: number,
) {
  if (safePicks === 0) {
    return 1;
  }

  let probability = 1;
  for (let pick = 0; pick < safePicks; pick += 1) {
    probability *= (boardSize * boardSize - minesCount - pick) / (boardSize * boardSize - pick);
  }

  return Number(((1 / probability) * (1 - houseEdge)).toFixed(2));
}

export function createMinesBoard(
  game: MinesGameDefinition,
  minesCount: number,
  seed?: string,
) {
  const bundle = createSeedBundle(seed);
  const rng = createRng(bundle.seed);
  const cells = Array.from({ length: game.config.boardSize * game.config.boardSize }, (_, index) => index);
  const mineIndexes: number[] = [];

  while (mineIndexes.length < minesCount) {
    const nextIndex = pickIndex(rng, cells.length);
    const [mine] = cells.splice(nextIndex, 1);
    mineIndexes.push(mine);
  }

  return {
    ...bundle,
    boardSize: game.config.boardSize,
    mineIndexes: mineIndexes.sort((left, right) => left - right),
    revealedSafeIndexes: [],
    minesCount,
  } satisfies MinesBoardState & {
    publicSeed: string;
    secretHash: string;
  };
}

export function revealMineTile(game: MinesGameDefinition, state: MinesBoardState, tileIndex: number) {
  const hitMine = state.mineIndexes.includes(tileIndex);
  const revealedSafeIndexes = hitMine
    ? state.revealedSafeIndexes
    : [...new Set([...state.revealedSafeIndexes, tileIndex])];
  const safePicks = revealedSafeIndexes.length;
  const multiplier = calculateMinesMultiplier(
    state.boardSize,
    state.minesCount,
    safePicks,
    game.config.houseEdge,
  );

  return {
    hitMine,
    multiplier,
    revealedSafeIndexes,
  };
}

