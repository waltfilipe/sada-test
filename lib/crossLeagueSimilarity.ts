import type { PlayerProfile, PositionFamily, Tendencies } from "@/lib/types";

const TENDENCY_KEYS: (keyof Tendencies)[] = [
  "construcao",
  "ofensividade",
  "def1v1",
  "contencao",
  "duelo_aereo",
];

export type SimilarPlayerHit = {
  player_id: string;
  name: string;
  club: string;
  profile: string;
  rating: number;
  similarity: number;
};

/** Percentile of `value` within a pool (0–100). */
function percentileInPool(value: number, pool: number[]): number {
  if (!pool.length) return 50;
  const sorted = [...pool].sort((a, b) => a - b);
  const idx = sorted.findIndex((v) => v >= value);
  if (idx === -1) return 100;
  return ((idx + 0.5) / sorted.length) * 100;
}

function scatterPercentilesForPlayer(
  player: PlayerProfile,
  pool: PlayerProfile[],
  scatterKeys: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of scatterKeys) {
    const values = pool.map((p) => p.scatter[key] ?? 0);
    out[key] = percentileInPool(player.scatter[key] ?? 0, values);
  }
  return out;
}

/** Fixed-order feature vector in [0, 1] for cosine / distance comparison. */
function featureVector(
  player: PlayerProfile,
  profileKeys: string[],
  scatterKeys: string[],
  scatterPct: Record<string, number>,
): number[] {
  const parts: number[] = [];

  for (const key of TENDENCY_KEYS) {
    parts.push(Math.max(0, Math.min(1, (player.tendencies[key] ?? 0) / 100)));
  }

  for (const key of profileKeys) {
    parts.push(Math.max(0, Math.min(1, (player.profile_shares[key] ?? 0) / 100)));
  }

  for (const key of profileKeys) {
    const rating = player.ratings[key] ?? player.ratings.geral ?? player.rating;
    parts.push(Math.max(0, Math.min(1, rating / 10)));
  }

  parts.push(Math.max(0, Math.min(1, player.ratings.geral / 10)));

  for (const key of scatterKeys) {
    parts.push(Math.max(0, Math.min(1, (scatterPct[key] ?? 50) / 100)));
  }

  return parts;
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

function profileKeysForFamily(pool: PlayerProfile[]): string[] {
  const keys = new Set<string>();
  for (const player of pool) {
    for (const key of player.profiles_available ?? []) keys.add(key);
  }
  return [...keys].sort();
}

function scatterKeysForFamily(pool: PlayerProfile[]): string[] {
  const keys = new Set<string>();
  for (const player of pool) {
    for (const key of Object.keys(player.scatter ?? {})) keys.add(key);
  }
  return [...keys].sort();
}

/**
 * Top cross-league matches for one source player against a destination pool.
 *
 * Similarity blends:
 * - Tendências de jogo (5 eixos 0–100)
 * - Shares de perfil tático (%)
 * - Notas por perfil + geral (escala 0–10, comparável entre divisões)
 * - Métricas scatter expressas como percentil **dentro da divisão de destino**
 *   (o atleta fonte é posicionado no ranking da outra liga em cada métrica)
 *
 * Pequeno bônus se o rótulo de perfil principal for igual.
 */
export function rankCrossLeagueSimilarity(
  source: PlayerProfile,
  targetPool: PlayerProfile[],
  options: { limit?: number; minMinutes?: number } = {},
): SimilarPlayerHit[] {
  const limit = options.limit ?? 5;
  const minMinutes = options.minMinutes ?? 300;

  const sameFamily = targetPool.filter(
    (p) => p.position_family === source.position_family && p.minutes >= minMinutes,
  );
  if (!sameFamily.length) return [];

  const profileKeys = profileKeysForFamily(sameFamily);
  const scatterKeys = scatterKeysForFamily(sameFamily);

  const sourceScatterPct = scatterPercentilesForPlayer(source, sameFamily, scatterKeys);
  const sourceVec = featureVector(source, profileKeys, scatterKeys, sourceScatterPct);

  const scored: SimilarPlayerHit[] = [];

  for (const candidate of sameFamily) {
    if (candidate.player_id === source.player_id) continue;

    const candScatterPct = scatterPercentilesForPlayer(candidate, sameFamily, scatterKeys);
    const candVec = featureVector(candidate, profileKeys, scatterKeys, candScatterPct);
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
