#!/usr/bin/env python3
"""Rewrite past-season snapshots so each athlete shows the club of that season.

Wyscout "Equipa" is the club at export time; the season club lives in
"Equipa dentro de um período de tempo seleccionado". Snapshots built before
`prefer_period_club` used the export-time club, so this patches `club`/`label`
in data/<league>/seasons/<year>, the meta club lists and the `cross_season`
history attached to current-season players — without rebuilding ratings.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from build_cross_season_projection import norm_name  # noqa: E402
from build_historical_seasons import SNAPSHOTS  # noqa: E402
from engine.json_util import dumps_json  # noqa: E402
from engine.load_data import _read_wyscout_frame  # noqa: E402

ROOT = SCRIPTS_DIR.parent
DATA = ROOT / "data"
PERIOD_COL = "Equipa dentro de um período de tempo seleccionado"


def _text(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none"} else text


def _minutes(value) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def period_club_index(xlsx: Path) -> tuple[dict, dict]:
    df = _read_wyscout_frame(xlsx)
    if df is None or PERIOD_COL not in df.columns:
        return {}, {}
    exact: dict[tuple[str, str, int], str] = {}
    loose: dict[tuple[str, str], set[str]] = {}
    for _, row in df.iterrows():
        name = _text(row.get("Jogador"))
        export_club = _text(row.get("Equipe"))
        period = _text(row.get(PERIOD_COL))
        built_club = export_club or period
        if not name or not period:
            continue
        exact[(name, built_club, _minutes(row.get("Minutos jogados:", row.get("Minutos jogados"))))] = period
        loose.setdefault((name, built_club), set()).add(period)
    return exact, {key: next(iter(v)) for key, v in loose.items() if len(v) == 1}


def patch_player(player: dict, exact: dict, loose: dict) -> bool:
    name = player.get("name") or ""
    club = player.get("club") or ""
    period = exact.get((name, club, _minutes(player.get("minutes")))) or loose.get((name, club))
    if not period or period == club:
        return False
    player["club"] = period
    player["label"] = f"{name} ({period})"
    return True


def patch_snapshot(league: str, year: str, xlsx: Path) -> dict[str, str]:
    season_dir = DATA / league / "seasons" / year
    exact, loose = period_club_index(xlsx)
    clubs_by_key: dict[str, str] = {}
    changed = 0
    for path in sorted(season_dir.glob("*.json")):
        if path.name == "meta.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        file_changed = False
        for player in payload.get("players", []):
            if patch_player(player, exact, loose):
                file_changed = True
                if path.name == "players.json":
                    changed += 1
            if path.name.startswith("family-"):
                clubs_by_key[f"{norm_name(player.get('name', ''))}|{player.get('birth_year') or 0}"] = player["club"]
        if file_changed:
            path.write_text(dumps_json(payload), encoding="utf-8")

    meta_path = season_dir / "meta.json"
    players = json.loads((season_dir / "players.json").read_text(encoding="utf-8"))["players"]
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    clubs = sorted({p["club"] for p in players if p.get("club")})
    if meta.get("clubs") != clubs:
        meta["clubs"] = clubs
        meta_path.write_text(dumps_json(meta), encoding="utf-8")
    print(f"{league} {year}: {changed} atletas com clube da temporada corrigido")
    return clubs_by_key


def patch_cross_season(index: dict[tuple[str, str], dict[str, str]]) -> None:
    for path in sorted(DATA.rglob("family-*.json")):
        if "seasons" in path.parts:
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        changed = 0
        for player in payload.get("players", []):
            history = (player.get("cross_season") or {}).get("seasons") or []
            key = f"{norm_name(player.get('name', ''))}|{player.get('birth_year') or 0}"
            for row in history:
                club = index.get((row.get("league"), row.get("year")), {}).get(key)
                if club and row.get("club") != club:
                    row["club"] = club
                    changed += 1
        if changed:
            path.write_text(dumps_json(payload), encoding="utf-8")
            print(f"{path.relative_to(ROOT)}: {changed} linhas de histórico corrigidas")


def main() -> None:
    index: dict[tuple[str, str], dict[str, str]] = {}
    for league, year, xlsx in SNAPSHOTS:
        if not xlsx.is_file() or not (DATA / league / "seasons" / year).is_dir():
            print(f"skip {league} {year}")
            continue
        index[(league, year)] = patch_snapshot(league, year, xlsx)
    patch_cross_season(index)


if __name__ == "__main__":
    main()
