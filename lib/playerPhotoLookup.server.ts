import "server-only";

import fs from "fs";
import path from "path";
import { CURRENT_SEASON } from "@/lib/seasons";
import type { LeagueId } from "@/lib/leagues";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { PlayerProfile, PlayerSummary, TransfermarktInfo } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const BR_LEAGUES: LeagueId[] = ["serie-a", "serie-b", "serie-c"];

function normName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normClub(club: string): string {
  return normName(club);
}

function athleteKey(name: string, birthYear: number | null | undefined): string {
  return `${normName(name)}|${birthYear ?? 0}`;
}

type PhotoIndex = {
  byAthlete: Map<string, TransfermarktInfo>;
  byTmId: Map<string, TransfermarktInfo>;
  byNameClub: Map<string, TransfermarktInfo>;
  byName: Map<string, TransfermarktInfo>;
};

let indexCache: PhotoIndex | null = null;

function pickRicher(a: TransfermarktInfo | undefined, b: TransfermarktInfo): TransfermarktInfo {
  if (!a?.photo) return b;
  if (!b?.photo) return a;
  return b;
}

function remember(
  maps: PhotoIndex,
  tm: TransfermarktInfo,
  name: string,
  club: string,
  birthYear: number | null | undefined,
) {
  if (!tm?.photo) return;
  const athlete = athleteKey(name, birthYear);
  maps.byAthlete.set(athlete, pickRicher(maps.byAthlete.get(athlete), tm));
  if (tm.id) maps.byTmId.set(String(tm.id), pickRicher(maps.byTmId.get(String(tm.id)), tm));
  if (club) {
    const nc = `${normName(name)}::${normClub(club)}`;
    maps.byNameClub.set(nc, pickRicher(maps.byNameClub.get(nc), tm));
  }
  const n = normName(name);
  maps.byName.set(n, pickRicher(maps.byName.get(n), tm));
}

function loadCurrentSeasonProfiles(maps: PhotoIndex) {
  for (const league of BR_LEAGUES) {
    const base = path.join(DATA_DIR, league);
    for (const family of POSITION_FAMILIES) {
      const file = path.join(base, `family-${family.key}.json`);
      if (!fs.existsSync(file)) continue;
      const payload = JSON.parse(fs.readFileSync(file, "utf-8")) as { players: PlayerProfile[] };
      for (const player of payload.players ?? []) {
        if (player.transfermarkt?.photo) {
          remember(maps, player.transfermarkt, player.name, player.club, player.birth_year);
        }
      }
    }
  }
}

function loadTransfermarktCache(maps: PhotoIndex) {
  const file = path.join(DATA_DIR, "transfermarkt-cache.json");
  if (!fs.existsSync(file)) return;
  const cache = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, TransfermarktInfo>;
  for (const [key, tm] of Object.entries(cache)) {
    if (!tm?.photo) continue;
    const [namePart, clubPart] = key.split("::");
    if (namePart && clubPart) {
      remember(maps, tm, namePart, clubPart, null);
    } else if (tm.id) {
      maps.byTmId.set(String(tm.id), pickRicher(maps.byTmId.get(String(tm.id)), tm));
    }
  }
}

function loadPhotoManifest(maps: PhotoIndex) {
  const file = path.join(process.cwd(), "photos", "photos", "manifest.json");
  if (!fs.existsSync(file)) return;
  const manifest = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    { name?: string; file?: string; photo_url?: string }
  >;
  for (const row of Object.values(manifest)) {
    if (!row.file || !row.name) continue;
    const tm: TransfermarktInfo = {
      id: null,
      photo: `/photos/${row.file}`,
      market_value: null,
      market_value_eur: null,
      contract_until: null,
      contract_remaining: null,
      club: null,
      profile_url: null,
    };
    remember(maps, tm, row.name, "", null);
  }
}

function buildPhotoIndex(): PhotoIndex {
  const maps: PhotoIndex = {
    byAthlete: new Map(),
    byTmId: new Map(),
    byNameClub: new Map(),
    byName: new Map(),
  };
  loadCurrentSeasonProfiles(maps);
  loadTransfermarktCache(maps);
  loadPhotoManifest(maps);
  return maps;
}

function photoIndex(): PhotoIndex {
  if (!indexCache) indexCache = buildPhotoIndex();
  return indexCache;
}

export function resetPhotoIndexCache() {
  indexCache = null;
}

function lookupTransfermarkt(
  player: Pick<PlayerSummary, "name" | "club" | "birth_year" | "transfermarkt">,
): TransfermarktInfo | null {
  if (player.transfermarkt?.photo) return player.transfermarkt;
  const maps = photoIndex();
  const fromAthlete = maps.byAthlete.get(athleteKey(player.name, player.birth_year));
  if (fromAthlete?.photo) return fromAthlete;
  const tmId = player.transfermarkt?.id;
  if (tmId) {
    const fromId = maps.byTmId.get(String(tmId));
    if (fromId?.photo) return fromId;
  }
  const fromNc = maps.byNameClub.get(`${normName(player.name)}::${normClub(player.club)}`);
  if (fromNc?.photo) return fromNc;
  const fromName = maps.byName.get(normName(player.name));
  if (fromName?.photo) return fromName;
  return player.transfermarkt ?? null;
}

export function withResolvedPlayerPhoto<T extends PlayerSummary>(player: T): T {
  if (player.transfermarkt?.photo) return player;
  const tm = lookupTransfermarkt(player);
  if (!tm?.photo) return player;
  return {
    ...player,
    transfermarkt: {
      ...player.transfermarkt,
      ...tm,
      photo: tm.photo,
      id: tm.id ?? player.transfermarkt?.id ?? null,
      club: tm.club ?? player.transfermarkt?.club ?? null,
      profile_url: tm.profile_url ?? player.transfermarkt?.profile_url ?? null,
    },
  };
}

export function withResolvedPlayerPhotos<T extends PlayerSummary>(players: T[]): T[] {
  return players.map((player) => withResolvedPlayerPhoto(player));
}
