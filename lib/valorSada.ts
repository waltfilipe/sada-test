/**
 * Valor SADA v4 — "espelho de mercado".
 *
 * ln(V) = 11.644 + liga + rating(rd,rd²) + idade(faixas) + 0.296·ln(min)
 *         + posição + perfil(por família) + contrato + jogouA
 *         + reputação(caps/exterior) + vitrine(G12)
 *
 * OLS unificado sobre ln(TM) — 881 jogadores ≥400 min das séries A/B/C com
 * valor TM (R²≈0.67). Coeficientes gerados por scripts/calibrate_valor_v4.py.
 * O valor TM **não** entra como insumo — é a referência externa contra a qual
 * o modelo é comparado.
 *
 * Compartilhado client/server: sem fs nem server-only.
 */

export type ValorSide = "acima" | "neutro" | "abaixo" | "sem_tm";

export type ValorFactors = {
  league: number;
  rating: number;
  age: number;
  minutes: number;
  position: number;
  profile: number;
  contract: number;
  career: number;
  reputation: number;
  /** Prêmio de vitrine — clube do G12. */
  club: number;
};

export const VALOR_BASE = 11.644;

import { ESTADUAIS_LEVELS } from "./estaduaisHub";

/**
 * Efeito da liga vs Série A. B/C medidos no OLS unificado v4;
 * D/estaduais extrapolados mantendo os offsets abaixo da C.
 */
export const LEAGUE_COEF: Record<string, number> = {
  "serie-a": 0,
  "serie-b": -1.451,
  "serie-c": -1.684,
  "serie-d": -2.3,
  "est-nv1": -2.1,
  "est-nv2": -2.4,
  "est-nv3": -2.7,
  "est-nv4": -3.0,
};

const EST_LEVEL_COEF: Record<string, number> = {
  nv1: LEAGUE_COEF["est-nv1"],
  nv2: LEAGUE_COEF["est-nv2"],
  nv3: LEAGUE_COEF["est-nv3"],
  nv4: LEAGUE_COEF["est-nv4"],
};

/** Coeficiente da liga: direto para nacionais; estaduais resolvem pelo nível do campeonato. */
export function leagueCoef(league: string): number {
  const direct = LEAGUE_COEF[league];
  if (direct != null) return direct;
  const level = ESTADUAIS_LEVELS.find((lvl) => lvl.members.some((m) => m.id === league));
  return level ? (EST_LEVEL_COEF[level.key] ?? -3.5) : -3.5;
}

/** Efeito por família posicional — base: zagueiros (0). Medido v4. */
export const POSITION_COEF: Record<string, number> = {
  zagueiros: 0,
  laterais: 0.238,
  "meio-campistas": 0.275,
  extremos: 0.494,
  atacantes: 0.513,
};

/**
 * Coeficiente por perfil dentro da família — base = perfil mais frequente
 * (Defensor de Área, Ofensivo, Contenção, Driblador, Alvo). Medido v4.
 */
export const PROFILE_COEF: Record<string, Record<string, number>> = {
  zagueiros: { Construtor: 0.335, Combativo: 0.092 },
  laterais: { Construtor: 0.14, Híbrido: 0.04, Defensivo: -0.262 },
  "meio-campistas": { Construtor: 0.236, "Box-to-box": 0.229, Híbrido: 0.134 },
  extremos: { "Meia Ponta": 0.112, Ruptura: 0.014, Híbrido: -0.042 },
  atacantes: { Finalizador: 0.348, Móvel: 0.043, Híbrido: -0.363 },
};

/** Faixas de idade — base: 26–28 anos (0). 29–30 suavizado do cliff medido. */
export function ageTerm(age: number | null): number {
  if (age == null) return 0;
  if (age < 21) return -0.026;
  if (age < 23) return -0.056;
  if (age < 26) return 0.105;
  if (age < 29) return 0;
  if (age < 31) return -0.3;
  return -0.594;
}

/**
 * Restante de contrato → termo (anos restantes). Medido v4.
 * O prêmio só vale se o atleta joga: ponderado por minutos
 * (titular ≥900 min recebe integral; reserva recebe fração, piso 0.4).
 */
export function contractTerm(years: number | null, minutes = 9999): number {
  if (years == null) return -0.229; // sem registro — desconto medido
  const w = Math.min(1, Math.max(0.4, minutes / 900));
  const t = years < 1 ? 0 : years < 2 ? 0.261 : years < 3.5 ? 0.634 : 0.988;
  return t * w;
}

export const PLAYED_A_COEF = 0.391;
export const CAPS_COEF = 0.098;
export const ABROAD_COEF = 0.406;
export const ABROAD_OTHER_COEF = 0.209;
export const G12_COEF = 0.468;

/** Clubes do G12 (normalizados por normClub) — efeito vitrine do mercado. */
export const G12_CLUBS: ReadonlySet<string> = new Set([
  "flamengo",
  "palmeiras",
  "corinthians",
  "saopaulo",
  "santos",
  "gremio",
  "internacional",
  "atleticomg",
  "fluminense",
  "botafogofr",
  "vasco",
  "cruzeiro",
]);

/**
 * Classificação vs valor de mercado:
 * sada/tm ≥ 1.5 → produção acima do que o mercado paga ("overperforming");
 * ≤ 0.67 → abaixo ("underperforming"); entre → em linha.
 */
export function valorSide(sada: number, tm: number | null | undefined): { side: ValorSide; ratio: number | null } {
  if (tm == null || tm <= 0) return { side: "sem_tm", ratio: null };
  const ratio = sada / tm;
  if (ratio >= 1.5) return { side: "acima", ratio };
  if (ratio <= 0.67) return { side: "abaixo", ratio };
  return { side: "neutro", ratio };
}

/** Rótulo da classificação para o tooltip de valor de mercado. */
export function valorSideLabel(side: ValorSide): string {
  switch (side) {
    case "acima":
      return "Overperforming — produz acima do valor de mercado";
    case "abaixo":
      return "Underperforming — produz abaixo do valor de mercado";
    case "neutro":
      return "Em linha — produção compatível com o valor de mercado";
    default:
      return "Sem valor TM para comparação";
  }
}

/** Formata valor em € estilo TM: 38M€ / 400mil€ / 50mil€. */
export function formatEur(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")}M€`;
  return `${Math.round(value / 1_000)}mil€`;
}

/** Texto do campo valor: TM quando existe; estimativa SADA com asterisco senão. */
export function marketValueLabel(marketValue: string | null | undefined, sadaValue: number | null | undefined): string {
  if (marketValue) return marketValue;
  if (sadaValue != null && Number.isFinite(sadaValue)) return `${formatEur(sadaValue)}*`;
  return "—";
}
