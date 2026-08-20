import type { AccuracyBadgeKind } from "@/lib/types";

/**
 * Pool percentile cutoffs aligned with scouting convention:
 * P90 (top 10%), P75 (top quartile), P50 (above median).
 */
const P90 = 90;
const P75 = 75;
const P50 = 50;

/** Badge when volume AND efficiency both exceed pool thresholds. */
export function dualMetricBadge(volumePct: number, efficiencyPct?: number | null): AccuracyBadgeKind | null {
  if (efficiencyPct == null) return null;
  const floor = Math.min(volumePct, efficiencyPct);
  if (floor > P90) return "gold";
  if (floor > P75) return "silver";
  if (floor > P50) return "bronze";
  return null;
}

export function pairBadge(a: number, b: number): AccuracyBadgeKind | null {
  return dualMetricBadge(a, b);
}

/** Single-metric badge (e.g. conduções progressivas / volume-only stats). */
export function volumeBadge(volumePct: number): AccuracyBadgeKind | null {
  if (volumePct > P90) return "gold";
  if (volumePct > P75) return "silver";
  if (volumePct > P50) return "bronze";
  return null;
}

export function resolveAspectBadge(item: {
  label: string;
  kind?: string;
  percentile?: number;
  efficiency_pct?: number;
  pair_badge?: [number, number] | null;
}): AccuracyBadgeKind | null {
  if (item.kind === "def_efficiency_group" && item.pair_badge) {
    return pairBadge(item.pair_badge[0], item.pair_badge[1]);
  }
  if (item.efficiency_pct != null && item.percentile != null) {
    return dualMetricBadge(item.percentile, item.efficiency_pct);
  }
  if (item.label === "Conduções Progressivas" && item.percentile != null) {
    return volumeBadge(item.percentile);
  }
  return null;
}
