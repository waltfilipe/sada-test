#!/usr/bin/env python3
"""Anexa `pass_distance_m` (Comprimento medio de passes, m do Wyscout) aos JSONs.

Escreve o campo nos perfis atuais (profiles/*.json + family-*.json) e nos
snapshots de temporadas (seasons/<ano>/family-*.json). O casamento e por
(nome, clube) normalizado — a mesma chave que o pipeline usa para reaproveitar
ids — entao nao depende da estabilidade de player_id entre builds.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.leagues import LEAGUES  # noqa: E402
from engine.load_data import load_players_dataframe  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
HIST = ROOT / "wyscout" / "historical"
COL = "Comprimento médio de passes, m"
COL_ASCII = "Comprimento m�dio de passes, m"  # header lido em cp1252 em alguns exports

SNAPSHOTS: list[tuple[str, str, Path]] = [
    ("serie-a", year, HIST / f"serie-a-{year}.xlsx") for year in ("2022", "2023", "2024", "2025")
] + [
    ("serie-b", year, HIST / f"serie-b-{year}.xlsx") for year in ("2022", "2023", "2024", "2025")
] + [
    ("serie-c", year, HIST / f"serie-c-{year}.xlsx") for year in ("2022", "2023", "2024", "2025")
]


def norm(value: object) -> str:
    return str(value or "").strip().casefold()


def pass_distance_map(df: pd.DataFrame) -> dict[tuple[str, str], float]:
    col = next((c for c in df.columns if "omprimento" in str(c) and "longos" not in str(c)), None)
    if col is None:
        return {}
    out: dict[tuple[str, str], float] = {}
    for _, row in df.iterrows():
        value = pd.to_numeric(row.get(col), errors="coerce")
        if pd.isna(value):
            continue
        out.setdefault((norm(row.get("Jogador")), norm(row.get("Equipe"))), round(float(value), 2))
    return out


def patch_json(path: Path, mapping: dict[tuple[str, str], float]) -> tuple[int, int]:
    """Escreve pass_distance_m nos objetos de jogador dentro do JSON. Retorna (escritos, presentes)."""
    if not path.is_file():
        return 0, 0
    blob = json.loads(path.read_text(encoding="utf-8"))
    players = blob.get("players") if isinstance(blob, dict) else blob
    if not isinstance(players, list):
        return 0, 0
    written = present = 0
    for player in players:
        if not isinstance(player, dict):
            continue
        value = mapping.get((norm(player.get("name")), norm(player.get("club"))))
        if value is None:
            if "pass_distance_m" in player:
                player.pop("pass_distance_m")
            continue
        present += 1
        if player.get("pass_distance_m") != value:
            player["pass_distance_m"] = value
            written += 1
    if written:
        path.write_text(json.dumps(blob, ensure_ascii=False), encoding="utf-8")
    return written, present


def patch_league_dir(league_dir: Path, mapping: dict[tuple[str, str], float]) -> tuple[int, int]:
    written = present = 0
    profiles = league_dir / "profiles"
    if profiles.is_dir():
        # Perfis individuais: match por nome+clube gravados no proprio perfil.
        for profile_path in profiles.glob("*.json"):
            player = json.loads(profile_path.read_text(encoding="utf-8"))
            value = mapping.get((norm(player.get("name")), norm(player.get("club"))))
            if value is None:
                if "pass_distance_m" in player:
                    player.pop("pass_distance_m")
                    profile_path.write_text(json.dumps(player, ensure_ascii=False), encoding="utf-8")
                    written += 1
                continue
            present += 1
            if player.get("pass_distance_m") != value:
                player["pass_distance_m"] = value
                profile_path.write_text(json.dumps(player, ensure_ascii=False), encoding="utf-8")
                written += 1
    for family_path in league_dir.glob("family-*.json"):
        w, p = patch_json(family_path, mapping)
        written += w
        present += p
    return written, present


def main() -> None:
    for league_id in LEAGUES:
        league_dir = DATA_DIR / league_id
        if not league_dir.is_dir():
            continue
        try:
            df = load_players_dataframe(league_id)
        except Exception as exc:  # noqa: BLE001
            print(f"{league_id}: falha ao ler xlsx ({exc})")
            continue
        mapping = pass_distance_map(df)
        written, present = patch_league_dir(league_dir, mapping)
        print(f"{league_id}: {present} com distancia ({written} gravados)")

    for league_id, year, xlsx in SNAPSHOTS:
        season_dir = DATA_DIR / league_id / "seasons" / year
        if not xlsx.is_file() or not season_dir.is_dir():
            continue
        try:
            df = load_players_dataframe(league_id, xlsx_override=[xlsx])
        except Exception as exc:  # noqa: BLE001
            print(f"{league_id}/{year}: falha ao ler xlsx ({exc})")
            continue
        mapping = pass_distance_map(df)
        written, present = patch_league_dir(season_dir, mapping)
        print(f"{league_id}/{year}: {present} com distancia ({written} gravados)")

    from build_estadual_historical_seasons import estadual_season_snapshots

    for league_id, year, xlsx_files in estadual_season_snapshots():
        season_dir = DATA_DIR / league_id / "seasons" / year
        if not season_dir.is_dir():
            continue
        try:
            df = load_players_dataframe(league_id, xlsx_override=xlsx_files)
        except Exception as exc:  # noqa: BLE001
            print(f"{league_id}/{year}: falha ao ler xlsx ({exc})")
            continue
        mapping = pass_distance_map(df)
        written, present = patch_league_dir(season_dir, mapping)
        print(f"{league_id}/{year}: {present} com distancia ({written} gravados)")


if __name__ == "__main__":
    main()
