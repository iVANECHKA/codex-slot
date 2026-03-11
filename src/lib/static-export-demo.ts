import type { CrashGameDefinition, MinesGameDefinition, SessionUser, SlotGameDefinition } from "@/lib/casino/types";
import { DEMO_STARTING_BALANCE } from "@/lib/constants";

const ACCOUNTS_KEY = "codex_slot_static_accounts_v1";
const SESSION_KEY = "codex_slot_static_session_v1";
const MINES_ROUNDS_KEY = "codex_slot_static_mines_rounds_v1";
const CRASH_ROUNDS_KEY = "codex_slot_static_crash_rounds_v1";

interface StaticAccount {
  id: string;
  login: string;
  displayName: string;
  password: string;
  balance: number;
  createdAt: string;
}

interface StaticMinesRound {
  id: string;
  userId: string;
  gameSlug: string;
  stake: number;
  boardSize: number;
  minesCount: number;
  mineIndexes: number[];
  revealedSafeIndexes: number[];
  status: "active" | "lost" | "settled";
}

interface StaticCrashRound {
  id: string;
  userId: string;
  gameSlug: string;
  stake: number;
  bustPoint: number;
  startedAt: string;
  autoCashout?: number;
  status: "active" | "busted" | "settled";
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id_${Date.now()}_${Math.floor(Math.random() * 1_000_000_000)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function toSessionUser(account: StaticAccount): SessionUser {
  return {
    id: account.id,
    login: account.login,
    displayName: account.displayName,
    balance: account.balance,
    mode: "demo",
  };
}

function getAccounts() {
  return readJson<StaticAccount[]>(ACCOUNTS_KEY, []);
}

function saveAccounts(accounts: StaticAccount[]) {
  writeJson(ACCOUNTS_KEY, accounts);
}

function getSessionUserId() {
  return readJson<string | null>(SESSION_KEY, null);
}

function setSessionUserId(userId: string | null) {
  if (userId) {
    writeJson(SESSION_KEY, userId);
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

function requireCurrentUserAccount() {
  const userId = getSessionUserId();
  const account = getAccounts().find((item) => item.id === userId);

  if (!userId || !account) {
    throw new Error("Требуется авторизация");
  }

  return account;
}

function updateAccount(userId: string, updater: (account: StaticAccount) => StaticAccount) {
  const accounts = getAccounts();
  const index = accounts.findIndex((item) => item.id === userId);

  if (index < 0) {
    throw new Error("Пользователь не найден");
  }

  const next = updater(accounts[index]);
  accounts[index] = next;
  saveAccounts(accounts);
  return next;
}

function mutateBalance(userId: string, amount: number) {
  return updateAccount(userId, (account) => {
    const nextBalance = Number((account.balance + amount).toFixed(2));
    if (nextBalance < 0) {
      throw new Error("Недостаточно средств");
    }

    return {
      ...account,
      balance: nextBalance,
    };
  });
}

export function getStaticSessionUser(): SessionUser | null {
  const userId = getSessionUserId();
  if (!userId) {
    return null;
  }

  const account = getAccounts().find((item) => item.id === userId);
  return account ? toSessionUser(account) : null;
}

export function staticRegisterWithLogin(input: {
  login: string;
  password: string;
  displayName: string;
}) {
  const normalizedLogin = input.login.trim().toLowerCase();
  const accounts = getAccounts();

  if (accounts.some((item) => item.login === normalizedLogin)) {
    throw new Error("Такой логин уже существует");
  }

  const account: StaticAccount = {
    id: randomId(),
    login: normalizedLogin,
    displayName: input.displayName.trim() || input.login.trim(),
    password: input.password,
    balance: DEMO_STARTING_BALANCE,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  saveAccounts(accounts);
  setSessionUserId(account.id);

  return toSessionUser(account);
}

export function staticLoginWithLogin(input: { login: string; password: string }) {
  const normalizedLogin = input.login.trim().toLowerCase();
  const account = getAccounts().find((item) => item.login === normalizedLogin);

  if (!account || account.password !== input.password) {
    throw new Error("Неверный логин или пароль");
  }

  setSessionUserId(account.id);
  return toSessionUser(account);
}

export function staticLogout() {
  setSessionUserId(null);
}

function calculateMinesMultiplier(boardSize: number, minesCount: number, safePicks: number, houseEdge: number) {
  if (safePicks === 0) {
    return 1;
  }

  let probability = 1;
  for (let pick = 0; pick < safePicks; pick += 1) {
    probability *= (boardSize * boardSize - minesCount - pick) / (boardSize * boardSize - pick);
  }

  return Number(((1 / probability) * (1 - houseEdge)).toFixed(2));
}

function multiplierAtElapsed(elapsedMs: number, growthFactor: number) {
  const seconds = elapsedMs / 1000;
  return Number((1 + growthFactor * seconds + 0.28 * seconds * seconds).toFixed(2));
}

function pickIndex(length: number) {
  return Math.floor(Math.random() * length);
}

function buildSlotGrid(game: SlotGameDefinition) {
  const stops = game.config.reels.map((strip) => pickIndex(strip.length));
  const grid = Array.from({ length: game.config.rows }, (_, rowIndex) =>
    game.config.reels.map((strip, reelIndex) => {
      const stop = stops[reelIndex];
      return strip[(stop + rowIndex) % strip.length];
    }),
  );

  return { grid, stops };
}

function evaluateSlotLine(game: SlotGameDefinition, grid: string[][], line: number[]) {
  const symbolMap = new Map(game.config.symbols.map((symbol) => [symbol.code, symbol]));
  const codes = line.map((row, reelIndex) => grid[row][reelIndex]);
  const nonWild = codes.find((code) => !symbolMap.get(code)?.wild);
  const baseCode = nonWild ?? codes[0];
  const baseSymbol = symbolMap.get(baseCode);

  if (!baseSymbol || baseSymbol.scatter) {
    return null;
  }

  let count = 0;
  for (const code of codes) {
    const symbol = symbolMap.get(code);
    if (code === baseCode || symbol?.wild) {
      count += 1;
      continue;
    }
    break;
  }

  const payoutMultiplier = baseSymbol.payouts?.[count as 3 | 4 | 5];
  if (!payoutMultiplier) {
    return null;
  }

  return {
    symbol: baseCode,
    count,
    payoutMultiplier,
  };
}

export function staticPlaySlot(input: {
  game: SlotGameDefinition;
  stake: number;
  bonus: boolean;
}) {
  const user = requireCurrentUserAccount();
  const game = input.game;
  const stake = Number(input.stake);

  if (!Number.isFinite(stake) || stake <= 0) {
    throw new Error("Некорректная ставка");
  }

  if (input.bonus) {
    const paidCost = Number((stake * game.config.bonusBuy.priceMultiplier).toFixed(2));
    mutateBalance(user.id, -paidCost);

    const bonusMultiplier = Number(
      (
        game.config.bonusBuy.minMultiplier +
        Math.random() * (game.config.bonusBuy.maxMultiplier - game.config.bonusBuy.minMultiplier)
      ).toFixed(2),
    );
    const payout = Number((stake * bonusMultiplier).toFixed(2));

    const scatterCode = game.config.symbols.find((symbol) => symbol.scatter)?.code ?? "SC";
    const filler = game.config.symbols.find((symbol) => !symbol.scatter)?.code ?? "A";
    const grid = Array.from({ length: game.config.rows }, (_, rowIndex) =>
      Array.from({ length: 5 }, (_, reelIndex) => {
        if (rowIndex === 1 && reelIndex < 3) {
          return scatterCode;
        }
        return filler;
      }),
    );

    const accountAfter = mutateBalance(user.id, payout);

    return {
      result: {
        roundId: randomId(),
        payout,
        balance: accountAfter.balance,
        grid,
        lineWins: [],
        bonusMultiplier,
      },
    };
  }

  mutateBalance(user.id, -stake);
  const { grid } = buildSlotGrid(game);
  const stakePerLine = stake / game.config.paylines.length;

  const lineWins = game.config.paylines
    .map((line, lineIndex) => {
      const match = evaluateSlotLine(game, grid, line);
      if (!match) {
        return null;
      }

      const payout = Number((stakePerLine * match.payoutMultiplier).toFixed(2));
      return {
        lineIndex,
        symbol: match.symbol,
        count: match.count,
        payout,
      };
    })
    .filter((item): item is { lineIndex: number; symbol: string; count: number; payout: number } => item !== null);

  const scatterCode = game.config.symbols.find((symbol) => symbol.scatter)?.code;
  const scatterCount = scatterCode ? grid.flat().filter((code) => code === scatterCode).length : 0;
  const bonusMultiplier = scatterCount >= 3 ? Number((6 + Math.random() * 24).toFixed(2)) : 0;

  const payout = Number(
    (
      lineWins.reduce((sum, lineWin) => sum + lineWin.payout, 0) +
      (bonusMultiplier > 0 ? bonusMultiplier * stake : 0)
    ).toFixed(2),
  );

  const accountAfter = payout > 0 ? mutateBalance(user.id, payout) : getStaticSessionUser();

  return {
    result: {
      roundId: randomId(),
      payout,
      balance: accountAfter?.balance ?? 0,
      grid,
      lineWins,
      bonusMultiplier,
    },
  };
}

function getMinesRounds() {
  return readJson<StaticMinesRound[]>(MINES_ROUNDS_KEY, []);
}

function saveMinesRounds(rounds: StaticMinesRound[]) {
  writeJson(MINES_ROUNDS_KEY, rounds);
}

export function staticStartMinesRound(input: {
  game: MinesGameDefinition;
  stake: number;
  minesCount: number;
}) {
  const user = requireCurrentUserAccount();
  const game = input.game;

  if (input.minesCount < game.config.minMines || input.minesCount > game.config.maxMines) {
    throw new Error("Некорректное количество мин");
  }

  mutateBalance(user.id, -input.stake);

  const cells = Array.from({ length: game.config.boardSize * game.config.boardSize }, (_, index) => index);
  const mineIndexes: number[] = [];
  while (mineIndexes.length < input.minesCount) {
    const next = pickIndex(cells.length);
    const [mine] = cells.splice(next, 1);
    mineIndexes.push(mine);
  }

  const round: StaticMinesRound = {
    id: randomId(),
    userId: user.id,
    gameSlug: game.slug,
    stake: Number(input.stake),
    boardSize: game.config.boardSize,
    minesCount: input.minesCount,
    mineIndexes: mineIndexes.sort((left, right) => left - right),
    revealedSafeIndexes: [],
    status: "active",
  };

  const rounds = getMinesRounds();
  rounds.push(round);
  saveMinesRounds(rounds);

  return {
    round: {
      roundId: round.id,
      boardSize: round.boardSize,
      minesCount: round.minesCount,
      revealedSafeIndexes: [],
    },
  };
}

export function staticRevealMinesTile(input: {
  game: MinesGameDefinition;
  roundId: string;
  tileIndex: number;
}) {
  const user = requireCurrentUserAccount();
  const rounds = getMinesRounds();
  const round = rounds.find((item) => item.id === input.roundId && item.userId === user.id);

  if (!round) {
    throw new Error("Раунд не найден");
  }

  if (round.status !== "active") {
    throw new Error("Раунд не активен");
  }

  const hitMine = round.mineIndexes.includes(input.tileIndex);
  if (!hitMine && !round.revealedSafeIndexes.includes(input.tileIndex)) {
    round.revealedSafeIndexes.push(input.tileIndex);
    round.revealedSafeIndexes.sort((left, right) => left - right);
  }

  if (hitMine) {
    round.status = "lost";
  }

  saveMinesRounds(rounds);

  const multiplier = calculateMinesMultiplier(
    round.boardSize,
    round.minesCount,
    round.revealedSafeIndexes.length,
    input.game.config.houseEdge,
  );

  return {
    result: {
      roundId: round.id,
      hitMine,
      multiplier,
      revealedSafeIndexes: [...round.revealedSafeIndexes],
      revealAllMines: hitMine ? [...round.mineIndexes] : [],
    },
  };
}

export function staticCashoutMines(input: {
  game: MinesGameDefinition;
  roundId: string;
}) {
  const user = requireCurrentUserAccount();
  const rounds = getMinesRounds();
  const round = rounds.find((item) => item.id === input.roundId && item.userId === user.id);

  if (!round) {
    throw new Error("Раунд не найден");
  }

  if (round.status !== "active") {
    throw new Error("Раунд не активен");
  }

  const multiplier = calculateMinesMultiplier(
    round.boardSize,
    round.minesCount,
    round.revealedSafeIndexes.length,
    input.game.config.houseEdge,
  );
  const payout = Number((round.stake * multiplier).toFixed(2));
  round.status = "settled";
  saveMinesRounds(rounds);

  const accountAfter = mutateBalance(user.id, payout);

  return {
    result: {
      roundId: round.id,
      payout,
      multiplier,
      balance: accountAfter.balance,
    },
  };
}

function getCrashRounds() {
  return readJson<StaticCrashRound[]>(CRASH_ROUNDS_KEY, []);
}

function saveCrashRounds(rounds: StaticCrashRound[]) {
  writeJson(CRASH_ROUNDS_KEY, rounds);
}

export function staticStartCrashRound(input: {
  game: CrashGameDefinition;
  stake: number;
  autoCashout?: number;
}) {
  const user = requireCurrentUserAccount();
  mutateBalance(user.id, -input.stake);

  const sample = Math.min(0.999999, Math.max(0.000001, Math.random()));
  const raw = (1 - input.game.config.houseEdge) / (1 - sample);
  const bustPoint = Number(Math.min(input.game.config.maxMultiplier, Math.max(1, raw)).toFixed(2));

  const round: StaticCrashRound = {
    id: randomId(),
    userId: user.id,
    gameSlug: input.game.slug,
    stake: Number(input.stake),
    bustPoint,
    startedAt: new Date().toISOString(),
    autoCashout: input.autoCashout,
    status: "active",
  };

  const rounds = getCrashRounds();
  rounds.push(round);
  saveCrashRounds(rounds);

  return {
    round: {
      roundId: round.id,
      stake: round.stake,
      bustPoint: round.bustPoint,
      startedAt: round.startedAt,
      autoCashout: round.autoCashout,
    },
  };
}

export function staticCashoutCrash(input: {
  game: CrashGameDefinition;
  roundId: string;
  targetMultiplier?: number;
}) {
  const user = requireCurrentUserAccount();
  const rounds = getCrashRounds();
  const round = rounds.find((item) => item.id === input.roundId && item.userId === user.id);

  if (!round) {
    throw new Error("Раунд не найден");
  }

  if (round.status !== "active") {
    throw new Error("Раунд уже завершен");
  }

  const elapsed = Date.now() - new Date(round.startedAt).getTime();
  const currentMultiplier = multiplierAtElapsed(elapsed, input.game.config.growthFactor);
  const requestedTarget =
    typeof input.targetMultiplier === "number" && Number.isFinite(input.targetMultiplier)
      ? Number(input.targetMultiplier.toFixed(2))
      : null;

  if (requestedTarget !== null) {
    if (requestedTarget < 1) {
      throw new Error("Некорректный коэффициент вывода");
    }

    if (currentMultiplier < requestedTarget) {
      throw new Error("Слишком рано для автовывода");
    }
  }

  const settlementMultiplier = requestedTarget ?? currentMultiplier;
  const cappedMultiplier = Math.min(settlementMultiplier, round.bustPoint);
  const busted = cappedMultiplier >= round.bustPoint;
  const payout = busted ? 0 : Number((round.stake * cappedMultiplier).toFixed(2));

  round.status = busted ? "busted" : "settled";
  saveCrashRounds(rounds);

  const accountAfter = busted ? getStaticSessionUser() : mutateBalance(user.id, payout);

  return {
    result: {
      roundId: round.id,
      busted,
      payout,
      multiplier: Number(cappedMultiplier.toFixed(2)),
      balance: accountAfter?.balance ?? 0,
    },
  };
}
