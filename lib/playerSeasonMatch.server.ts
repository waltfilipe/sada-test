import "server-only";

import { withResolvedPlayerPhoto } from "@/lib/playerPhotoLookup.server";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerProfile } from "@/lib/types";
import { getFamilyPlayers } from "@/lib/data.server";

export function normPlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findPlayerInSeason(
  league: LeagueId,
  season: string,
  name: string,
  birthYear: number | null | undefined,
): PlayerProfile | null {
  const key = `${normPlayerName(name)}|${birthYear ?? 0}`;
  for (const family of POSITION_FAMILIES) {
    for (const player of getFamilyPlayers(family.key, league, season)) {
      const pk = `${normPlayerName(player.name)}|${player.birth_year ?? 0}`;
      if (pk === key) return withResolvedPlayerPhoto(player) as PlayerProfile;
    }
  }
  return null;
}
