#!/usr/bin/env python3
"""Stampa o campeonato estadual (Campeonato do Wyscout) em players.json,
family-*.json e profiles/ das ligas est-nv1..4 + hub 'estaduais'.

O campo `competition` rotula a competição real do atleta ("Paulista A2",
"Catarinense"), enquanto o pool de percentis continua sendo o nível
("Estaduais Nv2"). Rode após rebuilds de dados dos níveis.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from engine.estaduais_championship import LEVEL_IDS
from engine.load_data import load_players_dataframe

CHAMP_LABEL: dict[str, str] = {
    "paulista-a1": "Paulista",
    "paulista-a2": "Paulista A2",
    "paulista-a3": "Paulista A3",
    "paulista-a4": "Paulista A4",
    "gaucho": "Gaúcho",
    "mineiro": "Mineiro",
    "carioca": "Carioca",
    "paranaense": "Paranaense",
    "catarinense": "Catarinense",
    "baiano": "Baiano",
    "cearense": "Cearense",
    "pernambucano": "Pernambucano",
    "goiano": "Goiano",
    "paraense": "Paraense",
    "alagoano": "Alagoano",
    "potiguar": "Potiguar",
    "copa-paulista": "Copa Paulista",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def apply_league(league_id: str) -> tuple[int, int]:
    data_dir = ROOT / "data" / league_id
    if not data_dir.is_dir():
        log(f"{league_id}: pasta ausente, pulando")
        return 0, 0

    df = load_players_dataframe(league_id)
    if "Campeonato" not in df.columns or "player_id" not in df.columns:
        log(f"{league_id}: sem coluna Campeonato/player_id, pulando")
        return 0, 0

    comp_by_id: dict[str, str] = {}
    for _, row in df.iterrows():
        slug = str(row.get("Campeonato") or "").strip()
        if slug:
            comp_by_id[str(row["player_id"])] = CHAMP_LABEL.get(slug, slug)

    stamped = 0

    def stamp(row: dict) -> None:
        nonlocal stamped
        comp = comp_by_id.get(row.get("player_id") or "")
        if comp and row.get("competition") != comp:
            row["competition"] = comp
            stamped += 1

    players_path = data_dir / "players.json"
    payload = json.loads(players_path.read_text(encoding="utf-8"))
    for row in payload.get("players", []):
        stamp(row)
    players_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    for family_path in data_dir.glob("family-*.json"):
        family = json.loads(family_path.read_text(encoding="utf-8"))
        touched = False
        for row in family.get("players", []):
            comp = comp_by_id.get(row.get("player_id") or "")
            if comp and row.get("competition") != comp:
                row["competition"] = comp
                touched = True
                stamped += 1
        if touched:
            family_path.write_text(json.dumps(family, ensure_ascii=False, indent=2), encoding="utf-8")

    for profile_path in (data_dir / "profiles").glob("*.json"):
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        comp = comp_by_id.get(profile.get("player_id") or "")
        if comp and profile.get("competition") != comp:
            profile["competition"] = comp
            profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
            stamped += 1

    log(f"{league_id}: {len(comp_by_id)} ids mapeados, {stamped} registros carimbados")
    return len(comp_by_id), stamped


def main() -> None:
    for league_id in ("estaduais", *LEVEL_IDS):
        apply_league(league_id)


if __name__ == "__main__":
    main()
