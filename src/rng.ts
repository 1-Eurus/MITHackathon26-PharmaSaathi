/* ============================================================
   Seeded RNG - deterministic so the simulated data is identical
   on every load (mulberry32)
   ============================================================ */

export function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(19820);

export function rand(a: number, b: number): number {
  return a + rng() * (b - a);
}
