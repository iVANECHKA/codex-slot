import { createHash, randomUUID } from "crypto";

export interface SeedBundle {
  seed: string;
  publicSeed: string;
  secretHash: string;
}

export function createSeedBundle(seed?: string): SeedBundle {
  const resolvedSeed = seed ?? randomUUID();

  return {
    seed: resolvedSeed,
    publicSeed: resolvedSeed.slice(0, 8),
    secretHash: sha256(resolvedSeed),
  };
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function createRng(seed: string) {
  let value = 0;
  const hash = sha256(seed);

  for (let index = 0; index < hash.length; index += 8) {
    value ^= Number.parseInt(hash.slice(index, index + 8), 16);
  }

  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function pickIndex(rng: () => number, length: number) {
  return Math.floor(rng() * length);
}