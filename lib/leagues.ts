import { ESTADUAIS_LEAGUE_IDS, type EstadualLeagueId } from "./estaduaisHub";

export type LeagueId =
  | "serie-a"
  | "serie-b"
  | "serie-c"
  | "serie-d"
  | "est-nv1-paulista"
  | "est-nv1-gaucho"
  | "est-nv1-mineiro"
  | "est-nv1-carioca"
  | "est-nv2-paranaense"
  | "est-nv2-catarinense"
  | "est-nv2-paulista-a2"
  | "est-nv2-baiano"
  | "est-nv3-cearense"
  | "est-nv3-pernambucano"
  | "est-nv3-paulista-a3"
  | "est-nv3-goiano"
  | "est-nv4-outros";

export type LeagueInfo = {
  id: LeagueId;
  slug: LeagueId;
  name: string;
  season: string;
  brand: string;
  tagline: string;
  heatmaps: boolean;
  physicalRun: boolean;
};

const BRASILEIRAO: LeagueInfo[] = [
  {
    id: "serie-a",
    slug: "serie-a",
    name: "Série A",
    season: "2026",
    brand: "SA",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: true,
  },
  {
    id: "serie-b",
    slug: "serie-b",
    name: "Série B",
    season: "2026",
    brand: "SB",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: false,
  },
  {
    id: "serie-c",
    slug: "serie-c",
    name: "Série C",
    season: "2026",
    brand: "SC",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: false,
  },
  {
    id: "serie-d",
    slug: "serie-d",
    name: "Série D",
    season: "2026",
    brand: "SD",
    tagline: "Brasileirão",
    heatmaps: true,
    physicalRun: false,
  },
];

const ESTADUAIS_META: Record<EstadualLeagueId, Omit<LeagueInfo, "id" | "slug">> = {
  "est-nv1-paulista": { name: "Paulista", season: "2026", brand: "PA", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv1-gaucho": { name: "Gaúcho", season: "2026", brand: "RS", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv1-mineiro": { name: "Mineiro", season: "2026", brand: "MG", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv1-carioca": { name: "Carioca", season: "2026", brand: "RJ", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv2-paranaense": { name: "Paranaense", season: "2026", brand: "PR", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv2-catarinense": { name: "Catarinense", season: "2026", brand: "SC", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv2-paulista-a2": { name: "Paulista A2", season: "2026", brand: "A2", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv2-baiano": { name: "Baiano", season: "2026", brand: "BA", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv3-cearense": { name: "Cearense", season: "2026", brand: "CE", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv3-pernambucano": { name: "Pernambucano", season: "2026", brand: "PE", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv3-paulista-a3": { name: "Paulista A3", season: "2026", brand: "A3", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv3-goiano": { name: "Goiano", season: "2026", brand: "GO", tagline: "Estadual", heatmaps: false, physicalRun: false },
  "est-nv4-outros": { name: "Outros estaduais", season: "2026", brand: "BR", tagline: "Estadual", heatmaps: false, physicalRun: false },
};

const ESTADUAIS: LeagueInfo[] = ESTADUAIS_LEAGUE_IDS.map((id) => ({
  id,
  slug: id,
  ...ESTADUAIS_META[id],
}));

/** Ligas publicadas no site (sem MLS Next Pro). */
export const LEAGUES: LeagueInfo[] = [...BRASILEIRAO, ...ESTADUAIS];

export const BRASILEIRAO_LEAGUES = BRASILEIRAO;

export const DEFAULT_LEAGUE: LeagueId = "serie-a";

export function isLeagueId(value: string): value is LeagueId {
  return LEAGUES.some((league) => league.id === value);
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
