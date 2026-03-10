import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { settleCrashCashout } from "@/lib/casino/engines/crash-engine";
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
      return fail("Раунд уже завершен", 400);
    }

    const game = getGameBySlug(round.gameSlug);
    if (!game || game.kind !== "crash") {
      return fail("Игра Crash не найдена", 404);
    }

    const crashResult = settleCrashCashout({
      game,
      bustPoint: Number(round.payload.bustPoint ?? 1),
      stake: round.betAmount,
      startedAt: String(round.payload.startedAt ?? round.createdAt),
    });

    let refreshedUser = user;
    if (!crashResult.busted) {
      refreshedUser = await mutateBalance({
        userId: user.id,
        amount: crashResult.payout,
        type: "cashout",
        refKind: "crash_cashout",
        refId: round.id,
      });
    }

    await updateRound(round.id, {
      status: crashResult.busted ? "busted" : "settled",
      resultAmount: crashResult.payout,
      settledAt: new Date().toISOString(),
      payload: {
        ...round.payload,
        crashAt: crashResult.multiplier,
        busted: crashResult.busted,
      },
    });

    return ok({
      result: {
        roundId: round.id,
        busted: crashResult.busted,
        payout: crashResult.payout,
        multiplier: crashResult.multiplier,
        balance: refreshedUser.balance,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось вывести выигрыш", 400);
  }
}

