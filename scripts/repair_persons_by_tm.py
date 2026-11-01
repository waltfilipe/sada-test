#!/usr/bin/env python3
"""
Repair merged person identities using verified Transfermarkt ids.

people-conflicts.json (build_people.py) flags person_keys whose rows carry two
different tm_ids — two athletes merged into one identity. This script re-
partitions the rows by their verified tm_id: the largest group keeps the
original person_key, the other groups receive the next free name|birth|idx
keys, so photos, heatmaps, transfers and cross-season rows stop crossing.

Rows without a tm_id join the pinned group sharing their club, otherwise the
largest pinned group. Writes persons.json in place; rerun build_people.py and
build_transfer_history.py afterwards to refresh derived stores.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LEAGUES = ("serie-a", "serie-b", "serie-c", "serie-d")
PERSONS = DATA / "cross-season" / "persons.json"
CONFLICTS = DATA / "cross-season" / "people-conflicts.json"


def season_dirs(league_dir: Path) -> list[tuple[str, Path]]:
    meta_file = league_dir / "meta.json"
    current = "2026"
    if meta_file.exists():
        current = str(json.loads(meta_file.read_text(encoding="utf-8")).get("season") or current)
    out = [(current, league_dir)]
    seasons_root = league_dir / "seasons"
    if seasons_root.is_dir():
        out.extend((c.name, c) for c in sorted(seasons_root.iterdir()) if (c / "players.json").exists())
    return out


def load_row_index() -> dict[tuple[str, str, str], dict]:
    rows = {}
    for league in LEAGUES:
        for season, directory in season_dirs(DATA / league):
            try:
                payload = json.loads((directory / "players.json").read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            for p in payload.get("players", []):
                rows[(league, season, p["player_id"])] = p
    return rows


def main() -> int:
    conflicts = json.loads(CONFLICTS.read_text(encoding="utf-8"))
    targets = [c["person_key"] for c in conflicts if c["type"] == "tm_id_conflict"]
    if not targets:
        print("Nenhum conflito de tm_id.")
        return 0

    persons = json.loads(PERSONS.read_text(encoding="utf-8"))
    row_index = load_row_index()

    # person_key -> [(league, season, player_id)]
    person_rows: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for league, seasons in persons.items():
        for season, mapping in seasons.items():
            for pid, key in mapping.items():
                person_rows[key].append((league, season, pid))

    repaired = 0
    for person_key in targets:
        rows = person_rows.get(person_key) or []
        by_tm: dict[str | None, list[tuple[str, str, str]]] = defaultdict(list)
        for league, season, pid in rows:
            tm = (row_index.get((league, season, pid)) or {}).get("transfermarkt") or {}
            by_tm[str(tm["id"]) if tm.get("id") else None].append((league, season, pid))

        pinned = {tm_id: rws for tm_id, rws in by_tm.items() if tm_id}
        if len(pinned) < 2:
            continue  # conflict resolved itself meanwhile

        # unpinned rows join the pinned group sharing the row's club
        unpinned = by_tm.get(None) or []
        ordered = sorted(pinned.items(), key=lambda kv: -len(kv[1]))
        for league, season, pid in unpinned:
            club = (row_index.get((league, season, pid)) or {}).get("club") or ""
            hit = next(
                (
                    tm_id
                    for tm_id, rws in ordered
                    if any((row_index.get((l, s, p)) or {}).get("club") == club and club for l, s, p in rws)
                ),
                ordered[0][0],
            )
            pinned[hit].append((league, season, pid))

        m = re.match(r"^(name:.*\|\d+\|)(\d+)$", person_key)
        stem, base_idx = (m.group(1), int(m.group(2))) if m else (f"{person_key}|", 0)
        used = {int(k[len(stem):]) for k in person_rows if k.startswith(stem) and k[len(stem):].isdigit()}

        keep_tm = ordered[0][0]  # largest pinned group keeps the original key
        for tm_id, rws in ordered:
            if tm_id == keep_tm:
                continue
            idx = base_idx + 1
            while idx in used:
                idx += 1
            used.add(idx)
            new_key = f"{stem}{idx}"
            for league, season, pid in rws:
                persons[league][season][pid] = new_key
            print(f"  {person_key} → split {new_key}: tm {tm_id} ({len(rws)} linhas)")
        repaired += 1

    if repaired:
        PERSONS.write_text(json.dumps(persons, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Pessoas reparadas por tm_id: {repaired}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
