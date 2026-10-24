/**
 * Minute projection for scouts (M7 + cross-season history).
 *
 * Empirical Bayes with k calibrated on the division pool (pseudo-holdout, same idea as lab M7):
 *   posterior = (y · n90 + μ · k) / (n90 + k)
 * μ is the supervised cross-season prediction when available (Wyscout 2022–2025 build);
 * otherwise μ = 50% titulares + 50% mesmo perfil na divisão.
 * role_change_flag caps effective n90 so short noisy 2026 samples regress to μ.
 * Pessimista / otimista: posterior ± z90 · σ_pred.
 */
import { isSeasonTotalLabel } from "@/lib/seasonTotals";
import type { AspectItem, PlayerProfile } from "@/lib/types";

export type ProjectionScenario = "negativa" | "realista" | "positiva";

export type ProjectionPlacement = {
  /** Share of the estimate from the player's own sample, 0–1 (1 − pull toward μ). */
  weight: number;
  scenario: ProjectionScenario;
};

export type RealisticProjection = ProjectionPlacement & {
  profile: PlayerProfile;
};

/** How much the observed per-90 / % rates are trusted vs the mixed prior. */
export type ProjectionReliability = {
  /** Mean share of the estimate from the player's own minutes (0–1). */
  sampleWeight: number;
  /** Human label for scouts. */
  tier: "baixa" | "media" | "alta";
  /** Average % drop on volume/efficiency lines already above the mixed prior (hot streak). */
  hotStreakRegressionPct: number | null;
  /** Metrics where current season looks like noise vs prior seasons (low minutes). */
  roleChangeFlags: number;
  crossSeasonSeasons: number;
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
const N0_FLOOR = 18;
const N0_MAX = 40;
const STARTER_MINUTES_PCT = 50;
/** Default EB prior strength (nineties) before pool calibration. */
const DEFAULT_K_EB = 10;
const K_EB_MIN = 4;
const K_EB_MAX = 22;
const K_EB_STEP = 2;
const HELD_N90 = 10;
const PSEUDO_SAMPLE_FRAC = 0.45;

/** Share bars (pass tendency) are pool percents, not per-90 rates — projection stays on volume/efficiency metrics. */
const SKIP_KINDS = new Set(["construction_share"]);

type Prior = {
  mu: number;
  tau2: number;
  n0: number;
  /** Calibrated EB k (M7) for this metric. */
  kEb: number;
  refRates: number[];
  /** Mean nineties of the regulars. Used to write a predicted season count. */
  refExposure: number;
  /** Whether μ came from cross-season supervised model. */
  muFromCrossSeason?: boolean;
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
  /** Low-minute 2026 diverges from stable cross-season history — trust anchor over spike. */
  roleChangeFlag?: boolean;
};

type BuiltModel = {
  exposure: number;
  metrics: MetricFit[];
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
  profile: string | null;
};

const modelCache = new WeakMap<PlayerProfile[], Map<string, BuiltModel | null>>();

export function isProjectionEligible(player: { minutes?: number | null; minutes_pct?: number | null }): boolean {
  return (player.minutes ?? 0) > 0 && player.minutes_pct != null && player.minutes_pct < STARTER_MINUTES_PCT;
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

/** Realistic per-90 profile with minutes-based shrink toward division prior. Percentiles vs regulars (≥50% min). */
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
    reliability: reliabilityFrom(model, realista.weight),
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
  const projected = projectedMetrics(model, scenario);
  const weights: number[] = [];
  for (const metric of model.metrics) {
    if (!metric.rank) continue;
    const hit = projected.get(metric.key);
    if (hit) weights.push(hit.weight);
  }
  return {
    weight: weights.length ? mean(weights) : observationWeight(model.target.minutes_pct ?? 0),
    scenario,
  };
}

function projectedMetrics(model: BuiltModel, scenario: ProjectionScenario): Map<string, ProjectedMetric> {
  const projected = new Map<string, ProjectedMetric>();
  const minutesPct = model.target.minutes_pct ?? 0;
  for (const metric of model.metrics) {
    const next = projectRate(
      metric.y,
      model.exposure,
      metric.prior,
      scenario,
      metric.adverse,
      metric.kind,
      metric.roleChangeFlag,
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
    const low = candidate.minutes_pct < STARTER_MINUTES_PCT;
    const byKey = new Map(samplesOfId(candidate).map((sample) => [sample.key, sample]));
    for (const sample of target) {
      const found = byKey.get(sample.key);
      if (!found) continue;
      observations.get(sample.key)!.push({
        e: exposure,
        value: found.value,
        low,
        profile: candidate.profile ?? null,
      });
    }
  }

  const metrics: MetricFit[] = [];
  for (const sample of target) {
    const points = observations.get(sample.key) ?? [];
    const basePrior = fitPrior(points, player.profile ?? null);
    if (!basePrior) continue;
    const resolved = resolveM7Prior(basePrior, player, sample.key, points);
    metrics.push({
      key: sample.key,
      y: sample.value,
      prior: resolved.prior,
      referenceRates: [...resolved.prior.refRates].sort((a, b) => a - b),
      kind: sample.kind,
      rank: sample.rank,
      sample: sample.sample,
      adverse: sample.adverse,
      seasonCount: sample.seasonCount,
      roleChangeFlag: resolved.roleChangeFlag,
    });
  }
  if (metrics.filter((metric) => metric.rank).length < MIN_METRICS) return null;

  return {
    exposure: player.minutes / 90,
    metrics,
    target: player,
  };
}

/** Share kept from the player's sample; pull toward μ is 1 − this (linear in minutes to 50% of team total). */
export function observationWeight(minutesPct: number): number {
  if (minutesPct >= STARTER_MINUTES_PCT) return 1;
  if (minutesPct <= 0) return 0;
  return clamp(minutesPct / STARTER_MINUTES_PCT, 0, 1);
}

/** Fraction of the gap (observed → μ) applied; equals minutes missing to 50%, divided by 50. */
export function pullTowardPrior(minutesPct: number): number {
  return 1 - observationWeight(minutesPct);
}

function profilesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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

function ebShrink(rate: number, n90: number, mu: number, k: number): number {
  const denom = n90 + k;
  if (denom <= 0) return mu;
  return (rate * n90 + mu * k) / denom;
}

function calibrateKEb(points: PoolPoint[], mu: number): number {
  const held = points.filter((point) => point.e > 0 && !point.low && point.e >= HELD_N90);
  if (held.length < 12) return DEFAULT_K_EB;
  let bestK = DEFAULT_K_EB;
  let bestErr = Infinity;
  for (let k = K_EB_MIN; k <= K_EB_MAX; k += K_EB_STEP) {
    let err = 0;
    let n = 0;
    for (const point of held) {
      const nPartial = point.e * PSEUDO_SAMPLE_FRAC;
      const pseudo = ebShrink(point.value, nPartial, mu, k);
      err += (pseudo - point.value) ** 2;
      n += 1;
    }
    if (n && err / n < bestErr) {
      bestErr = err / n;
      bestK = k;
    }
  }
  return bestK;
}

/** M7 prior: μ from cross-season ridge when present, else division hierarchical mean; k calibrated on pool. */
function resolveM7Prior(
  base: Prior,
  player: PlayerProfile,
  sampleKey: string,
  points: PoolPoint[],
): { prior: Prior; roleChangeFlag?: boolean } {
  const cross = player.cross_season?.metrics?.[sampleKey];
  let mu = base.mu;
  let muFromCrossSeason = false;
  let roleChangeFlag = cross?.role_change_flag;
  if (cross && Number.isFinite(cross.predicted)) {
    mu = cross.predicted;
    muFromCrossSeason = true;
  }
  const kEb = calibrateKEb(points, mu);
  return {
    prior: { ...base, mu, kEb, muFromCrossSeason },
    roleChangeFlag,
  };
}

function fitPrior(points: PoolPoint[], targetProfile: string | null): Prior | null {
  const pool = points.filter((point) => point.e > 0);
  if (pool.length < MIN_GROUP) return null;

  const ref = pool.filter((point) => !point.low);
  const refPool = ref.length >= MIN_GROUP ? ref : pool;
  const refRates = refPool.map((point) => point.value);
  const refExposure = mean(refPool.map((point) => point.e));

  const muMean = weightedMean(
    refPool.map((point) => point.value),
    refPool.map((point) => point.e),
  );

  let peerPool = pool.filter((point) => profilesMatch(point.profile, targetProfile));
  if (peerPool.length < MIN_GROUP) {
    peerPool = refPool;
  }
  const muPeer = weightedMean(
    peerPool.map((point) => point.value),
    peerPool.map((point) => point.e),
  );

  const mu = 0.5 * muMean + 0.5 * muPeer;

  const msdRef = meanSquare(refRates);
  const invRef = weightedMean(
    refPool.map((point) => 1 / point.e),
    refPool.map((point) => point.e),
  );

  let tau2 = 0;
  let n0 = FALLBACK_N0;

  const low = pool.filter((point) => point.low);
  if (low.length >= MIN_GROUP && msdRef > 0) {
    const msdLow = meanSquare(low.map((point) => point.value));
    const invLow = weightedMean(
      low.map((point) => 1 / point.e),
      low.map((point) => point.e),
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
      refPool.map((point) => (point.e + n0) / point.e),
      refPool.map((point) => point.e),
    );
    tau2 = msdRef > 0 && factor > 0 ? msdRef / factor : 0;
  }
  if (!(tau2 > 0) || !Number.isFinite(mu)) return null;

  return {
    mu,
    tau2,
    n0: clamp(Math.max(n0, N0_FLOOR), N0_FLOOR, N0_MAX),
    kEb: DEFAULT_K_EB,
    refRates,
    refExposure,
  };
}

function projectRate(
  y: number,
  exposure: number,
  prior: Prior,
  scenario: ProjectionScenario,
  adverse = false,
  kind: MetricKind = "rate",
  roleChangeFlag = false,
): { value: number; weight: number } {
  const k = prior.kEb;
  let n90 = Math.max(exposure, 0);
  if (roleChangeFlag) n90 = Math.max(n90 * 0.22, 0.35);
  const posteriorMean = ebShrink(y, n90, prior.mu, k);
  const weight = n90 / (n90 + k);
  const sd = predictiveSd(y, n90, prior, weight, kind, adverse);
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

function reliabilityFrom(model: BuiltModel, sampleWeight: number): ProjectionReliability {
  let hotSum = 0;
  let hotN = 0;
  for (const metric of model.metrics) {
    if (metric.adverse || metric.seasonCount || !metric.rank) continue;
    if (metric.y <= metric.prior.mu + 1e-9) continue;
    const n90 = model.exposure;
    const k = metric.prior.kEb;
    const projected = ebShrink(metric.y, n90, metric.prior.mu, k);
    hotSum += (metric.y - projected) / metric.y;
    hotN += 1;
  }

  const roleChangeFlags = model.metrics.filter((metric) => metric.roleChangeFlag).length;
  const crossSeasonSeasons = model.target.cross_season?.seasons?.length ?? 0;

  return {
    sampleWeight,
    tier: confidenceTier(sampleWeight),
    hotStreakRegressionPct: hotN ? (hotSum / hotN) * 100 : null,
    roleChangeFlags,
    crossSeasonSeasons,
  };
}

export function confidenceTier(sampleWeight: number): ProjectionReliability["tier"] {
  if (sampleWeight >= 0.34) return "alta";
  if (sampleWeight >= 0.22) return "media";
  return "baixa";
}

export function confidenceTierLabel(tier: ProjectionReliability["tier"]): string {
  if (tier === "alta") return "Confiança alta na amostra";
  if (tier === "media") return "Confiança média — EB ainda puxa ao prior histórico/divisão";
  return "Confiança baixa — poucos minutos; leitura domina o prior M7 (histórico Wyscout quando houver)";
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
