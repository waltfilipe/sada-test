import type { PositionFamily } from "@/lib/types";

/**
 * Chance that a long pass is also progressive, by position.
 * Fit on regulars (at least 50% of the leader's minutes) across Série A–D:
 * progressive passes = qs × short/medium + ql × long.
 * Forwards were capped at 1, since one long pass cannot count as more than one progressive pass.
 */
export const LONG_PASS_IS_PROGRESSIVE: Record<PositionFamily, number> = {
  zagueiros: 0.83,
  laterais: 0.92,
  "meio-campistas": 0.75,
  extremos: 0.88,
  atacantes: 1,
};

export function longPassProgressiveRate(family: PositionFamily): number {
  return Math.min(1, LONG_PASS_IS_PROGRESSIVE[family] ?? 0);
}

/** Progressive passes per 90 that are not long passes. */
export function progressiveNotLong(progressivePer90: number, longPer90: number, family: PositionFamily): number {
  return Math.max(0, progressivePer90 - longPassProgressiveRate(family) * longPer90);
}

/** Progressive passes per 90 estimated to also be long. */
export function progressiveThatAreLong(progressivePer90: number, longPer90: number, family: PositionFamily): number {
  return Math.min(Math.max(0, progressivePer90), Math.max(0, longPassProgressiveRate(family) * longPer90));
}
