import "server-only";

import fs from "fs";
import path from "path";
import type { PlayerProfile, TransferLeg } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

type TransfersFile = Record<string, { current_club: string; legs: TransferLeg[] }>;

let transfers: TransfersFile | null | undefined;
let rowPerson: Map<string, string> | undefined;

function transfersFile(): TransfersFile {
  if (transfers === undefined) {
    const file = path.join(DATA_DIR, "cross-season", "transfers.json");
    transfers = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as TransfersFile) : null;
  }
  return transfers ?? {};
}

function personIndex(): Map<string, string> {
  if (rowPerson) return rowPerson;
  rowPerson = new Map();
  const file = path.join(DATA_DIR, "cross-season", "persons.json");
  if (!fs.existsSync(file)) return rowPerson;
  const persons = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  for (const [league, seasons] of Object.entries(persons)) {
    for (const [season, rows] of Object.entries(seasons)) {
      for (const [playerId, key] of Object.entries(rows)) {
        rowPerson.set(`${league}/${season}/${playerId}`, key);
      }
    }
  }
  return rowPerson;
}

/**
 * Attaches the athlete's transfer legs (club changes across seasons, dated via
 * Transfermarkt when available) to the player row. Identity follows person_key,
 * the same graph used for photos and cross-season history.
 */
export function withPlayerTransfers<T extends PlayerProfile>(
  league: string,
  season: string,
  player: T,
): T {
  const key = personIndex().get(`${league}/${season}/${player.player_id}`);
  const legs = key ? transfersFile()[key]?.legs : undefined;
  if (!legs?.length) return player;
  return { ...player, transfers: legs };
}

export function withPlayersTransfers<T extends PlayerProfile>(
  league: string,
  season: string,
  players: T[],
): T[] {
  return players.map((player) => withPlayerTransfers(league, season, player));
}
