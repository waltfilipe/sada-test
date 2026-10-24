#!/usr/bin/env python3
"""Copy Transfermarkt/SofaScore headshots from 2026 + cache into past season JSON snapshots."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BR = ("serie-a", "serie-b", "serie-c")
SEASONS = ("2022", "2023", "2024", "2025")


def norm_name(name: str) -> str:
    value = unicodedata.normalize("NFD", name)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def norm_club(club: str) -> str:
    return norm_name(club)


def athlete_key(name: str, birth: int | None) -> str:
    return f"{norm_name(name)}|{birth or 0}"


def load_index() -> tuple[dict[str, dict], dict[str, dict], dict[str, dict], dict[str, dict]]:
    by_athlete: dict[str, dict] = {}
    by_tm: dict[str, dict] = {}
    by_nc: dict[str, dict] = {}
    by_name: dict[str, dict] = {}

    def remember(tm: dict, name: str, club: str, birth: int | None) -> None:
        if not tm or not tm.get("photo"):
            return
        ak = athlete_key(name, birth)
        by_athlete.setdefault(ak, tm)
        tid = tm.get("id")
        if tid:
            by_tm.setdefault(str(tid), tm)
        if club:
            by_nc.setdefault(f"{norm_name(name)}::{norm_club(club)}", tm)
        by_name.setdefault(norm_name(name), tm)

    for league in BR:
        base = DATA / league
        for path in base.glob("family-*.json"):
            for p in json.loads(path.read_text(encoding="utf-8")).get("players", []):
                tm = p.get("transfermarkt")
                if tm:
                    remember(tm, p.get("name", ""), p.get("club", ""), p.get("birth_year"))

    cache_path = DATA / "transfermarkt-cache.json"
    if cache_path.is_file():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
        for key, tm in cache.items():
            if not tm or not tm.get("photo"):
                continue
            if "::" in key:
                name, club = key.split("::", 1)
                remember(tm, name, club, None)

    manifest = ROOT / "photos" / "photos" / "manifest.json"
    if manifest.is_file():
        for row in json.loads(manifest.read_text(encoding="utf-8")).values():
            if not row.get("file") or not row.get("name"):
                continue
            tm = {
                "id": None,
                "photo": f"/photos/{row['file']}",
                "market_value": None,
                "market_value_eur": None,
                "contract_until": None,
                "contract_remaining": None,
                "club": None,
                "profile_url": None,
            }
            remember(tm, row["name"], "", None)

    return by_athlete, by_tm, by_nc, by_name


def lookup(player: dict, idx: tuple[dict, dict, dict, dict]) -> dict | None:
    by_athlete, by_tm, by_nc, by_name = idx
    tm = player.get("transfermarkt") or {}
    if tm.get("photo"):
        return tm
    ak = athlete_key(player.get("name", ""), player.get("birth_year"))
    if ak in by_athlete:
        return by_athlete[ak]
    tid = tm.get("id")
    if tid and str(tid) in by_tm:
        return by_tm[str(tid)]
    nc = f"{norm_name(player.get('name', ''))}::{norm_club(player.get('club', ''))}"
    if nc in by_nc:
        return by_nc[nc]
    n = norm_name(player.get("name", ""))
    return by_name.get(n)


def main() -> None:
    idx = load_index()
    patched = 0
    for league in BR:
        for year in SEASONS:
            base = DATA / league / "seasons" / year
            if not base.is_dir():
                continue
            for path in base.glob("family-*.json"):
                payload = json.loads(path.read_text(encoding="utf-8"))
                changed = False
                for player in payload.get("players", []):
                    if (player.get("transfermarkt") or {}).get("photo"):
                        continue
                    hit = lookup(player, idx)
                    if not hit:
                        continue
                    player["transfermarkt"] = {**(player.get("transfermarkt") or {}), **hit}
                    patched += 1
                    changed = True
                if changed:
                    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            players_path = base / "players.json"
            if players_path.is_file():
                payload = json.loads(players_path.read_text(encoding="utf-8"))
                changed = False
                for player in payload.get("players", []):
                    if (player.get("transfermarkt") or {}).get("photo"):
                        continue
                    hit = lookup(player, idx)
                    if not hit:
                        continue
                    player["transfermarkt"] = {**(player.get("transfermarkt") or {}), **hit}
                    changed = True
                if changed:
                    players_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Patched {patched} player rows with existing photos")


if __name__ == "__main__":
    main()
