export type GameKind = "slot" | "crash" | "mines";

export interface SessionUser {
  id: string;
  login: string;
  displayName: string;
  balance: number;
  mode: "demo" | "supabase";
}

export interface WalletMutation {
  userId: string;
  amount: number;
  type:
    | "signup_bonus"
    | "bet"
    | "win"
    | "refund"
    | "bonus_buy"
    | "cashout"
    | "loss";
  refKind: string;
  refId: string;
}

export interface WalletLedgerEntry extends WalletMutation {
  id: string;
  balanceAfter: number;
  createdAt: string;
}

export interface RoundRecord {
  id: string;
  userId: string;
  gameSlug: string;
  status: "pending" | "active" | "settled" | "busted" | "lost";
  betAmount: number;
  resultAmount: number;
  seedPublic: string;
  seedSecretHash: string;
  payload: Record<string, unknown>;
  createdAt: string;
  settledAt?: string;
}

export interface GameResult {
  roundId: string;
  payout: number;
  status: RoundRecord["status"];
  payload: Record<string, unknown>;
  balance: number;
}

export interface SlotSymbol {
  code: string;
  label: string;
  imageUrl?: string;
  accent: string;
  payouts?: Partial<Record<3 | 4 | 5, number>>;
  wild?: boolean;
  scatter?: boolean;
}

export interface SlotBonusConfig {
  featureKey: string;
  priceMultiplier: number;
  minMultiplier: number;
  maxMultiplier: number;
}

export interface SlotMathModel {
  type: "slot";
  rows: number;
  reels: string[][];
  paylines: number[][];
  symbols: SlotSymbol[];
  rtpTarget: number;
  volatility: "medium" | "high" | "very_high";
  minBet: number;
  maxBet: number;
  bonusBuy: SlotBonusConfig;
}

export interface CrashMathModel {
  type: "crash";
  houseEdge: number;
  growthFactor: number;
  minBet: number;
  maxBet: number;
  maxMultiplier: number;
}

export interface MinesMathModel {
  type: "mines";
  boardSize: number;
  minMines: number;
  maxMines: number;
  houseEdge: number;
  minBet: number;
  maxBet: number;
}

export interface GameDefinitionBase {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  eyebrow: string;
  thumbnail: string;
  hero: string;
  kind: GameKind;
}

export interface SlotGameDefinition extends GameDefinitionBase {
  kind: "slot";
  config: SlotMathModel;
}

export interface CrashGameDefinition extends GameDefinitionBase {
  kind: "crash";
  config: CrashMathModel;
}

export interface MinesGameDefinition extends GameDefinitionBase {
  kind: "mines";
  config: MinesMathModel;
}

export type GameDefinition =
  | SlotGameDefinition
  | CrashGameDefinition
  | MinesGameDefinition;

export interface GameEngine<TConfig, TResult> {
  slug: string;
  play(input: { stake: number; seed?: string; config: TConfig }): TResult;
}

