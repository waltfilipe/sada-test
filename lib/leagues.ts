export type LeagueId = "serie-a" | "serie-b" | "serie-c" | "serie-d" | "mls-next-pro";

export type LeagueInfo = {
  id: LeagueId;
  slug: LeagueId;
  name: string;
  season: string;
  brand: string;
  tagline: string;
  heatmaps: boolean;
};

export const LEAGUES: LeagueInfo[] = [
  {
    id: "serie-a",
    slug: "serie-a",
    name: "Série A",
    season: "2026",
    brand: "SA",
    tagline: "Brasileirão",
    heatmaps: true,
  },
  {
    id: "serie-b",
    slug: "serie-b",
    name: "Série B",
    season: "2026",
    brand: "SB",
    tagline: "Brasileirão",
    heatmaps: true,
  },
  {
    id: "serie-c",
    slug: "serie-c",
    name: "Série C",
    season: "2026",
    brand: "SC",
    tagline: "Brasileirão",
    heatmaps: true,
  },
  {
    id: "serie-d",
    slug: "serie-d",
    name: "Série D",
    season: "2026",
    brand: "SD",
    tagline: "Brasileirão",
    heatmaps: false,
  },
  {
    id: "mls-next-pro",
    slug: "mls-next-pro",
    name: "MLS Next Pro",
    season: "2026",
    brand: "NP",
    tagline: "MLS",
    heatmaps: false,
  },
];

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
