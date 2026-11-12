#!/usr/bin/env python3
"""Inject fouls/cards discipline data (Wyscout xlsx) into generated league JSONs.

Adds a `discipline` block to each player in family-*.json, profiles/*.json and
players.json for every league/season snapshot, keyed by identity (name+club),
never by name alone.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
WY26 = ROOT / "wyscout" / "2026"
HIST = ROOT / "wyscout" / "historical"

COL_FOULS = "Faltas/90"
COL_YC = "Cartões amarelos"
COL_YC90 = "Cartões amarelos/90"
COL_RC = "Cartões vermelhos"
COL_RC90 = "Cartões vermelhos/90"
CLUB_COLS = ("Equipa dentro de um período de tempo seleccionado", "Equipe", "Equipa")
MIN_COLS = ("Minutos jogados", "Minutos jogados:")


def norm(value: str) -> str:
    value = unicodedata.normalize("NFD", str(value))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def as_num(value) -> float | None:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if f == f else None


def read_sources(paths: list[Path]) -> dict[str, dict]:
    """Return index keyed by 'name::club' -> metrics row."""
    frames = []
    for path in paths:
        if path.is_file():
            frames.append(pd.read_excel(path))
    index: dict[str, dict] = {}
    for df in frames:
        for rec in df.to_dict(orient="records"):
            name = norm(rec.get("Jogador", ""))
            clubs = {norm(v) for col in CLUB_COLS if isinstance((v := rec.get(col)), str) and v.strip()}
            if not name or not clubs:
                continue
            fouls90 = as_num(rec.get(COL_FOULS))
            minutes = 0.0
            for col in MIN_COLS:
                v = as_num(rec.get(col))
                if v:
                    minutes = v
                    break
            row = {
                "fouls_per90": round(fouls90, 2) if fouls90 is not None else None,
                "fouls_total": int(round(fouls90 * minutes / 90)) if fouls90 is not None and minutes else None,
                "yellow_per90": round(as_num(rec.get(COL_YC90)) or 0.0, 2),
                "yellow_total": int(as_num(rec.get(COL_YC)) or 0),
                "red_per90": round(as_num(rec.get(COL_RC90)) or 0.0, 2),
                "red_total": int(as_num(rec.get(COL_RC)) or 0),
            }
            for club in clubs:
                index[f"{name}::{club}"] = row
    return index


def source_for(league: str, season: str) -> list[Path]:
    if league.startswith("est-"):
        slug = league[4:]
        if season == "2026":
            return [WY26 / "estaduais" / f"{slug}.xlsx"]
        return [HIST / "estaduais" / f"{slug}-{season}.xlsx"]
    if season == "2026":
        return [WY26 / f"{league}-pt1.xlsx", WY26 / f"{league}-pt2.xlsx"]
    return [HIST / f"{league}-{season}.xlsx"]


def inject_players(players: list[dict], index: dict[str, dict]) -> int:
    matched = 0
    for p in players:
        key = f"{norm(p.get('name', ''))}::{norm(p.get('club', ''))}"
        disc = index.get(key)
        if disc and disc["fouls_per90"] is not None:
            p["discipline"] = disc
            matched += 1
        else:
            p.pop("discipline", None)
    return matched


def pool_means(players: list[dict]) -> dict:
    rows = [p["discipline"] for p in players if p.get("discipline")]
    if not rows:
        return {}
    return {
        key: round(sum(r[key] for r in rows) / len(rows), 2)
        for key in ("fouls_per90", "yellow_per90", "red_per90")
    }


def apply_dir(season_dir: Path, index: dict[str, dict]) -> int:
    total = 0
    fam_pools: dict[str, dict] = {}
    for fam_path in season_dir.glob("family-*.json"):
        doc = json.loads(fam_path.read_text(encoding="utf-8"))
        players = doc.get("players", [])
        matched = inject_players(players, index)
        fam_pools[fam_path.stem] = pool_means(players)
        for p in players:
            if p.get("discipline"):
                p["discipline"]["pool"] = fam_pools[fam_path.stem]
        fam_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total += matched

    prof_dir = season_dir / "profiles"
    if prof_dir.is_dir():
        for prof_path in prof_dir.glob("*.json"):
            prof = json.loads(prof_path.read_text(encoding="utf-8"))
            key = f"{norm(prof.get('name', ''))}::{norm(prof.get('club', ''))}"
            disc = index.get(key)
            if disc and disc["fouls_per90"] is not None:
                prof["discipline"] = dict(disc)
            else:
                prof.pop("discipline", None)
            prof_path.write_text(json.dumps(prof, ensure_ascii=False, indent=2), encoding="utf-8")

    players_path = season_dir / "players.json"
    if players_path.is_file():
        doc = json.loads(players_path.read_text(encoding="utf-8"))
        rows = doc.get("players", doc if isinstance(doc, list) else [])
        inject_players(rows, index)
        players_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return total


def main() -> None:
    for league_dir in sorted(DATA.iterdir()):
        if not league_dir.is_dir() or not (league_dir / "meta.json").is_file():
            continue
        league = league_dir.name
        season_dirs = [league_dir]
        seasons_root = league_dir / "seasons"
        if seasons_root.is_dir():
            season_dirs += [d for d in sorted(seasons_root.iterdir()) if d.is_dir()]
        for season_dir in season_dirs:
            season = season_dir.name if season_dir != league_dir else json.loads(
                (league_dir / "meta.json").read_text(encoding="utf-8")
            ).get("season", "2026")
            src = source_for(league, season)
            if not any(p.is_file() for p in src):
                continue
            index = read_sources(src)
            matched = apply_dir(season_dir, index)
            print(f"{league}/{season}: {matched} jogadores com disciplina (fonte: {len(index)} linhas)")


if __name__ == "__main__":
    main()
