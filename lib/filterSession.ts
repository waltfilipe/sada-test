const STATE_KEY = "serie-a-scout:filters-state";
const RESTORE_KEY = "serie-a-scout:filters-restore";

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

export function saveFilters(state: SavedFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function markFiltersReturn() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESTORE_KEY, "1");
}

export function takeFiltersReturn(): SavedFilters | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem(RESTORE_KEY) !== "1") return null;
  sessionStorage.removeItem(RESTORE_KEY);
  const raw = sessionStorage.getItem(STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedFilters;
  } catch {
    return null;
  }
}
