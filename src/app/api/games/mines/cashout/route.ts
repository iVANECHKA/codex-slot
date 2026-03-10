import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { calculateMinesMultiplier } from "@/lib/casino/engines/mines-engine";
import { getRound, mutateBalance, requireCurrentUser, updateRound } from "@/lib/casino/repository";
import { crashCashoutSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = crashCashoutSchema.parse(await request.json());
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

    const safePicks = ((round.payload.revealedSafeIndexes as number[]) ?? []).length;
    const multiplier = calculateMinesMultiplier(
      game.config.boardSize,
      Number(round.payload.minesCount),
      safePicks,
      game.config.houseEdge,
    );
    const payout = Number((round.betAmount * multiplier).toFixed(2));
    const refreshedUser = await mutateBalance({
      userId: user.id,
      amount: payout,
      type: "cashout",
      refKind: "mines_cashout",
      refId: round.id,
    });

    await updateRound(round.id, {
      status: "settled",
      resultAmount: payout,
      settledAt: new Date().toISOString(),
      payload: {
        ...round.payload,
        cashoutMultiplier: multiplier,
      },
    });

    return ok({
      result: {
        roundId: round.id,
        payout,
        multiplier,
        balance: refreshedUser.balance,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось вывести выигрыш в Mines", 400);
  }
}

