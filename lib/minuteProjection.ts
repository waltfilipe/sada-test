import type { AspectItem, PlayerProfile } from "@/lib/types";

export type ProjectionScenario = "negativa" | "realista" | "positiva";

export type ProjectionPlacement = {
  rank: number;
  poolSize: number;
  /** Share of the estimate that comes from the player's own minutes, 0–1. */
  weight: number;
  scenario: ProjectionScenario;
};

export type RealisticProjection = ProjectionPlacement & {
  profile: PlayerProfile;
};

const Z90 = 1.2815515655446004;
const MIN_GROUP = 8;
const MIN_METRICS = 3;
const FALLBACK_N0 = 4;
/** Nineties before a per-90 rate is trusted. Below this, small samples stay too close to a hot streak. */
const N0_FLOOR = 18;
const N0_MAX = 40;

const SKIP_KINDS = new Set(["construction_share", "def_efficiency_group"]);
const SEASON_TOTALS = new Set(["gols", "xg", "pré assistências", "pre assistências", "erros totais"]);

type Prior = {
  mu: number;
  tau2: number;
  n0: number;
  refRates: number[];
};

type MetricKind = "rate" | "percent";

type MetricFit = {
  key: string;
  y: number;
  prior: Prior;
  /** Observed rates of players with at least half the minutes, sorted. */
  referenceRates: number[];
  kind: MetricKind;
  rank: boolean;
  sample: string;
};

type BuiltModel = {
  exposure: number;
  metrics: MetricFit[];
  peerIndexes: number[];
};

type Sample = {
  key: string;
  value: number;
  kind: MetricKind;
  rank: boolean;
  sample: string;
};

const modelCache = new WeakMap<PlayerProfile[], Map<string, BuiltModel | null>>();

export function isProjectionEligible(player: { minutes?: number | null; minutes_pct?: number | null }): boolean {
  return (player.minutes ?? 0) > 0 && player.minutes_pct != null && player.minutes_pct < 50;
}

export function projectionPlacement(
  player: PlayerProfile,
  players: PlayerProfile[],
  scenario: ProjectionScenario,
): ProjectionPlacement | null {
  const model = modelFor(player, players);
  if (!model) return null;
  return placementFrom(model, scenario);
}

/** Realistic per-90 profile. Rates above the regulars' mean shrink toward it; rates already below stay put. Bars and rank use only players with at least half the minutes. */
export function realisticProjection(player: PlayerProfile, players: PlayerProfile[]): RealisticProjection | null {
  const model = modelFor(player, players);
  if (!model) return null;
  const placement = placementFrom(model, "realista");
  return {
    ...placement,
    profile: applyProjectedMetrics(player, projectedMetrics(model, "realista")),
  };
}

function modelFor(player: PlayerProfile, players: PlayerProfile[]): BuiltModel | null {
  if (!isProjectionEligible(player)) return null;
  let byPlayer = modelCache.get(players);
  if (!byPlayer) {
    byPlayer = new Map();
    modelCache.set(players, byPlayer);
  }
  const cached = byPlayer.get(player.player_id);
  if (cached !== undefined) return cached;
  const built = buildModel(player, players);
  byPlayer.set(player.player_id, built);
  return built;
}

function placementFrom(model: BuiltModel, scenario: ProjectionScenario): ProjectionPlacement {
  const ranked = model.metrics.filter((metric) => metric.rank);
  const projected = projectedMetrics(model, scenario);
  const percentiles: number[] = [];
  const weights: number[] = [];
  for (const metric of ranked) {
    const hit = projected.get(metric.key);
    if (!hit) continue;
    percentiles.push(hit.percentile);
    weights.push(hit.weight);
  }
  const index = mean(percentiles);
  let higher = 0;
  for (const peer of model.peerIndexes) {
    if (peer > index + 1e-9) higher += 1;
  }
  return {
    rank: higher + 1,
    poolSize: model.peerIndexes.length + 1,
    weight: mean(weights),
    scenario,
  };
}

function projectedMetrics(model: BuiltModel, scenario: ProjectionScenario): Map<string, ProjectedMetric> {
  const projected = new Map<string, ProjectedMetric>();
  for (const metric of model.metrics) {
    const next = projectRate(metric.y, model.exposure, metric.prior, scenario);
    const value = metric.kind === "percent" ? clamp(next.value, 0, 100) : next.value;
    projected.set(metric.key, {
      value,
      weight: next.weight,
      percentile: midrankPercentile(value, metric.referenceRates),
      kind: metric.kind,
      sample: metric.sample,
    });
  }
  return projected;
}

function buildModel(player: PlayerProfile, players: PlayerProfile[]): BuiltModel | null {
  const samplesById = new Map<string, Sample[]>();
  const samplesOfId = (candidate: PlayerProfile) => {
    let samples = samplesById.get(candidate.player_id);
    if (!samples) {
      samples = samplesOf(candidate);
      samplesById.set(candidate.player_id, samples);
    }
    return samples;
  };

  const target = samplesOfId(player);
  const rankedTarget = target.filter((sample) => sample.rank);
  if (rankedTarget.length < MIN_METRICS) return null;

  const observations = new Map<string, { e: number; value: number; low: boolean }[]>();
  for (const sample of target) observations.set(sample.key, []);

  for (const candidate of players) {
    const minutes = candidate.minutes ?? 0;
    if (minutes <= 0 || candidate.minutes_pct == null) continue;
    const exposure = minutes / 90;
    const low = candidate.minutes_pct < 50;
    const byKey = new Map(samplesOfId(candidate).map((sample) => [sample.key, sample]));
    for (const sample of target) {
      const found = byKey.get(sample.key);
      if (!found) continue;
      observations.get(sample.key)!.push({ e: exposure, value: found.value, low });
    }
  }

  const metrics: MetricFit[] = [];
  for (const sample of target) {
    const points = observations.get(sample.key) ?? [];
    const prior = fitPrior(points);
    if (!prior) continue;
    metrics.push({
      key: sample.key,
      y: sample.value,
      prior,
      referenceRates: [...prior.refRates].sort((a, b) => a - b),
      kind: sample.kind,
      rank: sample.rank,
      sample: sample.sample,
    });
  }
  if (metrics.filter((metric) => metric.rank).length < MIN_METRICS) return null;

  const ranked = metrics.filter((metric) => metric.rank);
  const minimumOverlap = Math.min(MIN_METRICS, ranked.length);
  const peerIndexes: number[] = [];
  for (const candidate of players) {
    if (candidate.player_id === player.player_id) continue;
    if ((candidate.minutes ?? 0) <= 0 || candidate.minutes_pct == null || candidate.minutes_pct < 50) continue;
    const byKey = new Map(samplesOfId(candidate).map((sample) => [sample.key, sample.value]));
    const percentiles: number[] = [];
    for (const metric of ranked) {
      const value = byKey.get(metric.key);
      if (value == null) continue;
      percentiles.push(midrankPercentile(value, metric.referenceRates));
    }
    if (percentiles.length < minimumOverlap) continue;
    peerIndexes.push(mean(percentiles));
  }

  return {
    exposure: player.minutes / 90,
    metrics,
    peerIndexes,
  };
}

function samplesOf(player: PlayerProfile): Sample[] {
  const exposure = (player.minutes ?? 0) / 90;
  const samples: Sample[] = [];
  for (const items of Object.values(player.aspects ?? {})) {
    if (!items) continue;
    for (const item of items) samples.push(...samplesFromAspect(item, exposure));
  }
  return samples;
}

function samplesFromAspect(item: AspectItem, exposure: number): Sample[] {
  if (SKIP_KINDS.has(item.kind ?? "")) return [];
  const samples: Sample[] = [];
  const subs = item.sub_metrics ?? [];
  if (subs.length) {
    for (const sub of subs) {
      const sample = sampleFrom(item.label, sub.label, sub.display_value, exposure);
      if (sample) samples.push(sample);
    }
  } else {
    const sample = sampleFrom(null, item.label, item.display_value, exposure);
    if (sample) samples.push(sample);
  }
  if (item.efficiency_value) {
    const sample = sampleFrom(item.label, "Eficiência", item.efficiency_value, exposure);
    if (sample) samples.push({ ...sample, rank: false });
  }
  return samples;
}

function sampleFrom(
  parent: string | null,
  label: string,
  display: string | null | undefined,
  exposure: number,
): Sample | null {
  const raw = (display ?? "").trim();
  if (!raw) return null;
  const key = parent ? `${parent}::${label}` : label;
  const normalized = label.trim().toLowerCase();
  if (/erro/.test(normalized) || /^[+\-−]/.test(raw)) return null;
  // Defender xA is a season total shown on the hero. It is not a ranked per-90 rate.
  if (normalized === "xa" && parent === "Gols e xG") return null;

  if (raw.includes("%")) {
    const value = parsePercent(raw);
    if (value == null) return null;
    return { key, value, kind: "percent", rank: false, sample: raw };
  }

  const parsed = parseRate(raw);
  if (parsed == null) return null;
  if (SEASON_TOTALS.has(normalized)) {
    if (exposure <= 0) return null;
    return { key, value: parsed / exposure, kind: "rate", rank: false, sample: raw };
  }
  if (!isVolumeLabel(label)) return null;
  return { key, value: parsed, kind: "rate", rank: true, sample: raw };
}

type ProjectedMetric = {
  value: number;
  weight: number;
  percentile: number;
  kind: MetricKind;
  sample: string;
};

function applyProjectedMetrics(player: PlayerProfile, projected: Map<string, ProjectedMetric>): PlayerProfile {
  const clone = structuredClone(player);
  for (const items of Object.values(clone.aspects ?? {})) {
    if (!items) continue;
    for (const item of items) {
      const own = projected.get(item.label);
      if (own && !item.sub_metrics?.length) {
        item.display_value = formatProjected(own);
        item.percentile = round1(own.percentile);
      }
      const efficiency = projected.get(`${item.label}::Eficiência`);
      if (efficiency && item.efficiency_value) {
        item.efficiency_value = formatProjected(efficiency);
        item.efficiency_pct = round1(efficiency.percentile);
      }
      for (const sub of item.sub_metrics ?? []) {
        const hit = projected.get(`${item.label}::${sub.label}`);
        if (!hit) continue;
        sub.display_value = formatProjected(hit);
        sub.percentile = round1(hit.percentile);
      }
    }
  }
  return clone;
}

function formatProjected(metric: ProjectedMetric): string {
  if (metric.kind === "percent") return `${Math.round(metric.value)}%`;
  const fraction = metric.sample.split(",")[1];
  const decimals = fraction ? Math.min(2, Math.max(1, fraction.length)) : 1;
  return metric.value.toFixed(decimals).replace(".", ",");
}

function fitPrior(points: { e: number; value: number; low: boolean }[]): Prior | null {
  const ref = points.filter((point) => !point.low && point.e > 0);
  if (ref.length < MIN_GROUP) return null;

  const refRates = ref.map((point) => point.value);
  const mu = mean(refRates);
  const msdRef = meanSquare(refRates);
  const invRef = mean(ref.map((point) => 1 / point.e));
  let tau2 = 0;
  let n0 = FALLBACK_N0;

  const low = points.filter((point) => point.low && point.e > 0);
  if (low.length >= MIN_GROUP && msdRef > 0) {
    const msdLow = meanSquare(low.map((point) => point.value));
    const invLow = mean(low.map((point) => 1 / point.e));
    const denom = invLow - invRef;
    const sigma2 = denom > 1e-6 ? (msdLow - msdRef) / denom : -1;
    if (sigma2 > 0) {
      const tau = msdRef - sigma2 * invRef;
      if (tau > 1e-8) {
        tau2 = tau;
        n0 = clamp(sigma2 / tau2, N0_FLOOR, N0_MAX);
      }
    }
  }

  if (!(tau2 > 0)) {
    n0 = FALLBACK_N0;
    const factor = mean(ref.map((point) => (point.e + n0) / point.e));
    tau2 = msdRef > 0 && factor > 0 ? msdRef / factor : 0;
  }
  if (!(tau2 > 0) || !Number.isFinite(mu)) return null;

  return { mu, tau2, n0: clamp(Math.max(n0, N0_FLOOR), N0_FLOOR, N0_MAX), refRates };
}

function projectRate(
  y: number,
  exposure: number,
  prior: Prior,
  scenario: ProjectionScenario,
): { value: number; weight: number } {
  const weight = exposure / (exposure + prior.n0);
  const realistic = weight * y + (1 - weight) * prior.mu;
  const sd = Math.sqrt(prior.tau2 * (1 - weight));
  let value = realistic;
  if (scenario === "negativa") value = realistic - Z90 * sd;
  else if (scenario === "positiva") value = realistic + Z90 * sd;
  else if (y < prior.mu) {
    // A short sample that is already below the regulars' mean is not revised upward.
    value = y;
  }
  return { value: metricFloor(value), weight };
}

function metricFloor(value: number): number {
  return value < 0 ? 0 : value;
}

function isVolumeLabel(label: string | undefined): boolean {
  const normalized = (label ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("%") || normalized.includes("/")) return false;
  if (/erro|efici[eê]ncia/.test(normalized)) return false;
  return !SEASON_TOTALS.has(normalized);
}

function parseRate(display: string): number | null {
  const normalized = display.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parsePercent(display: string): number | null {
  return parseRate(display.replace("%", ""));
}

function midrankPercentile(value: number, sorted: number[]): number {
  const count = sorted.length;
  if (!count) return 50;
  let below = 0;
  let high = count;
  while (below < high) {
    const mid = (below + high) >> 1;
    if (sorted[mid] < value) below = mid + 1;
    else high = mid;
  }
  let end = below;
  high = count;
  while (end < high) {
    const mid = (end + high) >> 1;
    if (sorted[mid] <= value) end = mid + 1;
    else high = mid;
  }
  return ((below + 0.5 * (end - below)) / count) * 100;
}

function mean(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function meanSquare(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  let total = 0;
  for (const value of values) {
    const delta = value - center;
    total += delta * delta;
  }
  return total / (values.length - 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
