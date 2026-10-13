import "server-only";

import fs from "fs";
import path from "path";
import { DEFAULT_LEAGUE, isLeagueId, type LeagueId } from "./leagues";
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
const wyscoutPositionsCache = new Map<LeagueId, Record<string, string[]>>();
const playersCache = new Map<LeagueId, { players: PlayerSummary[]; total: number }>();
const profileCache = new Map<string, PlayerProfile>();
const searchRowsCache = new Map<LeagueId, PlayerSearchRow[]>();

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
          heatmap,
        };
      }),
    );
  }
  return searchRowsCache.get(id)!;
}

function wyscoutPositions(league: LeagueId): Record<string, string[]> {
  if (!wyscoutPositionsCache.has(league)) {
    const filePath = path.join(leagueDir(league), "wyscout-positions.json");
    wyscoutPositionsCache.set(league, fs.existsSync(filePath) ? readJson(filePath) : {});
  }
  return wyscoutPositionsCache.get(league) ?? {};
}

function withWyscoutPositions<T extends PlayerProfile>(player: T, league: LeagueId): T {
  const codes = wyscoutPositions(league)[player.player_id];
  if (!codes?.length || !player.heatmap?.points?.length) return player;
  return { ...player, wyscout_positions: codes };
}

export function getPlayerProfile(playerId: string, league?: string): PlayerProfile | null {
  const id = resolveLeague(league);
  const cacheKey = `${id}:${playerId}`;
  if (!profileCache.has(cacheKey)) {
    const filePath = path.join(leagueDir(id), "profiles", `${playerId}.json`);
    if (!fs.existsSync(filePath)) return null;
    profileCache.set(cacheKey, readJson(filePath));
  }
  const profile = profileCache.get(cacheKey);
  return profile ? withWyscoutPositions(profile, id) : null;
}

export function getFamilyPlayers(family: PositionFamily, league?: string): PlayerProfile[] {
  const id = resolveLeague(league);
  const filePath = path.join(leagueDir(id), `family-${family}.json`);
  if (!fs.existsSync(filePath)) return [];
  const payload = readJson<{ players: PlayerProfile[] }>(filePath);
  return payload.players.map((player) => withWyscoutPositions(player, id));
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
    if (filters.foot && filters.foot !== "all" && player.foot !== filters.foot) return false;
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
