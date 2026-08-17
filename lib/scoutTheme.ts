import type { CSSProperties } from "react";

/**
 * Single source of truth for every performance colour on the scout pages.
 * Grades, ratings and percentiles all resolve to the same five tiers so the
 * palette stays consistent no matter which metric is being rendered.
 */

export type Tier = 1 | 2 | 3 | 4 | 5;

export type TierToken = {
  tier: Tier;
  label: string;
  color: string;
  soft: string;
  border: string;
  glow: string;
};

export const TIERS: Record<Tier, TierToken> = {
  5: {
    tier: 5,
    label: "Elite",
    color: "#34d399",
    soft: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.38)",
    glow: "rgba(52, 211, 153, 0.22)",
  },
  4: {
    tier: 4,
    label: "Alto",
    color: "#a3e635",
    soft: "rgba(163, 230, 53, 0.12)",
    border: "rgba(163, 230, 53, 0.34)",
    glow: "rgba(163, 230, 53, 0.2)",
  },
  3: {
    tier: 3,
    label: "Médio",
    color: "#fbbf24",
    soft: "rgba(251, 191, 36, 0.12)",
    border: "rgba(251, 191, 36, 0.34)",
    glow: "rgba(251, 191, 36, 0.2)",
  },
  2: {
    tier: 2,
    label: "Baixo",
    color: "#fb923c",
    soft: "rgba(251, 146, 60, 0.12)",
    border: "rgba(251, 146, 60, 0.32)",
    glow: "rgba(251, 146, 60, 0.18)",
  },
  1: {
    tier: 1,
    label: "Crítico",
    color: "#f87171",
    soft: "rgba(248, 113, 113, 0.12)",
    border: "rgba(248, 113, 113, 0.32)",
    glow: "rgba(248, 113, 113, 0.18)",
  },
};

/** Maps a 0-100 performance score to a tier. */
export function tierFromScore(score: number): TierToken {
  if (score >= 85) return TIERS[5];
  if (score >= 68) return TIERS[4];
  if (score >= 48) return TIERS[3];
  if (score >= 28) return TIERS[2];
  return TIERS[1];
}

/** Letter grades emitted by the data pipeline, expressed on the 0-100 scale. */
const GRADE_SCORE: Record<string, number> = {
  "A+": 97,
  A: 92,
  "A-": 87,
  "B+": 80,
  B: 70,
  "B-": 60,
  "C+": 50,
  C: 40,
  "C-": 30,
  "D+": 22,
  D: 15,
  "D-": 10,
  E: 6,
  F: 2,
};

export function normalizeGrade(grade: string): string {
  return grade.trim().toUpperCase().replace("−", "-").replace("–", "-");
}

export function gradeScore(grade: string): number {
  return GRADE_SCORE[normalizeGrade(grade)] ?? 40;
}

export function gradeTier(grade: string): TierToken {
  return tierFromScore(gradeScore(grade));
}

export function ratingTier(rating: number, max = 10): TierToken {
  return tierFromScore((rating / max) * 100);
}

export function percentileTier(value: number): TierToken {
  return tierFromScore(value);
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Inline CSS custom properties so a component can theme itself from a tier. */
export function tierVars(token: TierToken): CSSProperties {
  return {
    ["--tier-color" as string]: token.color,
    ["--tier-soft" as string]: token.soft,
    ["--tier-border" as string]: token.border,
    ["--tier-glow" as string]: token.glow,
  };
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function playerInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Medals come from rank percentile buckets in the pipeline, not literal podium places. */
export const MEDAL_META = {
  gold: { label: "Top 10%", short: "Top 10", tone: "Ouro" },
  silver: { label: "Top 25%", short: "Top 25", tone: "Prata" },
  bronze: { label: "Top 40%", short: "Top 40", tone: "Bronze" },
} as const;

export type MedalKind = keyof typeof MEDAL_META;

export function rankPercentile(rank: number, poolSize: number): number {
  if (!poolSize) return 0;
  return clampPercent(((poolSize - rank) / poolSize) * 100);
}

export const TENDENCY_META = [
  {
    key: "contencao",
    label: "Contenção",
    hint: "Leitura, cobertura e interrupção de jogadas",
  },
  {
    key: "def1v1",
    label: "1vs1 defensivo",
    hint: "Eficiência em duelos individuais",
  },
  {
    key: "duelo_aereo",
    label: "Duelo aéreo",
    hint: "Domínio em disputas pelo alto",
  },
  {
    key: "construcao",
    label: "Construção",
    hint: "Qualidade na saída e progressão de bola",
  },
  {
    key: "ofensividade",
    label: "Ofensividade",
    hint: "Impacto com bola no terço ofensivo",
  },
] as const;
