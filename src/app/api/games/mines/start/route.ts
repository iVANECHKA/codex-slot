import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { createMinesBoard } from "@/lib/casino/engines/mines-engine";
import { createRound, mutateBalance, requireCurrentUser } from "@/lib/casino/repository";
import { minesStartSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = minesStartSchema.parse(await request.json());
    const user = await requireCurrentUser();
    const game = getGameBySlug(payload.slug);

    if (!game || game.kind !== "mines") {
      return fail("Игра Mines не найдена", 404);
    }

    if (
      payload.minesCount < game.config.minMines ||
      payload.minesCount > game.config.maxMines
    ) {
      return fail("Некорректное количество мин", 400);
    }

    await mutateBalance({
      userId: user.id,
      amount: -payload.stake,
      type: "bet",
      refKind: "mines_start",
      refId: payload.slug,
    });

    const board = createMinesBoard(game, payload.minesCount);
    const round = await createRound({
      userId: user.id,
      gameSlug: payload.slug,
      betAmount: payload.stake,
      seedPublic: board.publicSeed,
      seedSecretHash: board.secretHash,
      payload: {
        boardSize: board.boardSize,
        mineIndexes: board.mineIndexes,
        revealedSafeIndexes: board.revealedSafeIndexes,
        minesCount: board.minesCount,
      },
      status: "active",
    });

    return ok({
      round: {
        roundId: round.id,
        boardSize: board.boardSize,
        minesCount: board.minesCount,
        revealedSafeIndexes: [],
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось запустить раунд в Mines", 400);
  }
}

