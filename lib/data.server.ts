import "server-only";

import fs from "fs";
import path from "path";
import type { PlayerProfile, PlayerSearchRow, PlayerSummary, PositionFamily, SiteMeta } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8")) as T;
}

let metaCache: SiteMeta | null = null;
let playersCache: { players: PlayerSummary[]; total: number } | null = null;
const profileCache = new Map<string, PlayerProfile>();

export function getMeta(): SiteMeta {
  if (!metaCache) metaCache = readJson("meta.json");
  return metaCache!;
}

export function getPlayers(): PlayerSummary[] {
  if (!playersCache) playersCache = readJson("players.json");
  return playersCache!.players;
}

let searchRowsCache: PlayerSearchRow[] | null = null;

/**
 * Summaries joined with the per-player tendency indices so the advanced search
 * can filter the whole pool without shipping the full profile payload.
 */
export function getSearchRows(): PlayerSearchRow[] {
  if (searchRowsCache) return searchRowsCache;

  searchRowsCache = getPlayers().map((player) => {
    const profile = getPlayerProfile(player.player_id);
    return {
      ...player,
      // players.json predates the Transfermarkt enrichment, so take it from the profile.
      transfermarkt: player.transfermarkt ?? profile?.transfermarkt ?? null,
      goals: profile?.goals ?? 0,
      assists: profile?.assists ?? 0,
      tendencies: profile?.tendencies ?? {
        construcao: 0,
        ofensividade: 0,
        def1v1: 0,
        contencao: 0,
        duelo_aereo: 0,
      },
    };
  });

  return searchRowsCache;
}

export function getPlayerProfile(playerId: string): PlayerProfile | null {
  if (!profileCache.has(playerId)) {
    const filePath = path.join(DATA_DIR, "profiles", `${playerId}.json`);
    if (!fs.existsSync(filePath)) return null;
    profileCache.set(playerId, readJson(`profiles/${playerId}.json`));
  }
  return profileCache.get(playerId) ?? null;
}

export function getFamilyPlayers(family: PositionFamily): PlayerProfile[] {
  const filePath = path.join(DATA_DIR, `family-${family}.json`);
  if (!fs.existsSync(filePath)) return [];
  const payload = readJson<{ players: PlayerProfile[] }>(`family-${family}.json`);
  return payload.players;
}

export function filterPlayers(
  players: PlayerSummary[],
  filters: {
    family?: PositionFamily;
    club?: string;
    nationality?: string;
    foot?: string;
    profiles?: string[];
    height?: [number, number];
    minutes?: [number, number];
    birthYear?: [number, number];
    rating?: [number, number];
    tendencies?: Partial<Record<keyof PlayerProfile["tendencies"], [number, number]>>;
    search?: string;
  },
): PlayerSummary[] {
  return players.filter((player) => {
    if (filters.family && player.position_family !== filters.family) return false;
    if (filters.club && filters.club !== "all" && player.club !== filters.club) return false;
    if (filters.nationality && filters.nationality !== "all" && player.nationality !== filters.nationality) return false;
    if (filters.foot && filters.foot !== "all" && player.foot !== filters.foot) return false;
    if (filters.profiles?.length && !filters.profiles.includes(player.profile) && player.profile !== "Híbrido") {
      const hybridAllowed = filters.profiles.length > 0 && player.profile === "Híbrido";
      if (!hybridAllowed) return false;
    }
    if (filters.height && player.height != null) {
      if (player.height < filters.height[0] || player.height > filters.height[1]) return false;
    }
    if (filters.minutes) {
      if (player.minutes < filters.minutes[0] || player.minutes > filters.minutes[1]) return false;
    }
    if (filters.birthYear && player.birth_year != null) {
      if (player.birth_year < filters.birthYear[0] || player.birth_year > filters.birthYear[1]) return false;
    }
    if (filters.rating) {
      if (player.rating < filters.rating[0] || player.rating > filters.rating[1]) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!player.label.toLowerCase().includes(q) && !player.club.toLowerCase().includes(q)) return false;
    }
    if (filters.tendencies) {
      const profile = getPlayerProfile(player.player_id);
      if (!profile) return false;
      for (const [key, range] of Object.entries(filters.tendencies)) {
        if (!range) continue;
        const value = profile.tendencies[key as keyof PlayerProfile["tendencies"]];
        if (value < range[0] || value > range[1]) return false;
      }
    }
    return true;
  });
}
