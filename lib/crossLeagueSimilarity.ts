import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import type { LeagueId } from "@/lib/leagues";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

export type SimilarBlockScore = {
  title: string;
  tone: StatSectionTone;
  similarity: number;
};

export type SimilarPlayerHit = {
  player_id: string;
  name: string;
  club: string;
  profile: string;
  rating: number;
  league?: LeagueId;
  photo?: string | null;
  /** Total similarity (0–100), same field as before for API consumers. */
  similarity: number;
  blocks: SimilarBlockScore[];
};

const NEUTRAL_PERCENTILE = 50;

function normName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSameAthlete(a: PlayerProfile, b: PlayerProfile): boolean {
  if (a.player_id === b.player_id) return true;
  if (normName(a.name) !== normName(b.name)) return false;
  if (a.birth_year == null || b.birth_year == null) return true;
  return Math.abs(a.birth_year - b.birth_year) <= 1;
}
/** Minimum players sharing the reference profile before profile weights kick in. */
const MIN_PROFILE_GROUP = 5;
/** Extra weight (on top of 1) for a metric where the profile sits 25 percentiles away from the median. */
const PROFILE_WEIGHT_SCALE = 1;

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

function parseEffPct(item: AspectItem): number | null {
  if (item.efficiency_pct != null) return item.efficiency_pct;
  const raw = item.efficiency_value?.replace("%", "").trim();
  if (!raw) return null;
  return parseDisplayNumber(raw);
}

/** Successful actions per 90 (certos / vencidos) from dossier cards. */
function certosFeaturesForLabel(
  player: PlayerProfile,
  label: string,
): { key: string; value: number }[] {
  const item = findAspect(flattenAspects(player), label);
  if (!item) return [];

  const subSkip = new Set(["Erros Totais", "Eficiência Defensiva", "Eficiência", "Eficiência de finalização"]);

  if (item.kind === "pass_certos" && item.certos_per90 != null) {
    return [{ key: "certos/90", value: item.certos_per90 }];
  }

  if (item.kind === "def_efficiency_group" || item.kind === "construction_share") {
    return [];
  }

  if (item.kind === "metric_group") {
    const features: { key: string; value: number }[] = [];
    const groupEff = parseEffPct(item);
    for (const sub of item.sub_metrics ?? []) {
      if (subSkip.has(sub.label) || sub.label.startsWith("Eficiência")) continue;
      const vol = parseDisplayNumber(sub.display_value);
      if (vol == null) continue;
      if (label === "Cruzamentos" && sub.label === "Cruzamentos" && groupEff != null) {
        features.push({ key: "certos/90", value: (vol * groupEff) / 100 });
      } else {
        features.push({ key: sub.label, value: vol });
      }
    }
    return features;
  }

  const duelLike = new Set([
    "Duelos Defensivos",
    "Duelos Aéreos",
    "Disputas com Bola",
    "Duelos Vencidos",
    "Aéreo",
    "1v1 - Ofensivo",
  ]);
  if (duelLike.has(label) || label.includes("Duelo")) {
    const vol = parseDisplayNumber(item.display_value);
    const eff = parseEffPct(item);
    if (vol != null && eff != null) {
      return [{ key: "vencidos/90", value: (vol * eff) / 100 }];
    }
    return [];
  }

  if (item.certos_per90 != null) {
    return [{ key: "certos/90", value: item.certos_per90 }];
  }

  const vol = parseDisplayNumber(item.display_value);
  const eff = parseEffPct(item);
  if (vol != null && eff != null && label.includes("Criativ")) {
    return [{ key: "certos/90", value: (vol * eff) / 100 }];
  }

  if (vol != null) {
    return [{ key: "volume/90", value: vol }];
  }

  return [];
}

type BlockModel = {
  blocks: { title: string; tone: StatSectionTone; featureIds: string[] }[];
  featureIds: string[];
};

function buildCertosModel(family: PositionFamily, pool: PlayerProfile[]): BlockModel {
  const sections = statSectionsForFamily(family);
  const blockMap = new Map<string, { tone: StatSectionTone; featureIds: string[] }>();

  for (const section of sections) {
    const collected = new Set<string>();
    for (const label of section.labels) {
      if (label === "Eficiência Defensiva") continue;
      for (const player of pool) {
        for (const f of certosFeaturesForLabel(player, label)) {
          collected.add(`${label} · ${f.key}`);
        }
      }
    }
    if (!collected.size) continue;
    blockMap.set(section.title, {
      tone: section.tone,
      featureIds: [...collected].sort(),
    });
  }

  const blocks: BlockModel["blocks"] = [];
  const featureIds: string[] = [];
  for (const section of sections) {
    const entry = blockMap.get(section.title);
    if (!entry) continue;
    blocks.push({ title: section.title, tone: entry.tone, featureIds: entry.featureIds });
    featureIds.push(...entry.featureIds);
  }
  return { blocks, featureIds: [...new Set(featureIds)] };
}

function rawCertos(player: PlayerProfile, featureId: string): number | null {
  const sep = featureId.indexOf(" · ");
  const label = featureId.slice(0, sep);
  const subKey = featureId.slice(sep + 3);
  for (const f of certosFeaturesForLabel(player, label)) {
    if (`${label} · ${f.key}` === featureId) return f.value;
  }
  void subKey;
  return null;
}

function featureVector(
  player: PlayerProfile,
  pool: PlayerProfile[],
  featureIds: string[],
): number[] {
  return featureIds.map((fid) => {
    const values = pool
      .map((p) => rawCertos(p, fid))
      .filter((value): value is number => value != null);
    const raw = rawCertos(player, fid);
    if (raw != null && values.length >= 3) {
      return Math.max(0, Math.min(1, percentileInPool(raw, values) / 100));
    }
    return NEUTRAL_PERCENTILE / 100;
  });
}

/**
 * 100 = identical percentiles; each point off the reference percentile, on average, costs 1%.
 * Weighted mean of |Δ percentile| across the given features.
 */
function percentileSimilarity(a: number[], b: number[], weights: number[], indices?: number[]): number {
  const idx = indices ?? a.map((_, i) => i);
  let diff = 0;
  let total = 0;
  for (const i of idx) {
    diff += Math.abs(a[i] - b[i]) * weights[i];
    total += weights[i];
  }
  if (!total) return 0;
  return Math.max(0, 100 * (1 - diff / total));
}

/**
 * Metrics that define the reference profile weigh more: for players of the same profile
 * in the pool, how far their average percentile sits from the median (50).
 */
function profileWeights(source: PlayerProfile, vectors: Map<string, number[]>, pool: PlayerProfile[], size: number): number[] {
  const group = pool.filter((p) => p.profile && p.profile === source.profile && p.player_id !== source.player_id);
  if (group.length < MIN_PROFILE_GROUP) return Array(size).fill(1);
  return Array.from({ length: size }, (_, i) => {
    const mean = group.reduce((sum, p) => sum + (vectors.get(p.player_id)?.[i] ?? 0.5), 0) / group.length;
    return 1 + (PROFILE_WEIGHT_SCALE * Math.abs(mean - 0.5)) / 0.25;
  });
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Similarity from **successful actions per 90** (certos / vencidos) as percentiles in the
 * target pool, grouped by dossier stat blocks. 100% = same percentiles as the reference;
 * total and block scores = 100 − weighted mean |Δ percentile| (profile-defining metrics weigh more).
 */
export function rankCrossLeagueSimilarity(
  source: PlayerProfile,
  targetPool: PlayerProfile[],
  options: { limit?: number; minMinutes?: number; leagueOf?: (p: PlayerProfile) => LeagueId | undefined } = {},
): SimilarPlayerHit[] {
  const limit = options.limit ?? 5;
  const minMinutes = options.minMinutes ?? 300;
  const family = source.position_family;

  const sameFamily = targetPool.filter(
    (p) => p.position_family === family && p.minutes >= minMinutes,
  );
  if (!sameFamily.length) return [];

  const { blocks, featureIds } = buildCertosModel(family, sameFamily);
  if (!featureIds.length) return [];

  const blockRanges = blocks.map((block) => ({
    title: block.title,
    tone: block.tone,
    indices: block.featureIds
      .map((id) => featureIds.indexOf(id))
      .filter((index) => index >= 0),
  }));

  const sourceVec = featureVector(source, sameFamily, featureIds);
  const vectors = new Map(sameFamily.map((p) => [p.player_id, featureVector(p, sameFamily, featureIds)]));
  const weights = profileWeights(source, vectors, sameFamily, featureIds.length);
  const scored: SimilarPlayerHit[] = [];

  for (const candidate of sameFamily) {
    if (isSameAthlete(candidate, source)) continue;

    const candVec = vectors.get(candidate.player_id)!;
    const total = percentileSimilarity(sourceVec, candVec, weights);

    const blockScores: SimilarBlockScore[] = blockRanges.map(({ title, tone, indices }) => {
      if (!indices.length) return { title, tone, similarity: NEUTRAL_PERCENTILE };
      return { title, tone, similarity: round1(percentileSimilarity(sourceVec, candVec, weights, indices)) };
    });

    scored.push({
      player_id: candidate.player_id,
      name: candidate.name,
      club: candidate.club,
      profile: candidate.profile,
      rating: candidate.rating,
      league: options.leagueOf?.(candidate),
      similarity: round1(total),
      blocks: blockScores,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity || b.rating - a.rating);
  return scored.slice(0, limit);
}
