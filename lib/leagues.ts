import { ESTADUAIS_LEAGUE_IDS, ESTADUAIS_LEVELS, type EstadualLeagueId } from "./estaduaisHub";

export type LeagueId = "serie-a" | "serie-b" | "serie-c" | "serie-d" | EstadualLeagueId;

export type LeagueInfo = {
  id: LeagueId;
  slug: LeagueId;
  name: string;
  /** Rótulo do pool de percentis quando difere do nome da liga (ex.: multi-ano). */
  poolName?: string;
  season: string;
  brand: string;
  tagline: string;
  heatmaps: boolean;
  physicalRun: boolean;
  logo: string;
};

const BRASILEIRAO: LeagueInfo[] = [
  {
    id: "serie-a",
    slug: "serie-a",
    name: "Série A",
    season: "2026",
    brand: "A",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: true,
    logo: "/competitions/serie-a.svg",
  },
  {
    id: "serie-b",
    slug: "serie-b",
    name: "Série B",
    season: "2026",
    brand: "B",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: false,
    logo: "/competitions/serie-b.svg",
  },
  {
    id: "serie-c",
    slug: "serie-c",
    name: "Série C",
    season: "2026",
    brand: "C",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: false,
    logo: "/competitions/serie-c.svg",
  },
  {
    id: "serie-d",
    slug: "serie-d",
    name: "Série D",
    season: "2026",
    brand: "D",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: false,
    logo: "/competitions/serie-d.svg",
  },
];

const ESTADUAIS: LeagueInfo[] = ESTADUAIS_LEVELS.map((level) => ({
  id: level.id,
  slug: level.id,
  name: level.name,
  season: "2026",
  brand: level.id.replace("est-nv", "N"),
  tagline: "Estaduais",
  heatmaps: false,
  physicalRun: false,
  logo: level.members[0]?.logo ?? "/competitions/outros.svg",
}));

/** Bloco próprio do Paulista A2 — pool multi-ano 2022-2026 (piloto). */
const PAUA2: LeagueInfo[] = [
  {
    id: "est-paua2",
    slug: "est-paua2",
    name: "Paulista A2",
    poolName: "Paulista A2 · 2022–26",
    season: "2026",
    brand: "A2",
    tagline: "Estaduais",
    heatmaps: false,
    physicalRun: false,
    logo: "/competitions/paulista-a2.png",
  },
];

/** Ligas publicadas no site. Estaduais entram por nível, não por campeonato. */
export const LEAGUES: LeagueInfo[] = [...BRASILEIRAO, ...ESTADUAIS, ...PAUA2];

export const BRASILEIRAO_LEAGUES = BRASILEIRAO;

export const DEFAULT_LEAGUE: LeagueId = "serie-a";

export function isLeagueId(value: string): value is LeagueId {
  return (ESTADUAIS_LEAGUE_IDS as readonly string[]).includes(value) || BRASILEIRAO.some((league) => league.id === value);
}

export function getLeague(id: string): LeagueInfo | undefined {
  return LEAGUES.find((league) => league.id === id);
}

/** Prefix internal app paths with the active league segment. */
export function leaguePath(league: LeagueId, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `/${league}`;
  return `/${league}${normalized}`;
}
