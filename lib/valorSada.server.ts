import "server-only";

import fs from "fs";
import path from "path";
import {
  ABROAD_COEF,
  ABROAD_OTHER_COEF,
  CAPS_COEF,
  G12_CLUBS,
  G12_COEF,
  PLAYED_A_COEF,
  POSITION_COEF,
  PROFILE_COEF,
  VALOR_BASE,
  ageTerm,
  contractTerm,
  leagueCoef,
  type ValorFactors,
} from "./valorSada";
import type { PlayerSummary } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "cross-season");

/** Data-base para contrato restante (meio da temporada 2026). */
const REF_DATE = new Date("2026-07-01T00:00:00Z").getTime();
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const MINUTES_FLOOR = 120;

type PeopleRecord = {
  rows?: { league?: string; season?: string }[];
};

type TmProfile = {
  caps?: number | null;
  move?: { from_club?: string | null } | null;
};

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

let peopleCache: Record<string, PeopleRecord> | null = null;
let tmProfileCache: Record<string, TmProfile> | null = null;
let geoEu: Set<string> | null = null;
let geoForeign: Set<string> | null = null;
let brClubs: Set<string> | null = null;

function people(): Record<string, PeopleRecord> {
  peopleCache ??= readJson(path.join(DATA_DIR, "people.json"), {});
  return peopleCache!;
}

function tmProfiles(): Record<string, TmProfile> {
  tmProfileCache ??= readJson(path.join(DATA_DIR, "tm-profile-cache.json"), {});
  return tmProfileCache!;
}

/** Mesma normalização de scripts/calibrate_valor_v4.py (ascii, minúsculo, só alfanum). */
export function norm(club: string): string {
  return (club || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function geoSets(): { eu: Set<string>; foreign: Set<string>; br: Set<string> } {
  if (!geoEu || !geoForeign || !brClubs) {
    const geo = readJson<{ eu?: string[]; foreign?: string[] }>(path.join(DATA_DIR, "geo-lists.json"), {});
    geoEu = new Set((geo.eu ?? []).map(norm));
    geoForeign = new Set((geo.foreign ?? []).map(norm));
    const br = readJson<string[]>(path.join(DATA_DIR, "br-clubs.json"), []);
    brClubs = new Set(br.map(norm));
  }
  return { eu: geoEu, foreign: geoForeign, br: brClubs };
}

function prefixHit(normed: string, set: Set<string>): boolean {
  if (set.has(normed)) return true;
  for (const known of set) {
    if ((normed.length >= 6 && known.startsWith(normed)) || (known.length >= 6 && normed.startsWith(known))) {
      return true;
    }
  }
  return false;
}

/** Região do clube — mesma regra de calibrate_valor_v4.py. */
function clubRegion(club: string | null | undefined): "europa" | "brasil" | "exterior" {
  const n = norm(club ?? "");
  if (!n) return "brasil";
  const { eu, foreign, br } = geoSets();
  if (foreign.has(n)) return "exterior";
  if (prefixHit(n, eu)) return "europa";
  if (prefixHit(n, br)) return "brasil";
  return "exterior";
}

/** "31/12/2029" ou "2029-12-31" → anos restantes na data-base do modelo. */
function contractYears(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/) ?? raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [y, mo, d] =
    m[0].includes("-") && m[1].length === 4
      ? [Number(m[1]), Number(m[2]), Number(m[3])]
      : [Number(m[3]), Number(m[2]), Number(m[1])];
  const years = (Date.UTC(y, mo - 1, d) - REF_DATE) / YEAR_MS;
  return Number.isFinite(years) ? Math.max(0, years) : null;
}

function playedSerieA(personKey: string | null | undefined): boolean {
  if (!personKey) return false;
  const rows = people()[personKey]?.rows ?? [];
  return rows.some((row) => row.league === "serie-a" && row.season !== "2026");
}

function abroadCoef(tmId: string | null | undefined): number {
  if (!tmId) return 0;
  const from = tmProfiles()[tmId]?.move?.from_club;
  if (!from) return 0;
  const region = clubRegion(from);
  if (region === "europa") return ABROAD_COEF;
  if (region === "exterior") return ABROAD_OTHER_COEF;
  return 0;
}

function capsOf(tmId: string | null | undefined): number {
  if (!tmId) return 0;
  return tmProfiles()[tmId]?.caps ?? 0;
}

/**
 * Estimativa SADA em € para a linha de uma liga/temporada.
 * Devolve null sem família posicional (goleiros/linhas sem perfil).
 */
export function sadaValue(player: PlayerSummary, league: string): number | null {
  const fam = player.position_family;
  if (!fam) return null;
  const tm = player.transfermarkt ?? null;
  const tmId = tm?.id ?? null;

  const rd = Math.min(1.8, Math.max(-0.8, (player.rating ?? 6.7) - 6.7));
  const age = player.birth_year ? 2026 - player.birth_year : null;
  const cYears = contractYears(tm?.contract_until ?? null);
  const serieAExp = league !== "serie-a" && playedSerieA(player.person_key);

  const factors: ValorFactors = {
    league: leagueCoef(league),
    rating: 0.171 * rd + 0.21 * rd * rd,
    age: ageTerm(age),
    minutes: 0.296 * Math.log(Math.max(player.minutes ?? 0, MINUTES_FLOOR)),
    position: POSITION_COEF[fam] ?? 0,
    profile: PROFILE_COEF[fam]?.[player.profile ?? ""] ?? 0,
    contract: contractTerm(cYears, player.minutes ?? 0),
    career: serieAExp ? PLAYED_A_COEF : 0,
    reputation: CAPS_COEF * Math.log1p(capsOf(tmId)) + abroadCoef(tmId),
    club: G12_CLUBS.has(norm(player.club ?? "")) ? G12_COEF : 0,
  };
  const ln =
    VALOR_BASE +
    factors.league +
    factors.rating +
    factors.age +
    factors.minutes +
    factors.position +
    factors.profile +
    factors.contract +
    factors.career +
    factors.reputation +
    factors.club;
  const value = Math.exp(ln);
  return Number.isFinite(value) ? value : null;
}

/** Injeta sada_value numa lista de players (mesma liga). */
export function withSadaValues<T extends PlayerSummary>(players: T[], league: string): T[] {
  return players.map((p) => ({ ...p, sada_value: sadaValue(p, league) }));
}
