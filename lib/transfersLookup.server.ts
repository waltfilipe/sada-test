import "server-only";

import fs from "fs";
import path from "path";
import type { PlayerDeparture, PlayerProfile, TransferLeg } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

type TransferEntry = {
  current_club: string;
  last?: { club: string; season: string; league: string } | null;
  joined?: string | null;
  legs: TransferLeg[];
};

type TransfersFile = Record<string, TransferEntry>;

let transfers: TransfersFile | undefined;
let rowPerson: Map<string, string> | undefined;

function transfersFile(): TransfersFile {
  if (transfers === undefined) {
    const file = path.join(DATA_DIR, "cross-season", "transfers.json");
    transfers = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as TransfersFile) : {};
  }
  return transfers;
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

function normClub(club?: string | null): string {
  return (club ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CLUB_STOP = new Set(["de", "da", "do", "e", "fc", "sc", "ec", "ac", "ca", "se", "sp", "clube", "futebol"]);

function sameClub(a?: string | null, b?: string | null): boolean {
  const na = normClub(a);
  const nb = normClub(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set([...na.split(" ")].filter((t) => !CLUB_STOP.has(t)));
  const tb = new Set([...nb.split(" ")].filter((t) => !CLUB_STOP.has(t)));
  return [...ta].some((t) => tb.has(t));
}

/**
 * Resolves whether the viewed row is the athlete's last stint at that club —
 * he left the competition (transfer during/after the season, possibly abroad).
 * Returns the departure to show on the ficha, or null when he is still there.
 */
export function playerDeparture(
  league: string,
  season: string,
  player: Pick<PlayerProfile, "player_id" | "club">,
): PlayerDeparture | null {
  const key = personIndex().get(`${league}/${season}/${player.player_id}`);
  const entry = key ? transfersFile()[key] : undefined;
  if (!entry) return null;
  const leg = entry.legs.find(
    (l) => l.from_season === season && sameClub(l.from_club, player.club),
  );
  if (leg) {
    return {
      to_club: leg.to_club,
      to_league: leg.to_league ?? null,
      to_season: leg.to_season ?? null,
      date: leg.date ?? null,
      fee: leg.fee ?? null,
      kind: leg.kind ?? "permanent",
    };
  }
  const last = entry.last;
  if (
    last &&
    last.season === season &&
    sameClub(last.club, player.club) &&
    entry.current_club &&
    !sameClub(entry.current_club, player.club)
  ) {
    return {
      to_club: entry.current_club,
      to_league: null,
      date: entry.joined ?? null,
      fee: null,
      kind: "permanent",
    };
  }
  return null;
}

export function withPlayerDeparture<T extends PlayerProfile>(
  league: string,
  season: string,
  player: T,
): T {
  const departure = playerDeparture(league, season, player);
  if (!departure) return player;
  return { ...player, departure };
}

export function withPlayersDepartures<T extends PlayerProfile>(
  league: string,
  season: string,
  players: T[],
): T[] {
  return players.map((player) => withPlayerDeparture(league, season, player));
}
