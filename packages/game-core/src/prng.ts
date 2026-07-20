/**
 * @chaos-td/game-core - Seeded PRNG (Mulberry32)
 *
 * Deterministic random number generation for game rules.
 * Must NOT use Math.random().
 *
 * Algorithm: Mulberry32
 * Period: 2^32
 * Reference: https://www.sciencedirect.com/science/article/funcraft-best-uniform-random-number-generators
 */

export const PRNG_VERSION = 1 as const;

export interface SeededRng {
  version: typeof PRNG_VERSION;
  state: Uint32Array;
}

export function parseSeed(seedStr: string): number {
  if (/^\d+$/.test(seedStr)) {
    const num = Number.parseInt(seedStr, 10);
    if (num >= 0 && num <= 0xFFFFFFFF) {
      return num >>> 0;
    }
  }

  let hash = 5381;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) + hash) + seedStr.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash;
}

export function create(seed: number): SeededRng {
  return {
    version: PRNG_VERSION,
    state: new Uint32Array([seed >>> 0]),
  };
}

export function createFromString(seedStr: string): SeededRng {
  return create(parseSeed(seedStr));
}

export function next(rng: SeededRng): { value: number; rng: SeededRng } {
  let s = rng.state[0];
  s = (s + 0x6D2B79F5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  rng.state[0] = s;
  return { value, rng };
}

export function nextInt(rng: SeededRng, min: number, max: number): { value: number; rng: SeededRng } {
  if (min > max) {
    throw new Error(`nextInt: min (${min}) > max (${max})`);
  }
  if (min === max) {
    return { value: min, rng };
  }
  const { value, rng: after } = next(rng);
  const valueInt = min + Math.floor(value * (max - min + 1));
  return { value: valueInt, rng: after };
}

export function fork(rng: SeededRng): SeededRng {
  const { value, rng: after } = next(rng);
  return create(value * 4294967296 + after.state[0]);
}
