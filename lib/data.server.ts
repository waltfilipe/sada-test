import "server-only";

import fs from "fs";
import path from "path";
import { formatFoot } from "./feet";
import { DEFAULT_LEAGUE, isLeagueId, type LeagueId } from "./leagues";
import { POSITION_FAMILIES } from "./positions";
import { playerStatBadges } from "./statBadges";
import type { PlayerHeatmapData, PlayerProfile, PlayerSearchRow, PlayerSummary, PositionFamily, SiteMeta } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function leagueDir(league: LeagueId): string {
  return path.join(DATA_DIR, league);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

const metaCache = new Map<LeagueId, SiteMeta>();
const playersCache = new Map<LeagueId, { players: PlayerSummary[]; total: number }>();
const profileIndexCache = new Map<LeagueId, Map<string, PlayerProfile>>();
const searchRowsCache = new Map<LeagueId, PlayerSearchRow[]>();
const familyCache = new Map<string, PlayerProfile[]>();

/** Coarser touch cloud for list and compare cards. Counts stay, so hotspots do not flatten. */
export function compactHeatmap(heatmap: PlayerProfile["heatmap"]): PlayerProfile["heatmap"] {
  const points = heatmap?.points;
  if (!points?.length || points.length <= 90) return heatmap;
  const bins = new Map<string, { x: number; y: number; w: number }>();
  for (const point of points) {
    const x = Math.round(point.x / 8) * 8;
    const y = Math.round(point.y / 8) * 8;
    const key = `${x}:${y}`;
    const weight = point.w ?? 1;
    const prev = bins.get(key);
    if (prev) prev.w += weight;
    else bins.set(key, { x, y, w: weight });
  }
  return { ...heatmap, points: [...bins.values()] };
}

function resolveLeague(league?: string): LeagueId {
  if (league && isLeagueId(league)) return league;
  return DEFAULT_LEAGUE;
}

export function getMeta(league?: string): SiteMeta {
  const id = resolveLeague(league);
  if (!metaCache.has(id)) {
    const file = path.join(leagueDir(id), "meta.json");
    if (!fs.existsSync(file)) {
      throw new Error(`Missing meta for league ${id}. Run scripts/build_site_data.py`);
    }
    metaCache.set(id, readJson(file));
  }
  return metaCache.get(id)!;
}

export function getPlayers(league?: string): PlayerSummary[] {
  const id = resolveLeague(league);
  if (!playersCache.has(id)) {
    const file = path.join(leagueDir(id), "players.json");
    playersCache.set(id, readJson(file));
  }
  return playersCache.get(id)!.players;
}

export function getSearchRows(league?: string): PlayerSearchRow[] {
  const id = resolveLeague(league);
  if (!searchRowsCache.has(id)) {
    const meta = getMeta(id);
    searchRowsCache.set(
      id,
      getPlayers(id).map((player) => {
        const profile = getPlayerProfile(player.player_id, id);
        const heatmap = meta.heatmaps_enabled ? profile?.heatmap : undefined;
        return {
          ...player,
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
          badges: profile ? playerStatBadges(profile).map((badge) => badge.key) : [],
          scatter: profile?.scatter,
          heatmap: compactHeatmap(heatmap),
        };
      }),
    );
  }
  return searchRowsCache.get(id)!;
}

/**
 * Profiles live inside each `family-*.json`. Reading `profiles/*.json` as well
 * traced a second copy (~110 MB) into every serverless function and pushed each
 * route over Vercel's bundling budget, so Hobby created one function per route.
 */
function profileIndex(league: LeagueId): Map<string, PlayerProfile> {
  const cached = profileIndexCache.get(league);
  if (cached) return cached;
  const index = new Map<string, PlayerProfile>();
  for (const family of POSITION_FAMILIES) {
    for (const player of getFamilyPlayers(family.key, league)) {
      index.set(player.player_id, player);
    }
  }
  profileIndexCache.set(league, index);
  return index;
}

export function getPlayerProfile(playerId: string, league?: string): PlayerProfile | null {
  return profileIndex(resolveLeague(league)).get(playerId) ?? null;
}

export function getFamilyPlayers(family: PositionFamily, league?: string): PlayerProfile[] {
  const id = resolveLeague(league);
  const cacheKey = `${id}:${family}`;
  const cached = familyCache.get(cacheKey);
  if (cached) return cached;
  const filePath = path.join(leagueDir(id), `family-${family}.json`);
  if (!fs.existsSync(filePath)) return [];
  const payload = readJson<{ players: PlayerProfile[] }>(filePath);
  familyCache.set(cacheKey, payload.players);
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
  league?: string,
): PlayerSummary[] {
  return players.filter((player) => {
    if (filters.family && player.position_family !== filters.family) return false;
    if (filters.club && filters.club !== "all" && player.club !== filters.club) return false;
    if (filters.nationality && filters.nationality !== "all" && player.nationality !== filters.nationality) return false;
    if (filters.foot && filters.foot !== "all" && formatFoot(player.foot) !== filters.foot) return false;
    if (filters.profiles?.length && !filters.profiles.includes(player.profile)) return false;
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
    if (filters.tendencies) {
      const profile = getPlayerProfile(player.player_id, league);
      if (!profile) return false;
      for (const [key, range] of Object.entries(filters.tendencies) as [
        keyof PlayerProfile["tendencies"],
        [number, number],
      ][]) {
        const value = profile.tendencies[key];
        if (value < range[0] || value > range[1]) return false;
      }
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${player.name} ${player.club} ${player.position}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
