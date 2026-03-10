import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { buySlotBonus } from "@/lib/casino/engines/slot-engine";
import { createRound, mutateBalance, requireCurrentUser, updateRound } from "@/lib/casino/repository";
import { slotPlaySchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = slotPlaySchema.parse(await request.json());
    const user = await requireCurrentUser();
    const game = getGameBySlug(payload.slug);

    if (!game || game.kind !== "slot") {
      return fail("Слот не найден", 404);
    }

    const bonusCost = Number((payload.stake * game.config.bonusBuy.priceMultiplier).toFixed(2));
    await mutateBalance({
      userId: user.id,
      amount: -bonusCost,
      type: "bonus_buy",
      refKind: game.config.bonusBuy.featureKey,
      refId: payload.slug,
    });

    const result = buySlotBonus(game, payload.stake);
    const round = await createRound({
      userId: user.id,
      gameSlug: payload.slug,
      betAmount: bonusCost,
      seedPublic: result.publicSeed,
      seedSecretHash: result.secretHash,
      payload: {
        featureKey: game.config.bonusBuy.featureKey,
        grid: result.grid,
        bonusMultiplier: result.bonusMultiplier,
      },
      status: "pending",
    });

    const refreshedUser = await mutateBalance({
      userId: user.id,
      amount: result.payout,
      type: "win",
      refKind: "slot_bonus",
      refId: round.id,
    });

    await updateRound(round.id, {
      status: "settled",
      resultAmount: result.payout,
      settledAt: new Date().toISOString(),
      payload: {
        ...round.payload,
        payout: result.payout,
        paidCost: bonusCost,
      },
    });

    return ok({
      result: {
        roundId: round.id,
        paidCost: bonusCost,
        balance: refreshedUser.balance,
        ...result,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось купить бонус", 400);
  }
}


