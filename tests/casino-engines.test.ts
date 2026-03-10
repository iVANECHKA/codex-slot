import { describe, expect, test } from "vitest";
import { getGameBySlug } from "../src/lib/casino/catalog";
import { createRng } from "../src/lib/casino/rng";
import { createCrashRound } from "../src/lib/casino/engines/crash-engine";
import { createMinesBoard, revealMineTile } from "../src/lib/casino/engines/mines-engine";
import { spinSlot } from "../src/lib/casino/engines/slot-engine";

describe("casino engines", () => {
  test("rng is deterministic for same seed", () => {
    const left = createRng("seed-1");
    const right = createRng("seed-1");
    expect([left(), left(), left()]).toEqual([right(), right(), right()]);
  });

  test("slot spins are deterministic for same seed", () => {
    const game = getGameBySlug("royal-heist");
    expect(game?.kind).toBe("slot");
    if (!game || game.kind !== "slot") {
      return;
    }
    expect(spinSlot(game, 20, "slot-seed")).toEqual(spinSlot(game, 20, "slot-seed"));
  });

  test("crash round respects max multiplier and determinism", () => {
    const game = getGameBySlug("rocket-x");
    expect(game?.kind).toBe("crash");
    if (!game || game.kind !== "crash") {
      return;
    }
    const round = createCrashRound(game, 2, "crash-seed");
    expect(round.bustPoint).toBeGreaterThanOrEqual(1);
    expect(round.bustPoint).toBeLessThanOrEqual(game.config.maxMultiplier);
    expect(createCrashRound(game, 2, "crash-seed").bustPoint).toBe(round.bustPoint);
  });

  test("mines reveal tracks safe picks and mine hits", () => {
    const game = getGameBySlug("vault-mines");
    expect(game?.kind).toBe("mines");
    if (!game || game.kind !== "mines") {
      return;
    }
    const board = createMinesBoard(game, 5, "mines-seed");
    const safeIndex = Array.from({ length: 25 }, (_, index) => index).find(
      (index) => !board.mineIndexes.includes(index),
    );
    expect(safeIndex).toBeTypeOf("number");
    const safeReveal = revealMineTile(game, board, safeIndex as number);
    expect(safeReveal.hitMine).toBe(false);
    expect(safeReveal.revealedSafeIndexes).toContain(safeIndex);
    const mineReveal = revealMineTile(game, board, board.mineIndexes[0]);
    expect(mineReveal.hitMine).toBe(true);
  });
});

