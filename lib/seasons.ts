import type { LeagueId } from "@/lib/leagues";

export const BRASILEIRAO_SEASONS = ["2026", "2025", "2024", "2023", "2022"] as const;
export type BrasileiraoSeason = (typeof BRASILEIRAO_SEASONS)[number];

export const CURRENT_SEASON: BrasileiraoSeason = "2026";

export function isBrasileiraoLeague(league: LeagueId): boolean {
  return league === "serie-a" || league === "serie-b" || league === "serie-c";
}

export function parseSeasonParam(value: string | null | undefined): BrasileiraoSeason {
  if (value && (BRASILEIRAO_SEASONS as readonly string[]).includes(value)) {
    return value as BrasileiraoSeason;
  }
  return CURRENT_SEASON;
}

export function seasonQuery(season: string): string {
  return season === CURRENT_SEASON ? "" : `temporada=${season}`;
}

export function withSeasonQuery(path: string, season: string): string {
  if (season === CURRENT_SEASON) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}temporada=${season}`;
}
