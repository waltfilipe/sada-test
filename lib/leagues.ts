export type LeagueId = "serie-a" | "serie-c";

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
    season: "2025/26",
    brand: "SA",
    tagline: "Brasileirão",
    heatmaps: true,
  },
  {
    id: "serie-c",
    slug: "serie-c",
    name: "Série C",
    season: "2026 · 1ª fase",
    brand: "SC",
    tagline: "Primeira fase",
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
