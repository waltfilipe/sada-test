import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

export type SimilarBlockScore = {
  title: string;
  similarity: number;
};

export type SimilarPlayerHit = {
  player_id: string;
  name: string;
  club: string;
  profile: string;
  rating: number;
  /** Total similarity (0–100), same field as before for API consumers. */
  similarity: number;
  blocks: SimilarBlockScore[];
};

const NEUTRAL_PERCENTILE = 50;
const PROFILE_MATCH_BONUS = 3;

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

  if (label === "Ações Defensivas") {
    const features: { key: string; value: number }[] = [];
    for (const sub of item.sub_metrics ?? []) {
      if (sub.label === "Erros Totais" || sub.label === "Eficiência Defensiva") continue;
      const v = parseDisplayNumber(sub.display_value);
      if (v != null) features.push({ key: sub.label, value: v });
    }
    return features;
  }

  if (item.kind === "pass_certos" && item.certos_per90 != null) {
    return [{ key: "certos/90", value: item.certos_per90 }];
  }

  if (item.kind === "def_efficiency_group") {
    return [];
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
  if (vol != null && (label.includes("Condu") || label === "Progressão")) {
    return [{ key: "volume/90", value: vol }];
  }

  return [];
}

type BlockModel = {
  blocks: { title: string; featureIds: string[] }[];
  featureIds: string[];
};

function buildCertosModel(family: PositionFamily, pool: PlayerProfile[]): BlockModel {
  const sections = statSectionsForFamily(family);
  const blockMap = new Map<string, string[]>();

  for (const section of sections) {
    for (const label of section.labels) {
      if (label === "Eficiência Defensiva") continue;
      const keys = new Set<string>();
      for (const player of pool) {
        for (const f of certosFeaturesForLabel(player, label)) {
          keys.add(`${label} · ${f.key}`);
        }
      }
      if (!keys.size) continue;
      const list = blockMap.get(section.title) ?? [];
      list.push(...keys);
      blockMap.set(section.title, list);
    }
  }

  const blocks: BlockModel["blocks"] = [];
  const featureIds: string[] = [];
  for (const [title, ids] of blockMap) {
    const unique = [...new Set(ids)].sort();
    blocks.push({ title, featureIds: unique });
    featureIds.push(...unique);
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Cross-league similarity from **successful actions per 90** (certos / vencidos),
 * grouped by dossier stat blocks. Total = cosine over all certos features;
 * each block score = cosine within that block's features only.
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

  const { blocks, featureIds } = buildCertosModel(family, sameFamily);
  if (!featureIds.length) return [];

  const blockRanges = blocks.map((block) => ({
    title: block.title,
    indices: block.featureIds
      .map((id) => featureIds.indexOf(id))
      .filter((index) => index >= 0),
  }));

  const sourceVec = featureVector(source, sameFamily, featureIds);
  const scored: SimilarPlayerHit[] = [];

  for (const candidate of sameFamily) {
    if (candidate.player_id === source.player_id) continue;

    const candVec = featureVector(candidate, sameFamily, featureIds);
    let total = cosineSimilarity(sourceVec, candVec) * 100;
    if (candidate.profile === source.profile) {
      total = Math.min(100, total + PROFILE_MATCH_BONUS);
    }

    const blockScores: SimilarBlockScore[] = blockRanges.map(({ title, indices }) => {
      if (!indices.length) return { title, similarity: NEUTRAL_PERCENTILE };
      const a = indices.map((i) => sourceVec[i]);
      const b = indices.map((i) => candVec[i]);
      return { title, similarity: round1(cosineSimilarity(a, b) * 100) };
    });

    scored.push({
      player_id: candidate.player_id,
      name: candidate.name,
      club: candidate.club,
      profile: candidate.profile,
      rating: candidate.rating,
      similarity: round1(total),
      blocks: blockScores,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity || b.rating - a.rating);
  return scored.slice(0, limit);
}
