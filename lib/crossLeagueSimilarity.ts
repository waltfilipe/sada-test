import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

export type SimilarPlayerHit = {
  player_id: string;
  name: string;
  club: string;
  profile: string;
  rating: number;
  similarity: number;
};

type MetricSlot =
  | { id: string; label: string; kind: "volume" }
  | { id: string; label: string; kind: "efficiency" }
  | { id: string; label: string; kind: "sub"; subLabel: string };

const NEUTRAL_PERCENTILE = 50;

/** Percentile rank of `value` within `pool` (0–100). */
function percentileInPool(value: number, pool: number[]): number {
  if (!pool.length) return NEUTRAL_PERCENTILE;
  const sorted = [...pool].sort((a, b) => a - b);
  const idx = sorted.findIndex((v) => v >= value);
  if (idx === -1) return 100;
  return ((idx + 0.5) / sorted.length) * 100;
}

function parseDisplayNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function aspectItem(player: PlayerProfile, label: string): AspectItem | undefined {
  return findAspect(flattenAspects(player), label);
}

function storedPercentile(item: AspectItem | undefined, slot: MetricSlot): number | null {
  if (!item) return null;
  if (slot.kind === "sub") {
    return item.sub_metrics?.find((sub) => sub.label === slot.subLabel)?.percentile ?? null;
  }
  if (slot.kind === "efficiency") return item.efficiency_pct ?? null;
  return item.percentile ?? null;
}

/** Prefer per90 / display for cross-pool ranking; fall back to stored percentile. */
function rawForSlot(player: PlayerProfile, slot: MetricSlot): number | null {
  const item = aspectItem(player, slot.label);
  if (!item) return null;
  if (slot.kind === "sub") {
    const sub = item.sub_metrics?.find((s) => s.label === slot.subLabel);
    return parseDisplayNumber(sub?.display_value) ?? sub?.percentile ?? null;
  }
  if (slot.kind === "efficiency") return item.efficiency_pct ?? null;
  if (item.certos_per90 != null) return item.certos_per90;
  return parseDisplayNumber(item.display_value) ?? item.percentile ?? null;
}

function percentileForSlot(player: PlayerProfile, pool: PlayerProfile[], slot: MetricSlot): number {
  const values = pool
    .map((p) => rawForSlot(p, slot))
    .filter((value): value is number => value != null);
  const raw = rawForSlot(player, slot);
  if (raw != null && values.length >= 3) {
    return percentileInPool(raw, values);
  }

  const stored = pool
    .map((p) => storedPercentile(aspectItem(p, slot.label), slot))
    .filter((value): value is number => value != null);
  const mine = storedPercentile(aspectItem(player, slot.label), slot);
  if (mine != null && stored.length >= 3) {
    return percentileInPool(mine, stored);
  }
  return mine ?? NEUTRAL_PERCENTILE;
}

function metricSlotsForFamily(pool: PlayerProfile[], family: PositionFamily): MetricSlot[] {
  const sectionLabels = statSectionsForFamily(family).flatMap((section) => section.labels);
  const slots: MetricSlot[] = [];

  for (const label of sectionLabels) {
    slots.push({ id: `${label}::vol`, label, kind: "volume" });
    slots.push({ id: `${label}::eff`, label, kind: "efficiency" });

    const subLabels = new Set<string>();
    for (const player of pool) {
      const item = aspectItem(player, label);
      item?.sub_metrics?.forEach((sub) => subLabels.add(sub.label));
    }
    for (const subLabel of [...subLabels].sort()) {
      slots.push({ id: `${label}::sub::${subLabel}`, label, kind: "sub", subLabel });
    }
  }

  return slots;
}

function featureVectorFromAspectPercentiles(
  player: PlayerProfile,
  pool: PlayerProfile[],
  slots: MetricSlot[],
): number[] {
  return slots.map((slot) => {
    const pct = percentileForSlot(player, pool, slot);
    return Math.max(0, Math.min(1, pct / 100));
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Top cross-league matches using **stat percentiles** from the dossier (aspect cards),
 * not tendency axes.
 *
 * For each metric in the position stat sections (volume, efficiency, sub-metrics),
 * we express every player — including the source from another league — as a
 * **percentile within the destination pool** (raw per90 / display when available).
 *
 * Similarity = cosine similarity between those percentile vectors (0–100%).
 * +3 pp when the main tactical profile label matches.
 */
export function rankCrossLeagueSimilarity(
  source: PlayerProfile,
  targetPool: PlayerProfile[],
  options: { limit?: number; minMinutes?: number } = {},
): SimilarPlayerHit[] {
  const limit = options.limit ?? 5;
  const minMinutes = options.minMinutes ?? 300;
  const family = source.position_family;

  const sameFamily = targetPool.filter(
    (p) => p.position_family === family && p.minutes >= minMinutes,
  );
  if (!sameFamily.length) return [];

  const slots = metricSlotsForFamily(sameFamily, family);
  if (!slots.length) return [];

  const sourceVec = featureVectorFromAspectPercentiles(source, sameFamily, slots);

  const scored: SimilarPlayerHit[] = [];

  for (const candidate of sameFamily) {
    if (candidate.player_id === source.player_id) continue;

    const candVec = featureVectorFromAspectPercentiles(candidate, sameFamily, slots);
    let sim = cosineSimilarity(sourceVec, candVec) * 100;

    if (candidate.profile === source.profile) {
      sim = Math.min(100, sim + 3);
    }

    scored.push({
      player_id: candidate.player_id,
      name: candidate.name,
      club: candidate.club,
      profile: candidate.profile,
      rating: candidate.rating,
      similarity: Math.round(sim * 10) / 10,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity || b.rating - a.rating);
  return scored.slice(0, limit);
}
