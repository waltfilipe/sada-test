import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { rankCrossLeagueSimilarity } from "@/lib/crossLeagueSimilarity";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export const PROJECTION_LAB_LEAGUE = "serie-a" as const;

export type LabMetricKind = "rate" | "percent";

export type LabMetricDef = {
  id: string;
  label: string;
  aspectLabel: string;
  subLabel?: string;
  kind: LabMetricKind;
  /** Minutes until metric roughly stabilizes (method 2). */
  stabilizationMin: number;
  /** Default prior strength in nineties (method 1). */
  defaultK: number;
};

export type MethodColumn = {
  id: string;
  short: string;
  name: string;
  description: string;
};

export const METHOD_COLUMNS: MethodColumn[] = [
  {
    id: "m1",
    short: "M1",
    name: "Empirical Bayes",
    description: "Regressão à média da posição com k fixo por métrica.",
  },
  {
    id: "m2",
    short: "M2",
    name: "Estabilização",
    description: "Peso = min ÷ (min + minutos até estabilizar).",
  },
  {
    id: "m3",
    short: "M3",
    name: "Hierárquico (simpl.)",
    description: "50% titulares + 50% mesmo perfil; shrink com k=8.",
  },
  {
    id: "m4",
    short: "M4",
    name: "Monte Carlo",
    description: "Mediana de 4k sorteios pós-EB (incerteza).",
  },
  {
    id: "m5",
    short: "M5",
    name: "IC clássico",
    description: "Poisson (taxas) ou Wilson (%); ponto = observado.",
  },
  {
    id: "m6",
    short: "M6",
    name: "Marcel",
    description: "Média ponderada de temporadas + prior da posição.",
  },
  {
    id: "m7",
    short: "M7",
    name: "k calibrado",
    description: "EB com k otimizado no pool Série A (pseudo-holdout).",
  },
  {
    id: "m8",
    short: "M8",
    name: "kNN similares",
    description: "Prior = média dos top 5 similares nesta divisão.",
  },
];

const LAB_METRICS: Record<PositionFamily, LabMetricDef[]> = {
  zagueiros: [
    {
      id: "int",
      label: "Interceptações /90",
      aspectLabel: "Ações Defensivas",
      subLabel: "Interceptações",
      kind: "rate",
      stabilizationMin: 900,
      defaultK: 10,
    },
    {
      id: "duel_vol",
      label: "Duelos def. /90",
      aspectLabel: "Duelos Defensivos",
      kind: "rate",
      stabilizationMin: 600,
      defaultK: 10,
    },
    {
      id: "duel_pct",
      label: "Efic. duelos def. %",
      aspectLabel: "Duelos Defensivos",
      kind: "percent",
      stabilizationMin: 500,
      defaultK: 12,
    },
    {
      id: "pass_prog",
      label: "Passes prog. /90",
      aspectLabel: "Passes Progressivos",
      kind: "rate",
      stabilizationMin: 700,
      defaultK: 10,
    },
  ],
  laterais: [
    {
      id: "cross",
      label: "Cruzamentos /90",
      aspectLabel: "Cruzamentos",
      subLabel: "Cruzamentos",
      kind: "rate",
      stabilizationMin: 800,
      defaultK: 10,
    },
    {
      id: "duel_vol",
      label: "Duelos def. /90",
      aspectLabel: "Duelos Defensivos",
      kind: "rate",
      stabilizationMin: 600,
      defaultK: 10,
    },
    {
      id: "prog",
      label: "Conduções prog. /90",
      aspectLabel: "Conduções Progressivas",
      kind: "rate",
      stabilizationMin: 750,
      defaultK: 10,
    },
  ],
  "meio-campistas": [
    {
      id: "pass_prog",
      label: "Passes prog. /90",
      aspectLabel: "Passes Progressivos",
      kind: "rate",
      stabilizationMin: 650,
      defaultK: 10,
    },
    {
      id: "duel_vol",
      label: "Duelos def. /90",
      aspectLabel: "Duelos Defensivos",
      kind: "rate",
      stabilizationMin: 600,
      defaultK: 10,
    },
    {
      id: "key_pass",
      label: "Passes p/ área /90",
      aspectLabel: "Passes Chave e Área",
      subLabel: "Passes para Área",
      kind: "rate",
      stabilizationMin: 900,
      defaultK: 12,
    },
  ],
  extremos: [
    {
      id: "dribble",
      label: "1v1 of. /90",
      aspectLabel: "1v1 - Ofensivo",
      kind: "rate",
      stabilizationMin: 700,
      defaultK: 10,
    },
    {
      id: "xa_line",
      label: "Pré-assist. /90",
      aspectLabel: "Pré Assistências e xA",
      subLabel: "Pré Assistências",
      kind: "rate",
      stabilizationMin: 950,
      defaultK: 12,
    },
    {
      id: "touch_box",
      label: "Toques área /90",
      aspectLabel: "Ações Terminais",
      subLabel: "Toques na Área",
      kind: "rate",
      stabilizationMin: 800,
      defaultK: 10,
    },
  ],
  atacantes: [
    {
      id: "shot",
      label: "Finalizações /90",
      aspectLabel: "Finalização",
      subLabel: "Finalizações",
      kind: "rate",
      stabilizationMin: 750,
      defaultK: 12,
    },
    {
      id: "touch_box",
      label: "Toques área /90",
      aspectLabel: "Ações Terminais",
      subLabel: "Toques na Área",
      kind: "rate",
      stabilizationMin: 700,
      defaultK: 10,
    },
    {
      id: "aerial",
      label: "Duelos aéreos /90",
      aspectLabel: "Aéreo",
      kind: "rate",
      stabilizationMin: 600,
      defaultK: 10,
    },
  ],
};

export type LabCellValue =
  | { type: "point"; value: number }
  | { type: "interval"; low: number; high: number; center?: number };

export type ProjectionLabRow = {
  metric: LabMetricDef;
  observed: number;
  poolMean: number;
  n90: number;
  cells: Record<string, LabCellValue | null>;
};

export type ProjectionLabReport = {
  player_id: string;
  name: string;
  club: string;
  minutes: number;
  minutes_pct: number | null;
  profile: string;
  rows: ProjectionLabRow[];
  methods: MethodColumn[];
  historySeasons: { league: string; label: string; minutes: number }[];
};

export function labMetricsForFamily(family: PositionFamily): LabMetricDef[] {
  return LAB_METRICS[family] ?? [];
}

function parseDisplayNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const n = Number(normalized.replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

export function readLabMetric(player: PlayerProfile, def: LabMetricDef): number | null {
  const item = findAspect(flattenAspects(player), def.aspectLabel);
  if (!item) return null;
  if (def.subLabel) {
    const sub = item.sub_metrics?.find((s) => s.label === def.subLabel);
    return parseDisplayNumber(sub?.display_value);
  }
  if (def.kind === "percent") {
    if (item.efficiency_pct != null) return item.efficiency_pct;
    return parseDisplayNumber(item.efficiency_value?.replace("%", ""));
  }
  return parseDisplayNumber(item.display_value);
}

function poolValues(pool: PlayerProfile[], def: LabMetricDef, minMinutes = 300): number[] {
  return pool
    .filter((p) => (p.minutes ?? 0) >= minMinutes)
    .map((p) => readLabMetric(p, def))
    .filter((v): v is number => v != null);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function ebShrink(rate: number, n90: number, mu: number, k: number): number {
  return (rate * n90 + mu * k) / (n90 + k);
}

function profilesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function poolMeanRegulars(pool: PlayerProfile[], def: LabMetricDef): number {
  const vals = pool.filter((p) => (p.minutes_pct ?? 0) >= 50).map((p) => readLabMetric(p, def)).filter((v): v is number => v != null);
  return vals.length >= 8 ? mean(vals) : mean(poolValues(pool, def));
}

function poolMeanProfile(pool: PlayerProfile[], def: LabMetricDef, profile: string): number {
  const vals = pool
    .map((p) => ({ p, v: readLabMetric(p, def) }))
    .filter((row): row is { p: PlayerProfile; v: number } => row.v != null && profilesMatch(row.p.profile, profile));
  if (vals.length >= 5) return mean(vals.map((r) => r.v));
  return poolMeanRegulars(pool, def);
}

function hierarchicalMean(pool: PlayerProfile[], def: LabMetricDef, profile: string): number {
  return 0.5 * poolMeanRegulars(pool, def) + 0.5 * poolMeanProfile(pool, def, profile);
}

function knnPrior(pool: PlayerProfile[], source: PlayerProfile, def: LabMetricDef): number {
  const hits = rankCrossLeagueSimilarity(source, pool, { limit: 5, minMinutes: 300 });
  const rates = hits
    .map((h) => readLabMetric(pool.find((p) => p.player_id === h.player_id)!, def))
    .filter((v): v is number => v != null);
  return rates.length ? mean(rates) : poolMeanRegulars(pool, def);
}

function calibrateK(pool: PlayerProfile[], def: LabMetricDef, mu: number): number {
  const held = pool.filter((p) => (p.minutes ?? 0) >= 900);
  if (held.length < 12) return def.defaultK;
  let bestK = def.defaultK;
  let bestErr = Infinity;
  for (let k = 4; k <= 22; k += 2) {
    let err = 0;
    let n = 0;
    for (const p of held) {
      const full = readLabMetric(p, def);
      const nFull = (p.minutes ?? 0) / 90;
      if (full == null || nFull <= 0) continue;
      const nPartial = nFull * 0.45;
      const pseudo = ebShrink(full, nPartial, mu, k);
      err += (pseudo - full) ** 2;
      n += 1;
    }
    if (n && err / n < bestErr) {
      bestErr = err / n;
      bestK = k;
    }
  }
  return bestK;
}

function poissonRateInterval(rate: number, n90: number): { low: number; high: number } {
  const count = Math.max(rate * n90, 0);
  if (count <= 0 || n90 <= 0) return { low: 0, high: rate * 2 };
  const low = Math.max(0, (count - 1.96 * Math.sqrt(count)) / n90);
  const high = (count + 1.96 * Math.sqrt(count + 1)) / n90;
  return { low, high };
}

function wilsonInterval(pPct: number, trials: number): { low: number; high: number } {
  const p = clamp(pPct / 100, 0.001, 0.999);
  const n = Math.max(trials, 8);
  const z = 1.96;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: clamp((center - margin) * 100, 0, 100), high: clamp((center + margin) * 100, 0, 100) };
}

function monteCarloMedian(rate: number, n90: number, mu: number, k: number, draws = 4000): number {
  const postMean = ebShrink(rate, n90, mu, k);
  const se = Math.sqrt(Math.max(rate / Math.max(n90, 0.5), 0.02) * 0.15);
  const samples: number[] = [];
  for (let i = 0; i < draws; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-9))) * Math.cos(2 * Math.PI * u2);
    samples.push(Math.max(0, postMean + z * se));
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(0.5 * (samples.length - 1))];
}

function marcelRate(
  current: { rate: number; minutes: number },
  history: { rate: number; minutes: number }[],
  mu: number,
): number | null {
  const slices = [...history, current].filter((s) => s.minutes > 0 && Number.isFinite(s.rate));
  if (slices.length < 2) return null;
  const weights = [2, 3, 5, 5];
  let num = 0;
  let den = 0;
  const ordered = slices.slice(-4);
  for (let i = 0; i < ordered.length; i++) {
    const w = weights[Math.max(0, weights.length - ordered.length + i)] ?? 3;
    const n90 = ordered[i].minutes / 90;
    num += ordered[i].rate * n90 * w;
    den += n90 * w;
  }
  const k90 = 1200 / 90;
  return (num + mu * k90) / (den + k90);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function formatLabValue(value: number, kind: LabMetricKind): string {
  if (kind === "percent") return `${Math.round(value * 10) / 10}%`;
  return (Math.round(value * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatLabCell(cell: LabCellValue, kind: LabMetricKind): string {
  if (cell.type === "interval") {
    return `${formatLabValue(cell.low, kind)} – ${formatLabValue(cell.high, kind)}`;
  }
  return formatLabValue(cell.value, kind);
}

export function buildProjectionLabReport(
  source: PlayerProfile,
  pool: PlayerProfile[],
  historyProfiles: PlayerProfile[] = [],
): ProjectionLabReport | null {
  const family = source.position_family;
  const defs = labMetricsForFamily(family);
  if (!defs.length) return null;

  const minutes = source.minutes ?? 0;
  const n90 = minutes / 90;
  const rows: ProjectionLabRow[] = [];

  const historySeasons = historyProfiles.map((h) => ({
    league: h.player_id.split("-")[0] ?? "outra",
    label: h.label ?? h.name,
    minutes: h.minutes ?? 0,
  }));

  for (const def of defs) {
    const observed = readLabMetric(source, def);
    if (observed == null) continue;
    const mu = poolMeanRegulars(pool, def);
    const muH = hierarchicalMean(pool, def, source.profile ?? "");
    const kCal = calibrateK(pool, def, mu);
    const wStab = minutes / (minutes + def.stabilizationMin);

    const m1 = ebShrink(observed, n90, mu, def.defaultK);
    const m2 = wStab * observed + (1 - wStab) * mu;
    const m3 = ebShrink(observed, n90, muH, 8);
    const m4 = monteCarloMedian(observed, n90, mu, def.defaultK);
    const m7 = ebShrink(observed, n90, mu, kCal);
    const m8 = knnPrior(pool, source, def);

    let m5: LabCellValue;
    if (def.kind === "percent") {
      const volItem = findAspect(flattenAspects(source), def.aspectLabel);
      const vol = parseDisplayNumber(volItem?.display_value) ?? 3;
      const trials = Math.max(8, vol * n90);
      const interval = wilsonInterval(observed, trials);
      m5 = { type: "interval", low: interval.low, high: interval.high, center: observed };
    } else {
      const interval = poissonRateInterval(observed, n90);
      m5 = { type: "interval", low: interval.low, high: interval.high, center: observed };
    }

    const histRates = historyProfiles
      .map((h) => ({ rate: readLabMetric(h, def), minutes: h.minutes ?? 0 }))
      .filter((s): s is { rate: number; minutes: number } => s.rate != null);
    const m6Raw = marcelRate({ rate: observed, minutes }, histRates, mu);
    const cells: Record<string, LabCellValue | null> = {
      m1: { type: "point", value: m1 },
      m2: { type: "point", value: m2 },
      m3: { type: "point", value: m3 },
      m4: { type: "point", value: m4 },
      m5,
      m6: m6Raw != null ? { type: "point", value: m6Raw } : null,
      m7: { type: "point", value: m7 },
      m8: { type: "point", value: m8 },
    };

    rows.push({
      metric: def,
      observed,
      poolMean: mu,
      n90,
      cells,
    });
  }

  if (!rows.length) return null;

  return {
    player_id: source.player_id,
    name: source.name,
    club: source.club,
    minutes,
    minutes_pct: source.minutes_pct ?? null,
    profile: source.profile ?? "—",
    rows,
    methods: METHOD_COLUMNS,
    historySeasons,
  };
}
