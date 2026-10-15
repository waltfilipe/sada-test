import type { AspectItem, PlayerProfile } from "@/lib/types";

export type ProjectionScenario = "negativa" | "realista" | "positiva";

export type ProjectionPlacement = {
  rank: number;
  poolSize: number;
  /** Share of the estimate that comes from the player's own minutes, 0–1. */
  weight: number;
  scenario: ProjectionScenario;
};

const Z90 = 1.2815515655446004;
const MIN_GROUP = 8;
const MIN_METRICS = 3;
const FALLBACK_N0 = 4;
const N0_MIN = 0.5;
const N0_MAX = 40;

const SKIP_KINDS = new Set(["construction_share", "def_efficiency_group"]);
const SEASON_TOTALS = new Set(["gols", "xg", "pré assistências", "pre assistências", "erros totais"]);

type Prior = {
  mu: number;
  tau2: number;
  n0: number;
  refRates: number[];
};

type MetricFit = {
  key: string;
  y: number;
  prior: Prior;
};

type BuiltModel = {
  exposure: number;
  metrics: MetricFit[];
  peerIndexes: number[];
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
  const percentiles: number[] = [];
  const weights: number[] = [];
  for (const metric of model.metrics) {
    const projected = projectRate(metric.y, model.exposure, metric.prior, scenario);
    percentiles.push(midrankPercentile(projected.value, metric.prior.refRates));
    weights.push(projected.weight);
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

function buildModel(player: PlayerProfile, players: PlayerProfile[]): BuiltModel | null {
  const ratesById = new Map<string, Map<string, number>>();
  const ratesOf = (candidate: PlayerProfile) => {
    let rates = ratesById.get(candidate.player_id);
    if (!rates) {
      rates = collectRates(candidate);
      ratesById.set(candidate.player_id, rates);
    }
    return rates;
  };

  const targetRates = ratesOf(player);
  if (targetRates.size < MIN_METRICS) return null;

  const observations = new Map<string, { e: number; rate: number; low: boolean }[]>();
  for (const key of targetRates.keys()) observations.set(key, []);

  for (const candidate of players) {
    const minutes = candidate.minutes ?? 0;
    if (minutes <= 0 || candidate.minutes_pct == null) continue;
    const rates = ratesOf(candidate);
    const exposure = minutes / 90;
    const low = candidate.minutes_pct < 50;
    for (const key of targetRates.keys()) {
      const rate = rates.get(key);
      if (rate == null) continue;
      observations.get(key)!.push({ e: exposure, rate, low });
    }
  }

  const metrics: MetricFit[] = [];
  for (const [key, y] of targetRates) {
    const prior = fitPrior(observations.get(key) ?? []);
    if (!prior) continue;
    metrics.push({ key, y, prior });
  }
  if (metrics.length < MIN_METRICS) return null;

  const minimumOverlap = Math.min(MIN_METRICS, metrics.length);
  const peerIndexes: number[] = [];
  for (const candidate of players) {
    if (candidate.player_id === player.player_id) continue;
    if ((candidate.minutes ?? 0) <= 0) continue;
    const rates = ratesOf(candidate);
    const percentiles: number[] = [];
    for (const metric of metrics) {
      const rate = rates.get(metric.key);
      if (rate == null) continue;
      percentiles.push(midrankPercentile(rate, metric.prior.refRates));
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

function fitPrior(points: { e: number; rate: number; low: boolean }[]): Prior | null {
  const ref = points.filter((point) => !point.low && point.e > 0);
  if (ref.length < MIN_GROUP) return null;

  const refRates = ref.map((point) => point.rate);
  const mu = mean(refRates);
  const msdRef = meanSquare(refRates);
  const invRef = mean(ref.map((point) => 1 / point.e));
  let tau2 = 0;
  let n0 = FALLBACK_N0;

  const low = points.filter((point) => point.low && point.e > 0);
  if (low.length >= MIN_GROUP && msdRef > 0) {
    const msdLow = meanSquare(low.map((point) => point.rate));
    const invLow = mean(low.map((point) => 1 / point.e));
    const denom = invLow - invRef;
    const sigma2 = denom > 1e-6 ? (msdLow - msdRef) / denom : -1;
    if (sigma2 > 0) {
      const tau = msdRef - sigma2 * invRef;
      if (tau > 1e-8) {
        tau2 = tau;
        n0 = clamp(sigma2 / tau2, N0_MIN, N0_MAX);
      }
    }
  }

  if (!(tau2 > 0)) {
    n0 = FALLBACK_N0;
    const factor = mean(ref.map((point) => (point.e + n0) / point.e));
    tau2 = msdRef > 0 && factor > 0 ? msdRef / factor : 0;
  }
  if (!(tau2 > 0) || !Number.isFinite(mu)) return null;

  return {
    mu,
    tau2,
    n0,
    refRates: [...refRates].sort((a, b) => a - b),
  };
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
  if (scenario === "positiva") value = realistic + Z90 * sd;
  return { value: Math.max(0, value), weight };
}

function collectRates(player: PlayerProfile): Map<string, number> {
  const rates = new Map<string, number>();
  const groups = Object.values(player.aspects ?? {});
  for (const items of groups) {
    if (!items) continue;
    for (const item of items) absorbAspect(item, rates);
  }
  return rates;
}

function absorbAspect(item: AspectItem, rates: Map<string, number>) {
  if (SKIP_KINDS.has(item.kind ?? "")) return;
  const subs = item.sub_metrics ?? [];
  let usedSub = false;
  for (const sub of subs) {
    if (!isVolumeLabel(sub.label)) continue;
    const rate = parseRate(sub.display_value);
    if (rate == null || rates.has(sub.label)) continue;
    rates.set(sub.label, rate);
    usedSub = true;
  }
  if (usedSub || !isVolumeLabel(item.label) || rates.has(item.label)) return;
  const rate = parseRate(item.display_value);
  if (rate == null) return;
  rates.set(item.label, rate);
}

function isVolumeLabel(label: string | undefined): boolean {
  const normalized = (label ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("%") || normalized.includes("/")) return false;
  if (/erro|efici[eê]ncia/.test(normalized)) return false;
  return !SEASON_TOTALS.has(normalized);
}

function parseRate(display: string | null | undefined): number | null {
  const raw = (display ?? "").trim();
  if (!raw || raw.includes("%") || /^[+\-−]/.test(raw)) return null;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
