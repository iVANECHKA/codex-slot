import { z } from "zod";

export const authPayloadSchema = z.object({
  login: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(4).max(64),
});

export const registerPayloadSchema = authPayloadSchema.extend({
  displayName: z.string().min(2).max(32),
});

export const slotPlaySchema = z.object({
  slug: z.string().min(1),
  stake: z.number().min(1).max(10000),
});

export const crashStartSchema = z.object({
  slug: z.string().min(1),
  stake: z.number().min(1).max(10000),
  autoCashout: z.number().min(1.01).max(100).optional(),
});

export const crashCashoutSchema = z.object({
  roundId: z.string().uuid(),
});

export const minesStartSchema = z.object({
  slug: z.string().min(1),
  stake: z.number().min(1).max(10000),
  minesCount: z.number().int().min(1).max(24),
});

export const minesRevealSchema = z.object({
  roundId: z.string().uuid(),
  tileIndex: z.number().int().min(0).max(24),
});

