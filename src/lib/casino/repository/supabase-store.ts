import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoundRecord, SessionUser, WalletMutation } from "@/lib/casino/types";

function syntheticEmail(login: string) {
  return `${login.trim().toLowerCase()}@local.sim`;
}

async function getProfile(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, login, display_name, balance_cached")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Профиль не найден");
  }

  return {
    id: data.id,
    login: data.login,
    displayName: data.display_name,
    balance: Number(data.balance_cached ?? 0),
    mode: "supabase",
  } satisfies SessionUser;
}

export async function supabaseGetCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getProfile(user.id);
}

export async function supabaseRegisterWithLogin(input: {
  login: string;
  password: string;
  displayName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const email = syntheticEmail(input.login);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        login: input.login.trim().toLowerCase(),
        display_name: input.displayName.trim() || input.login,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Не удалось создать аккаунт");
  }

  await admin.from("profiles").upsert({
    id: data.user.id,
    login: input.login.trim().toLowerCase(),
    display_name: input.displayName.trim() || input.login,
    balance_cached: 5000,
  });

  return getProfile(data.user.id);
}

export async function supabaseLoginWithLogin(input: { login: string; password: string }) {
  const supabase = await createSupabaseServerClient();
  const email = syntheticEmail(input.login);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Неверный логин или пароль");
  }

  return getProfile(data.user.id);
}

export async function supabaseLogout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function supabaseMutateBalance(input: WalletMutation) {
  const admin = createSupabaseAdminClient();
  const profile = await getProfile(input.userId);
  const nextBalance = Number((profile.balance + input.amount).toFixed(2));

  if (nextBalance < 0) {
    throw new Error("Недостаточно средств");
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ balance_cached: nextBalance })
    .eq("id", input.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: ledgerError } = await admin.from("wallet_ledger").insert({
    user_id: input.userId,
    type: input.type,
    amount: input.amount,
    balance_after: nextBalance,
    ref_kind: input.refKind,
    ref_id: input.refId,
  });

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  return {
    ...profile,
    balance: nextBalance,
  } satisfies SessionUser;
}

export async function supabaseCreateRound(input: {
  userId: string;
  gameSlug: string;
  betAmount: number;
  seedPublic: string;
  seedSecretHash: string;
  payload: Record<string, unknown>;
  status?: RoundRecord["status"];
}) {
  const admin = createSupabaseAdminClient();
  const { data: game, error: gameError } = await admin
    .from("game_catalog")
    .select("id")
    .eq("slug", input.gameSlug)
    .single();

  if (gameError || !game) {
    throw new Error(gameError?.message ?? "Игра не найдена в каталоге");
  }

  const { data, error } = await admin
    .from("game_rounds")
    .insert({
      user_id: input.userId,
      game_id: game.id,
      status: input.status ?? "pending",
      bet_amount: input.betAmount,
      result_amount: 0,
      seed_public: input.seedPublic,
      seed_secret_hash: input.seedSecretHash,
      payload_json: input.payload,
    })
    .select("id, user_id, status, bet_amount, result_amount, seed_public, seed_secret_hash, payload_json, created_at, settled_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не удалось создать раунд");
  }

  return {
    id: data.id,
    userId: data.user_id,
    gameSlug: input.gameSlug,
    status: data.status,
    betAmount: Number(data.bet_amount),
    resultAmount: Number(data.result_amount),
    seedPublic: data.seed_public,
    seedSecretHash: data.seed_secret_hash,
    payload: (data.payload_json as Record<string, unknown>) ?? {},
    createdAt: data.created_at,
    settledAt: data.settled_at ?? undefined,
  } satisfies RoundRecord;
}

export async function supabaseGetRound(roundId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("game_rounds")
    .select("id, user_id, status, bet_amount, result_amount, seed_public, seed_secret_hash, payload_json, created_at, settled_at, game_catalog(slug)")
    .eq("id", roundId)
    .single();

  if (error || !data) {
    return null;
  }

  const gameSlug = Array.isArray(data.game_catalog)
    ? data.game_catalog[0]?.slug
    : (data.game_catalog as { slug?: string } | null)?.slug;

  return {
    id: data.id,
    userId: data.user_id,
    gameSlug: gameSlug ?? "unknown",
    status: data.status,
    betAmount: Number(data.bet_amount),
    resultAmount: Number(data.result_amount),
    seedPublic: data.seed_public,
    seedSecretHash: data.seed_secret_hash,
    payload: (data.payload_json as Record<string, unknown>) ?? {},
    createdAt: data.created_at,
    settledAt: data.settled_at ?? undefined,
  } satisfies RoundRecord;
}

export async function supabaseUpdateRound(roundId: string, patch: Partial<RoundRecord>) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("game_rounds")
    .update({
      status: patch.status,
      result_amount: patch.resultAmount,
      payload_json: patch.payload,
      settled_at: patch.settledAt,
    })
    .eq("id", roundId);

  if (error) {
    throw new Error(error.message);
  }

  const round = await supabaseGetRound(roundId);
  if (!round) {
    throw new Error("Раунд не найден");
  }
  return round;
}

