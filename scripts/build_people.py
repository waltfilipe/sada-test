#!/usr/bin/env python3
"""
Build the canonical athlete-identity layer: data/cross-season/people.json

One record per person_key — the person is the identity, the name is just an
attribute. Photos, Transfermarkt ids, SofaScore ids and club history attach
here so auxiliary data resolves by id, never by bare name (homonym-safe).

Sources:
  - persons.json   : person_key → every (league, season, player_id) row
  - players.json   : name, birth_year, club, transfermarkt {id, photo}
  - transfers.json : stint history already consolidated per person
  - data/heatmaps  : SofaScore player id captured per row+season

Output record per person_key:
  {name, birth_year, tm_id, photo, tm_club, profile_url, clubs,
   sofascore: {"league/season": id}, rows: [{league, season, player_id, club}]}

Conflicts (same person_key carrying >1 tm_id, or >1 SofaScore id inside one
season) are dumped to people-conflicts.json for review — they flag identity
graph errors, not bad luck.
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from engine.transfermarkt import _club_match_score  # noqa: E402

DATA = ROOT / "data"
LEAGUES = ("serie-a", "serie-b", "serie-c", "serie-d")
OUT = DATA / "cross-season" / "people.json"
CONFLICTS = DATA / "cross-season" / "people-conflicts.json"


def season_dirs(league_dir: Path) -> list[tuple[str, Path]]:
    meta_file = league_dir / "meta.json"
    current = "2026"
    if meta_file.exists():
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        current = str(meta.get("season") or current)
    out = [(current, league_dir)]
    seasons_root = league_dir / "seasons"
    if seasons_root.is_dir():
        for child in sorted(seasons_root.iterdir()):
            if (child / "players.json").exists():
                out.append((child.name, child))
    return out


def load_all_rows() -> dict[tuple[str, str, str], dict]:
    """(league, season, player_id) → player row."""
    rows: dict[tuple[str, str, str], dict] = {}
    for league in LEAGUES:
        for season, directory in season_dirs(DATA / league):
            try:
                payload = json.loads((directory / "players.json").read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            for player in payload.get("players", []):
                rows[(league, season, player["player_id"])] = player
    return rows


def load_sofascore_ids() -> tuple[dict[str, dict], dict[str, dict]]:
    """player_id → {id, name, team} from heatmap payloads, plus a
    season-scoped variant "league/season/player_id" from
    data/heatmaps/seasons/{league}-{season}/."""
    by_pid: dict[str, dict] = {}
    by_row: dict[str, dict] = {}
    for path in (DATA / "heatmaps").glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        ss_id = payload.get("sofascore_player_id")
        if ss_id:
            by_pid[path.stem] = {
                "id": str(ss_id),
                "name": payload.get("sofascore_name"),
                "team": payload.get("sofascore_team"),
            }
    seasons_root = DATA / "heatmaps" / "seasons"
    if seasons_root.is_dir():
        for league_dir in seasons_root.iterdir():
            if not league_dir.is_dir() or "-" not in league_dir.name:
                continue
            league, season = league_dir.name.rsplit("-", 1)
            for path in league_dir.glob("*.json"):
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                ss_id = payload.get("sofascore_player_id")
                if ss_id:
                    by_row[f"{league}/{season}/{path.stem}"] = {
                        "id": str(ss_id),
                        "name": payload.get("sofascore_name"),
                        "team": payload.get("sofascore_team"),
                    }
    return by_pid, by_row


def main() -> int:
    persons = json.loads((DATA / "cross-season" / "persons.json").read_text(encoding="utf-8"))
    transfers_path = DATA / "cross-season" / "transfers.json"
    transfers = json.loads(transfers_path.read_text(encoding="utf-8")) if transfers_path.exists() else {}
    all_rows = load_all_rows()
    ss_by_pid, ss_by_row = load_sofascore_ids()
    overrides_path = DATA / "cross-season" / "identity-overrides.json"
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    tm_unanchor: dict = overrides.get("tm_unanchor") or {}

    people: dict[str, dict] = {}
    conflicts: list[dict] = []

    for league, seasons in persons.items():
        for season, mapping in seasons.items():
            for player_id, person_key in mapping.items():
                row = all_rows.get((league, season, player_id))
                if row is None:
                    continue
                rec = people.setdefault(
                    person_key,
                    {
                        "name": row.get("name"),
                        "birth_year": row.get("birth_year"),
                        "tm_id": None,
                        "photo": None,
                        "tm_club": None,
                        "profile_url": None,
                        "clubs": [],
                        "sofascore": {},
                        "rows": [],
                    },
                )
                rec["rows"].append(
                    {
                        "league": league,
                        "season": season,
                        "player_id": player_id,
                        "club": row.get("club"),
                    }
                )
                if row.get("club") and row["club"] not in rec["clubs"]:
                    rec["clubs"].append(row["club"])
                tm = row.get("transfermarkt") or {}
                tm_id = str(tm.get("id")) if tm.get("id") else None
                if tm_id and tm_id != tm_unanchor.get(person_key):
                    rec.setdefault("_tm_ids", []).append((tm_id, season, tm))
                ss = ss_by_row.get(f"{league}/{season}/{player_id}") or ss_by_pid.get(player_id)
                if ss:
                    rec["sofascore"][f"{league}/{season}"] = ss["id"]
                    if ss.get("team"):
                        rec.setdefault("_ss_teams", []).append((season, league, player_id, ss["team"]))

    for person_key, rec in people.items():
        tm_ids = rec.pop("_tm_ids", [])
        distinct = {tm_id for tm_id, _, _ in tm_ids}
        if len(distinct) == 1:
            # most recent season's record wins the canonical slot
            tm_id, _, tm = sorted(tm_ids, key=lambda t: -int(t[1]))[0]
            rec["tm_id"] = tm_id
            rec["photo"] = tm.get("photo")
            rec["tm_club"] = tm.get("club")
            rec["profile_url"] = tm.get("profile_url")
        elif len(distinct) > 1:
            per_id = Counter(tm_id for tm_id, _, _ in tm_ids)
            winner, _ = per_id.most_common(1)[0]
            chosen = next((tm for tm_id, _, tm in tm_ids if tm_id == winner), None)
            rec["tm_id"] = winner
            rec["photo"] = (chosen or {}).get("photo")
            rec["tm_club"] = (chosen or {}).get("club")
            rec["profile_url"] = (chosen or {}).get("profile_url")
            conflicts.append(
                {
                    "person_key": person_key,
                    "type": "tm_id_conflict",
                    "tm_ids": sorted(per_id.items(), key=lambda kv: -kv[1]),
                    "rows": rec["rows"],
                }
            )

        ss_seasons: dict[str, set] = defaultdict(set)
        for slot, ss_id in rec["sofascore"].items():
            ss_seasons[slot.split("/")[1]].add(ss_id)
        for season, ids in ss_seasons.items():
            if len(ids) > 1:
                conflicts.append(
                    {
                        "person_key": person_key,
                        "type": "sofascore_conflict",
                        "season": season,
                        "ss_ids": sorted(ids),
                        "rows": rec["rows"],
                    }
                )

        # stitch stint clubs (transfers.json) into the club list
        for stint in (transfers.get(person_key) or {}).get("stints", []):
            if stint.get("club") and stint["club"] not in rec["clubs"]:
                rec["clubs"].append(stint["club"])

        # heatmap guard: the SofaScore team behind each map must belong to the
        # athlete's own club history — a foreign team means the map was matched
        # to a same-name player.
        for season, league, player_id, team in rec.pop("_ss_teams", []):
            if all(_club_match_score(team, club) < 40 for club in rec["clubs"]):
                conflicts.append(
                    {
                        "person_key": person_key,
                        "type": "heatmap_team_mismatch",
                        "season": season,
                        "player_id": player_id,
                        "sofascore_team": team,
                        "person_clubs": rec["clubs"],
                    }
                )

        rec["rows"].sort(key=lambda r: (r["season"], r["league"]))
        rec["clubs"].sort()

    OUT.write_text(json.dumps(people, ensure_ascii=False, indent=1), encoding="utf-8")
    CONFLICTS.write_text(json.dumps(conflicts, ensure_ascii=False, indent=1), encoding="utf-8")
    with_tm = sum(1 for r in people.values() if r["tm_id"])
    print(f"people.json: {len(people)} pessoas | com tm_id: {with_tm} | conflitos: {len(conflicts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
