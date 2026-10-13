import type { LeagueId } from "@/lib/leagues";

export type SavedFilters = {
  family: string;
  query: string;
  club: string;
  origin: "all" | "br" | "out";
  foot: string;
  profiles: string[];
  badges: string[];
  sort: "destaque" | "minutes" | "age" | "name";
  age: [number, number];
  height: [number, number];
  minutes: [number, number];
};

function keys(league: LeagueId) {
  return {
    state: `${league}-scout:filters-state`,
    restore: `${league}-scout:filters-restore`,
  };
}

export function saveFilters(league: LeagueId, state: SavedFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(keys(league).state, JSON.stringify(state));
}

export function markFiltersReturn(league: LeagueId) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(keys(league).restore, "1");
}

export function takeFiltersReturn(league: LeagueId): SavedFilters | null {
  if (typeof window === "undefined") return null;
  const { state, restore } = keys(league);
  if (sessionStorage.getItem(restore) !== "1") return null;
  sessionStorage.removeItem(restore);
  const raw = sessionStorage.getItem(state);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedFilters;
  } catch {
    return null;
  }
}
