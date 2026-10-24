import "server-only";

import { getFamilyPlayers } from "@/lib/data.server";
import { isLeagueId, LEAGUES, type LeagueId } from "@/lib/leagues";
import { buildProjectionLabReport, PROJECTION_LAB_LEAGUE } from "@/lib/projectionMethodsLab";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const HISTORY_LEAGUE_IDS: LeagueId[] = LEAGUES.map((l) => l.id).filter(
  (id) => id !== PROJECTION_LAB_LEAGUE && !String(id).startsWith("est-"),
) as LeagueId[];

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

export function findPlayerHistoryProfiles(
  source: PlayerProfile,
  family: PositionFamily,
): PlayerProfile[] {
  const tmId = source.transfermarkt?.id;
  const nameKey = normalizeName(source.name);
  const found: PlayerProfile[] = [];

  for (const league of HISTORY_LEAGUE_IDS) {
    if (!isLeagueId(league)) continue;
    const pool = getFamilyPlayers(family, league);
    const hit = pool.find((p) => {
      if (tmId && p.transfermarkt?.id === tmId) return true;
      return normalizeName(p.name) === nameKey && (p.minutes ?? 0) >= 180;
    });
    if (hit && hit.player_id !== source.player_id) {
      found.push(hit);
    }
  }

  found.sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  return found.slice(0, 3);
}

export function getProjectionLabReport(playerId: string, family: PositionFamily) {
  const pool = getFamilyPlayers(family, PROJECTION_LAB_LEAGUE);
  const source = pool.find((p) => p.player_id === playerId);
  if (!source) return null;
  const history = findPlayerHistoryProfiles(source, family);
  const report = buildProjectionLabReport(source, pool, history);
  if (!report) return null;
  return {
    ...report,
    historySeasons: history.map((h) => ({
      league: h.player_id.split("-")[0] ?? "outra",
      label: `${h.name} (${h.club})`,
      minutes: h.minutes ?? 0,
    })),
  };
}
