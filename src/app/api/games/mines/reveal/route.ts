import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { revealMineTile } from "@/lib/casino/engines/mines-engine";
import { getRound, requireCurrentUser, updateRound } from "@/lib/casino/repository";
import { minesRevealSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = minesRevealSchema.parse(await request.json());
    const user = await requireCurrentUser();
    const round = await getRound(payload.roundId);

    if (!round || round.userId !== user.id) {
      return fail("Раунд не найден", 404);
    }

    if (round.status !== "active") {
      return fail("Раунд не активен", 400);
    }

    const game = getGameBySlug(round.gameSlug);
    if (!game || game.kind !== "mines") {
      return fail("Игра Mines не найдена", 404);
    }

    const result = revealMineTile(game, {
      boardSize: Number(round.payload.boardSize),
      mineIndexes: (round.payload.mineIndexes as number[]) ?? [],
      revealedSafeIndexes: (round.payload.revealedSafeIndexes as number[]) ?? [],
      minesCount: Number(round.payload.minesCount),
    }, payload.tileIndex);

    const nextStatus = result.hitMine ? "lost" : "active";
    await updateRound(round.id, {
      status: nextStatus,
      payload: {
        ...round.payload,
        revealedSafeIndexes: result.revealedSafeIndexes,
        hitMineIndex: result.hitMine ? payload.tileIndex : null,
      },
      settledAt: result.hitMine ? new Date().toISOString() : undefined,
    });

    return ok({
      result: {
        roundId: round.id,
        hitMine: result.hitMine,
        multiplier: result.multiplier,
        revealedSafeIndexes: result.revealedSafeIndexes,
        boardSize: Number(round.payload.boardSize),
        revealAllMines: result.hitMine ? round.payload.mineIndexes : [],
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось открыть клетку", 400);
  }
}

