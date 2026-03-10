import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { DEMO_STARTING_BALANCE, SESSION_COOKIE } from "@/lib/constants";
import type { RoundRecord, SessionUser, WalletLedgerEntry, WalletMutation } from "@/lib/casino/types";

interface DemoUserRecord {
  id: string;
  login: string;
  displayName: string;
  password: string;
  balance: number;
  createdAt: string;
}

interface DemoStore {
  users: Map<string, DemoUserRecord>;
  usersByLogin: Map<string, string>;
  sessions: Map<string, string>;
  rounds: Map<string, RoundRecord>;
  ledger: Map<string, WalletLedgerEntry[]>;
}

function createStore(): DemoStore {
  return {
    users: new Map(),
    usersByLogin: new Map(),
    sessions: new Map(),
    rounds: new Map(),
    ledger: new Map(),
  };
}

declare global {
  var __casinoDemoStore: DemoStore | undefined;
}

function getStore() {
  globalThis.__casinoDemoStore ??= createStore();
  return globalThis.__casinoDemoStore;
}

function toSessionUser(user: DemoUserRecord): SessionUser {
  return {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    balance: user.balance,
    mode: "demo",
  };
}

async function getCookieStore() {
  return cookies();
}

export async function demoGetCurrentUser() {
  const cookieStore = await getCookieStore();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const store = getStore();
  const userId = store.sessions.get(sessionToken);
  if (!userId) {
    return null;
  }

  const user = store.users.get(userId);
  return user ? toSessionUser(user) : null;
}

export async function demoRequireCurrentUser() {
  const user = await demoGetCurrentUser();
  if (!user) {
    throw new Error("Требуется авторизация");
  }
  return user;
}

export async function demoRegisterWithLogin(input: {
  login: string;
  password: string;
  displayName: string;
}) {
  const store = getStore();
  const normalizedLogin = input.login.trim().toLowerCase();

  if (store.usersByLogin.has(normalizedLogin)) {
    throw new Error("Такой логин уже существует");
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const user: DemoUserRecord = {
    id,
    login: normalizedLogin,
    displayName: input.displayName.trim() || input.login,
    password: input.password,
    balance: DEMO_STARTING_BALANCE,
    createdAt,
  };

  store.users.set(id, user);
  store.usersByLogin.set(normalizedLogin, id);
  store.ledger.set(id, [
    {
      id: randomUUID(),
      userId: id,
      amount: DEMO_STARTING_BALANCE,
      balanceAfter: DEMO_STARTING_BALANCE,
      type: "signup_bonus",
      refKind: "auth",
      refId: id,
      createdAt,
    },
  ]);

  const sessionToken = randomUUID();
  store.sessions.set(sessionToken, id);
  const cookieStore = await getCookieStore();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  return toSessionUser(user);
}

export async function demoLoginWithLogin(input: { login: string; password: string }) {
  const store = getStore();
  const normalizedLogin = input.login.trim().toLowerCase();
  const userId = store.usersByLogin.get(normalizedLogin);

  if (!userId) {
    throw new Error("Неверный логин или пароль");
  }

  const user = store.users.get(userId);
  if (!user || user.password !== input.password) {
    throw new Error("Неверный логин или пароль");
  }

  const sessionToken = randomUUID();
  store.sessions.set(sessionToken, user.id);
  const cookieStore = await getCookieStore();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  return toSessionUser(user);
}

export async function demoLogout() {
  const cookieStore = await getCookieStore();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const store = getStore();

  if (sessionToken) {
    store.sessions.delete(sessionToken);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function demoMutateBalance(input: WalletMutation) {
  const store = getStore();
  const user = store.users.get(input.userId);
  if (!user) {
    throw new Error("Пользователь не найден");
  }

  const nextBalance = Number((user.balance + input.amount).toFixed(2));
  if (nextBalance < 0) {
    throw new Error("Недостаточно средств");
  }

  user.balance = nextBalance;
  const entry: WalletLedgerEntry = {
    id: randomUUID(),
    ...input,
    balanceAfter: nextBalance,
    createdAt: new Date().toISOString(),
  };

  const ledger = store.ledger.get(input.userId) ?? [];
  ledger.unshift(entry);
  store.ledger.set(input.userId, ledger);

  return toSessionUser(user);
}

export async function demoCreateRound(input: {
  userId: string;
  gameSlug: string;
  betAmount: number;
  seedPublic: string;
  seedSecretHash: string;
  payload: Record<string, unknown>;
  status?: RoundRecord["status"];
}) {
  const store = getStore();
  const round: RoundRecord = {
    id: randomUUID(),
    userId: input.userId,
    gameSlug: input.gameSlug,
    status: input.status ?? "pending",
    betAmount: input.betAmount,
    resultAmount: 0,
    seedPublic: input.seedPublic,
    seedSecretHash: input.seedSecretHash,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };

  store.rounds.set(round.id, round);
  return round;
}

export async function demoGetRound(roundId: string) {
  return getStore().rounds.get(roundId) ?? null;
}

export async function demoUpdateRound(
  roundId: string,
  patch: Partial<RoundRecord>,
) {
  const store = getStore();
  const existing = store.rounds.get(roundId);
  if (!existing) {
    throw new Error("Раунд не найден");
  }

  const nextRound: RoundRecord = {
    ...existing,
    ...patch,
    payload: {
      ...existing.payload,
      ...(patch.payload ?? {}),
    },
  };

  store.rounds.set(roundId, nextRound);
  return nextRound;
}

export async function demoListLedger(userId: string) {
  return getStore().ledger.get(userId) ?? [];
}

