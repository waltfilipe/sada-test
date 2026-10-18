/**
 * Minute projection for scouts (empirical Bayes).
 *
 * Question: "He has ~20% of minutes and strong rates — how much can I trust that,
 * and what if he played starter minutes?"
 *
 * - Prior μ, τ², n₀: fitted from the position pool, weighting peers with similar
 *   minutes % and age (cohort).
 * - Posterior mean (cenário realista): w·y + (1−w)·μ with w = exposure / (exposure + n₀).
 * - Pessimista / otimista: posterior ± z₉₀·σ_pred, where σ_pred combines uncertainty
 *   about true talent (τ) and sampling noise (binomial for %, Poisson-like for rates).
 * - hotStreakRegressionPct: average expected drop on metrics already above μ (answers
 *   "would the good numbers sustain?").
 */
import { isSeasonTotalLabel } from "@/lib/seasonTotals";
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

/** How much the observed per-90 / % rates are trusted vs the cohort prior. */
export type ProjectionReliability = {
  /** Mean share of the estimate from the player's own minutes (0–1). */
  sampleWeight: number;
  /** Human label for scouts. */
  tier: "baixa" | "media" | "alta";
  /** Average % drop on volume/efficiency lines already above the cohort mean (hot streak). */
  hotStreakRegressionPct: number | null;
  /** Colocação no pool de titulares: pessimista → realista → otimista. */
  rankSpread: { negativa: number; realista: number; positiva: number; poolSize: number };
};

export type MinuteProjectionReport = {
  negativa: RealisticProjection;
  realista: RealisticProjection;
  positiva: RealisticProjection;
  reliability: ProjectionReliability;
};

const Z90 = 1.2815515655446004;
/** Typical decision events per 90 used to widen % intervals when attempt counts are unknown. */
const EFF_TRIALS_PER_90 = 6;
const MIN_GROUP = 8;
const MIN_METRICS = 3;
const FALLBACK_N0 = 4;
/** Nineties before a per-90 rate is trusted. Below this, small samples stay too close to a hot streak. */
const N0_FLOOR = 18;
const N0_MAX = 40;

/** Share bars (pass tendency) are pool percents, not per-90 rates — projection stays on volume/efficiency metrics. */
const SKIP_KINDS = new Set(["construction_share"]);

type Prior = {
  mu: number;
  tau2: number;
  n0: number;
  refRates: number[];
  /** Mean nineties of the regulars. Used to write a predicted season count. */
  refExposure: number;
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
  adverse?: boolean;
  seasonCount?: boolean;
};

type BuiltModel = {
  exposure: number;
  metrics: MetricFit[];
  peerIndexes: number[];
  target: PlayerProfile;
};

type Sample = {
  key: string;
  value: number;
  kind: MetricKind;
  rank: boolean;
  sample: string;
  /** Lower is the generous reading. A short sample below the mean is pulled up. */
  adverse?: boolean;
  /** Observed value is a season count. The fit uses a per-90 rate and the display writes an integer total. */
  seasonCount?: boolean;
};

type PoolPoint = {
  e: number;
  value: number;
  low: boolean;
  minutesPct: number;
  birthYear: number | null;
};

type TargetCovariates = {
  minutesPct: number;
  birthYear: number | null;
  exposure: number;
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

/** Realistic per-90 profile at starter exposure. Bars and rank use only players with at least half the minutes. */
export function realisticProjection(player: PlayerProfile, players: PlayerProfile[]): RealisticProjection | null {
  return scenarioProjection(player, players, "realista");
}

/** Full scout readout: expected line plus 80% bands (pessimista / otimista) and a confidence summary. */
export function minuteProjectionReport(
  player: PlayerProfile,
  players: PlayerProfile[],
): MinuteProjectionReport | null {
  const model = modelFor(player, players);
  if (!model) return null;

  const negativa = buildScenario(model, player, "negativa");
  const realista = buildScenario(model, player, "realista");
  const positiva = buildScenario(model, player, "positiva");

  return {
    negativa,
    realista,
    positiva,
    reliability: reliabilityFrom(model, realista.weight, {
      negativa: negativa.rank,
      realista: realista.rank,
      positiva: positiva.rank,
      poolSize: realista.poolSize,
    }),
  };
}

function scenarioProjection(
  player: PlayerProfile,
  players: PlayerProfile[],
  scenario: ProjectionScenario,
): RealisticProjection | null {
  const model = modelFor(player, players);
  if (!model) return null;
  return buildScenario(model, player, scenario);
}

function buildScenario(model: BuiltModel, player: PlayerProfile, scenario: ProjectionScenario): RealisticProjection {
  const placement = placementFrom(model, scenario);
  return {
    ...placement,
    profile: applyProjectedMetrics(player, projectedMetrics(model, scenario)),
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
  const covariates = targetCovariates(model.target);
  for (const metric of model.metrics) {
    const n0 = effectiveN0(metric.prior.n0, covariates);
    const next = projectRate(
      metric.y,
      model.exposure,
      { ...metric.prior, n0 },
      scenario,
      metric.adverse,
      metric.kind,
    );
    const value = metric.kind === "percent" ? clamp(next.value, 0, 100) : next.value;
    const standing = midrankPercentile(value, metric.referenceRates);
    projected.set(metric.key, {
      value,
      weight: next.weight,
      percentile: metric.adverse ? 100 - standing : standing,
      kind: metric.kind,
      sample: metric.sample,
      adverse: metric.adverse,
      seasonCount: metric.seasonCount,
      refExposure: metric.prior.refExposure,
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

  const observations = new Map<string, PoolPoint[]>();
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
      observations.get(sample.key)!.push({
        e: exposure,
        value: found.value,
        low,
        minutesPct: candidate.minutes_pct,
        birthYear: candidate.birth_year ?? null,
      });
    }
  }

  const covariates = targetCovariates(player);
  const metrics: MetricFit[] = [];
  for (const sample of target) {
    const points = observations.get(sample.key) ?? [];
    const prior = fitPrior(points, covariates);
    if (!prior) continue;
    metrics.push({
      key: sample.key,
      y: sample.value,
      prior,
      referenceRates: [...prior.refRates].sort((a, b) => a - b),
      kind: sample.kind,
      rank: sample.rank,
      sample: sample.sample,
      adverse: sample.adverse,
      seasonCount: sample.seasonCount,
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
    target: player,
  };
}

function targetCovariates(player: PlayerProfile): TargetCovariates {
  return {
    minutesPct: player.minutes_pct ?? 0,
    birthYear: player.birth_year ?? null,
    exposure: (player.minutes ?? 0) / 90,
  };
}

/** Similar minutes and age get more weight when estimating the pool prior (empirical Bayes cohort). */
function cohortWeight(point: PoolPoint, target: TargetCovariates): number {
  const wMinutes = Math.exp(-0.5 * ((point.minutesPct - target.minutesPct) / 28) ** 2);
  let wAge = 1;
  if (target.birthYear != null && point.birthYear != null) {
    wAge = Math.exp(-0.5 * ((point.birthYear - target.birthYear) / 4) ** 2);
  }
  return wMinutes * wAge;
}

/** Short minutes pull harder toward the cohort prior; veterans with more sample keep more of their rate. */
function effectiveN0(baseN0: number, target: TargetCovariates): number {
  const minuteFactor = 1 + clamp((50 - target.minutesPct) / 50, 0, 1);
  let ageFactor = 1;
  if (target.birthYear != null) {
    const age = new Date().getFullYear() - target.birthYear;
    if (age <= 22) ageFactor = 1.08;
    else if (age >= 30) ageFactor = 0.92;
  }
  return clamp(baseN0 * minuteFactor * ageFactor, N0_FLOOR, N0_MAX);
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
  if (item.kind === "def_efficiency_group") {
    const out: Sample[] = [];
    for (const sub of item.sub_metrics ?? []) {
      if (/erro/i.test(sub.label)) {
        const sample = sampleFrom(item.label, sub.label, sub.display_value, exposure);
        if (sample) out.push(sample);
        continue;
      }
      if (/efici[eê]ncia/i.test(sub.label)) {
        const sample = sampleFrom(item.label, sub.label, sub.display_value, exposure, { zScore: true });
        if (sample) out.push({ ...sample, rank: true });
      }
    }
    return out;
  }
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
    if (sample) samples.push({ ...sample, rank: true });
  }
  return samples;
}

function sampleFrom(
  parent: string | null,
  label: string,
  display: string | null | undefined,
  exposure: number,
  options?: { zScore?: boolean },
): Sample | null {
  const raw = (display ?? "").trim();
  if (!raw) return null;
  const key = parent ? `${parent}::${label}` : label;
  const normalized = label.trim().toLowerCase();
  if (!options?.zScore && raw.startsWith("+")) return null;
  const adverse = /erro/.test(normalized);
  const seasonCount = isSeasonTotalLabel(label);

  if (raw.includes("%")) {
    const value = parsePercent(raw);
    if (value == null) return null;
    return { key, value, kind: "percent", rank: true, sample: raw };
  }

  const parsed = options?.zScore ? parseSignedRate(raw) : parseRate(raw);
  if (parsed == null) return null;
  if (seasonCount || adverse) {
    if (exposure <= 0) return null;
    return { key, value: parsed / exposure, kind: "rate", rank: false, sample: raw, adverse, seasonCount };
  }
  if (options?.zScore) {
    return { key, value: parsed, kind: "rate", rank: true, sample: raw };
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
  adverse?: boolean;
  seasonCount?: boolean;
  refExposure?: number;
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
  if (metric.adverse || metric.seasonCount) {
    const count = metric.value * (metric.refExposure || 1);
    const rounded = Math.round(count);
    return String(metric.adverse ? rounded : Math.max(0, rounded));
  }
  const fraction = metric.sample.split(",")[1];
  const decimals = fraction ? Math.min(2, Math.max(1, fraction.length)) : 1;
  const formatted = metric.value.toFixed(decimals).replace(".", ",");
  if (metric.sample.trim().startsWith("-") || metric.sample.trim().startsWith("−")) {
    return metric.value < 0 ? formatted : `-${formatted}`;
  }
  return formatted;
}

function fitPrior(points: PoolPoint[], target: TargetCovariates): Prior | null {
  const pool = points.filter((point) => point.e > 0);
  if (pool.length < MIN_GROUP) return null;

  const ref = pool.filter((point) => !point.low);
  const refRates = ref.length >= MIN_GROUP ? ref.map((point) => point.value) : pool.map((point) => point.value);
  const refExposure = mean((ref.length >= MIN_GROUP ? ref : pool).map((point) => point.e));

  const weights = pool.map((point) => cohortWeight(point, target) * point.e);
  const mu = weightedMean(
    pool.map((point) => point.value),
    weights,
  );

  const msdRef = meanSquare(ref.length >= MIN_GROUP ? ref.map((point) => point.value) : pool.map((point) => point.value));
  const invRef = weightedMean(
    (ref.length >= MIN_GROUP ? ref : pool).map((point) => 1 / point.e),
    (ref.length >= MIN_GROUP ? ref : pool).map((point) => cohortWeight(point, target)),
  );

  let tau2 = 0;
  let n0 = FALLBACK_N0;

  const low = pool.filter((point) => point.low);
  if (low.length >= MIN_GROUP && msdRef > 0) {
    const msdLow = meanSquare(low.map((point) => point.value));
    const invLow = weightedMean(
      low.map((point) => 1 / point.e),
      low.map((point) => cohortWeight(point, target)),
    );
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
    const factor = weightedMean(
      (ref.length >= MIN_GROUP ? ref : pool).map((point) => (point.e + n0) / point.e),
      (ref.length >= MIN_GROUP ? ref : pool).map((point) => cohortWeight(point, target)),
    );
    tau2 = msdRef > 0 && factor > 0 ? msdRef / factor : 0;
  }
  if (!(tau2 > 0) || !Number.isFinite(mu)) return null;

  return { mu, tau2, n0: clamp(Math.max(n0, N0_FLOOR), N0_FLOOR, N0_MAX), refRates, refExposure };
}

function projectRate(
  y: number,
  exposure: number,
  prior: Prior,
  scenario: ProjectionScenario,
  adverse = false,
  kind: MetricKind = "rate",
): { value: number; weight: number } {
  const weight = exposure / (exposure + prior.n0);
  const posteriorMean = weight * y + (1 - weight) * prior.mu;
  const sd = predictiveSd(y, exposure, prior, weight, kind, adverse);
  let value = posteriorMean;
  if (scenario === "negativa") value = posteriorMean - Z90 * sd;
  else if (scenario === "positiva") value = posteriorMean + Z90 * sd;
  return { value: metricFloor(value, adverse), weight };
}

/** Epistemic (between-player) + sampling noise for small per-90 / % samples. */
function predictiveSd(
  y: number,
  exposure: number,
  prior: Prior,
  weight: number,
  kind: MetricKind,
  adverse: boolean,
): number {
  const epistemic = Math.sqrt(Math.max(prior.tau2 * (1 - weight), 0));
  let aleatory = 0;
  if (kind === "percent") {
    const p = clamp(y, 0.05, 99.95) / 100;
    const trials = Math.max(exposure * EFF_TRIALS_PER_90, 8);
    aleatory = Math.sqrt((p * (1 - p)) / trials);
  } else if (!adverse) {
    const rate = Math.max(Math.abs(y), 0.04);
    aleatory = Math.sqrt(rate / Math.max(exposure, 0.35));
  }
  return Math.sqrt(epistemic * epistemic + aleatory * aleatory);
}

function reliabilityFrom(
  model: BuiltModel,
  sampleWeight: number,
  ranks: ProjectionReliability["rankSpread"],
): ProjectionReliability {
  const covariates = targetCovariates(model.target);
  let hotSum = 0;
  let hotN = 0;
  for (const metric of model.metrics) {
    if (metric.adverse || metric.seasonCount || !metric.rank) continue;
    if (metric.y <= metric.prior.mu + 1e-9) continue;
    const n0 = effectiveN0(metric.prior.n0, covariates);
    const w = model.exposure / (model.exposure + n0);
    const projected = w * metric.y + (1 - w) * metric.prior.mu;
    hotSum += (metric.y - projected) / metric.y;
    hotN += 1;
  }

  return {
    sampleWeight,
    tier: confidenceTier(sampleWeight),
    hotStreakRegressionPct: hotN ? (hotSum / hotN) * 100 : null,
    rankSpread: ranks,
  };
}

export function confidenceTier(sampleWeight: number): ProjectionReliability["tier"] {
  if (sampleWeight >= 0.34) return "alta";
  if (sampleWeight >= 0.22) return "media";
  return "baixa";
}

export function confidenceTierLabel(tier: ProjectionReliability["tier"]): string {
  if (tier === "alta") return "Confiança alta na amostra";
  if (tier === "media") return "Confiança média — boa leitura, mas ainda regredindo à média";
  return "Confiança baixa — poucos minutos; leitura puxada ao grupo parecido";
}

function metricFloor(value: number, adverse: boolean): number {
  if (adverse) return value < 0 ? 0 : value;
  return value;
}

function isVolumeLabel(label: string | undefined): boolean {
  const normalized = (label ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("%") || normalized.includes("/")) return false;
  if (/erro|efici[eê]ncia/.test(normalized)) return false;
  return !isSeasonTotalLabel(label ?? "");
}

function parseRate(display: string): number | null {
  const normalized = display.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseSignedRate(display: string): number | null {
  const normalized = display.replace(/\s/g, "").replace("−", "-").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
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

function weightedMean(values: number[], weights: number[]): number {
  let total = 0;
  let mass = 0;
  for (let i = 0; i < values.length; i += 1) {
    const w = weights[i] ?? 0;
    total += values[i] * w;
    mass += w;
  }
  return mass > 0 ? total / mass : mean(values);
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
