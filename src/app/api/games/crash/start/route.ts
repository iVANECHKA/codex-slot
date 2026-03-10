import { fail, ok } from "@/lib/api";
import { getGameBySlug } from "@/lib/casino/catalog";
import { createCrashRound } from "@/lib/casino/engines/crash-engine";
import { createRound, mutateBalance, requireCurrentUser } from "@/lib/casino/repository";
import { crashStartSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = crashStartSchema.parse(await request.json());
    const user = await requireCurrentUser();
    const game = getGameBySlug(payload.slug);

    if (!game || game.kind !== "crash") {
      return fail("Игра Crash не найдена", 404);
    }

    await mutateBalance({
      userId: user.id,
      amount: -payload.stake,
      type: "bet",
      refKind: "crash_start",
      refId: payload.slug,
    });

    const crash = createCrashRound(game, payload.autoCashout);
    const round = await createRound({
      userId: user.id,
      gameSlug: payload.slug,
      betAmount: payload.stake,
      seedPublic: crash.publicSeed,
      seedSecretHash: crash.secretHash,
      payload: {
        bustPoint: crash.bustPoint,
        autoCashout: crash.autoCashout,
        startedAt: new Date().toISOString(),
      },
      status: "active",
    });

    return ok({
      round: {
        roundId: round.id,
        stake: payload.stake,
        bustPoint: crash.bustPoint,
        startedAt: round.createdAt,
        autoCashout: payload.autoCashout,
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось запустить краш-раунд", 400);
  }
}

