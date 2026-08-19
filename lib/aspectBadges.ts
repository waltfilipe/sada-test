import type { AccuracyBadgeKind } from "@/lib/types";

/** Badge when volume AND efficiency both exceed pool thresholds. */
export function dualMetricBadge(volumePct: number, efficiencyPct?: number | null): AccuracyBadgeKind | null {
  if (efficiencyPct == null) return null;
  const floor = Math.min(volumePct, efficiencyPct);
  if (floor > 90) return "gold";
  if (floor > 75) return "silver";
  if (floor > 50) return "bronze";
  return null;
}

export function pairBadge(a: number, b: number): AccuracyBadgeKind | null {
  return dualMetricBadge(a, b);
}
