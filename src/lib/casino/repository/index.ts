import { hasSupabaseEnv } from "@/lib/env";
import {
  demoCreateRound,
  demoGetCurrentUser,
  demoGetRound,
  demoListLedger,
  demoLoginWithLogin,
  demoLogout,
  demoMutateBalance,
  demoRegisterWithLogin,
  demoRequireCurrentUser,
  demoUpdateRound,
} from "@/lib/casino/repository/demo-store";
import {
  supabaseCreateRound,
  supabaseGetCurrentUser,
  supabaseGetRound,
  supabaseLoginWithLogin,
  supabaseLogout,
  supabaseMutateBalance,
  supabaseRegisterWithLogin,
  supabaseUpdateRound,
} from "@/lib/casino/repository/supabase-store";

export function getCasinoMode() {
  return hasSupabaseEnv() ? "supabase" : "demo";
}

export async function getCurrentUser() {
  return getCasinoMode() === "supabase"
    ? supabaseGetCurrentUser()
    : demoGetCurrentUser();
}

export async function requireCurrentUser() {
  if (getCasinoMode() === "supabase") {
    const user = await supabaseGetCurrentUser();
    if (!user) {
      throw new Error("Требуется авторизация");
    }
    return user;
  }

  return demoRequireCurrentUser();
}

export async function registerWithLogin(input: {
  login: string;
  password: string;
  displayName: string;
}) {
  return getCasinoMode() === "supabase"
    ? supabaseRegisterWithLogin(input)
    : demoRegisterWithLogin(input);
}

export async function loginWithLogin(input: { login: string; password: string }) {
  return getCasinoMode() === "supabase"
    ? supabaseLoginWithLogin(input)
    : demoLoginWithLogin(input);
}

export async function logout() {
  return getCasinoMode() === "supabase" ? supabaseLogout() : demoLogout();
}

export async function mutateBalance(input: Parameters<typeof demoMutateBalance>[0]) {
  return getCasinoMode() === "supabase"
    ? supabaseMutateBalance(input)
    : demoMutateBalance(input);
}

export async function createRound(input: Parameters<typeof demoCreateRound>[0]) {
  return getCasinoMode() === "supabase"
    ? supabaseCreateRound(input)
    : demoCreateRound(input);
}

export async function getRound(roundId: string) {
  return getCasinoMode() === "supabase"
    ? supabaseGetRound(roundId)
    : demoGetRound(roundId);
}

export async function updateRound(
  roundId: string,
  patch: Parameters<typeof demoUpdateRound>[1],
) {
  return getCasinoMode() === "supabase"
    ? supabaseUpdateRound(roundId, patch)
    : demoUpdateRound(roundId, patch);
}

export async function listLedger(userId: string) {
  return getCasinoMode() === "supabase" ? [] : demoListLedger(userId);
}

