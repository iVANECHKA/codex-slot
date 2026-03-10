import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { spinSlot } from "@/lib/casino/engines/slot-engine";
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

    await mutateBalance({
      userId: user.id,
      amount: -payload.stake,
      type: "bet",
      refKind: "slot_spin",
      refId: payload.slug,
    });

    const spin = spinSlot(game, payload.stake);
    const round = await createRound({
      userId: user.id,
      gameSlug: payload.slug,
      betAmount: payload.stake,
      seedPublic: spin.publicSeed,
      seedSecretHash: spin.secretHash,
      payload: {
        grid: spin.grid,
        lineWins: spin.lineWins,
        scatterCount: spin.scatterCount,
        triggeredBonus: spin.triggeredBonus,
        bonusMultiplier: spin.bonusMultiplier,
      },
      status: "pending",
    });

    let refreshedUser = user;
    if (spin.payout > 0) {
      refreshedUser = await mutateBalance({
        userId: user.id,
        amount: spin.payout,
        type: "win",
        refKind: "slot_spin",
        refId: round.id,
      });
    }

    await updateRound(round.id, {
      status: spin.payout > 0 ? "settled" : "lost",
      resultAmount: spin.payout,
      settledAt: new Date().toISOString(),
      payload: {
        ...round.payload,
        payout: spin.payout,
        stops: spin.stops,
      },
    });

    return ok({
      result: {
        roundId: round.id,
        balance: refreshedUser.balance,
        ...spin,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось прокрутить слот", 400);
  }
}