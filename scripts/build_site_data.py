#!/usr/bin/env python3
"""Build static JSON data for the Serie A scouting site."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from engine.load_data import load_players_dataframe
from engine.measures import attach_base_measures
from engine.positions import (
    POSITION_FAMILIES,
    SCATTER_METRICS,
    build_player_payload,
    compute_family_metrics,
)
from engine.transfermarkt import enrich_players_with_transfermarkt

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PROFILES_DIR = DATA_DIR / "profiles"
REFERENCE_DIR = ROOT / "reference"


def main() -> None:
    print("Loading player data…")
    raw_df = load_players_dataframe()
    source = raw_df.attrs.get("source", "unknown")
    print(f"Source: {source} ({len(raw_df)} players)")

    df = attach_base_measures(raw_df)
    df = df[df["Posição"] != "Goleiro"].copy()

    all_players: list[dict] = []
    family_payloads: dict[str, list[dict]] = {}
    clubs = sorted({str(c) for c in df["Equipe"].dropna().unique()})
    nationalities = sorted({str(n) for n in df["Naturalidade"].dropna().unique()})

    for family_key, family in POSITION_FAMILIES.items():
        computed = compute_family_metrics(df, family_key)
        pool_size = len(computed)
        players = [build_player_payload(row, family_key, pool_size) for _, row in computed.iterrows()]
        family_payloads[family_key] = players
        all_players.extend(players)
        print(f"  {family['label']}: {pool_size} jogadores")

    print("Enriquecendo com Transfermarkt (foto, valor e contrato)…")
    all_players = enrich_players_with_transfermarkt(all_players)
    family_payloads = {}
    for family_key in POSITION_FAMILIES:
        family_payloads[family_key] = [player for player in all_players if player["position_family"] == family_key]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)

    for stale in PROFILES_DIR.glob("*.json"):
        stale.unlink()

    players_index = []
    for player in all_players:
        players_index.append(
            {
                "player_id": player["player_id"],
                "name": player["name"],
                "club": player["club"],
                "label": player["label"],
                "position": player["position"],
                "position_family": player["position_family"],
                "nationality": player["nationality"],
                "birth_year": player["birth_year"],
                "height": player["height"],
                "foot": player["foot"],
                "minutes": player["minutes"],
                "rating": player["rating"],
                "profile": player["profile"],
                "hybrid_lean": player.get("hybrid_lean"),
                "transfermarkt": player.get("transfermarkt"),
            }
        )
        profile_path = PROFILES_DIR / f"{player['player_id']}.json"
        profile_path.write_text(json.dumps(player, ensure_ascii=False, indent=2), encoding="utf-8")

    # Players with a missing height are stored as 0, which would pin the
    # published lower bound at zero and make the height filter useless.
    valid_heights = df["Altura"][df["Altura"] > 0]

    meta = {
        "league": "Série A",
        "season": "2025/26",
        "source": source,
        "player_count": len(all_players),
        "families": [
            {
                "key": key,
                "label": POSITION_FAMILIES[key]["label"],
                "positions": POSITION_FAMILIES[key]["positions"],
                "profiles": POSITION_FAMILIES[key]["profiles"],
                "count": len(family_payloads.get(key, [])),
            }
            for key in POSITION_FAMILIES
        ],
        "clubs": clubs,
        "nationalities": nationalities,
        "filters": {
            "height": [int(valid_heights.min()), int(valid_heights.max())],
            "minutes": [0, int(df["Minutos jogados:"].max())],
            "birth_year": [int(df["Nascimento"].min()), int(df["Nascimento"].max())],
            "rating": [round(float(min(p["rating"] for p in all_players)), 1), round(float(max(p["rating"] for p in all_players)), 1)],
        },
        "scatter_metrics": SCATTER_METRICS,
    }

    (DATA_DIR / "players.json").write_text(
        json.dumps({"players": players_index, "total": len(players_index)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (DATA_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    for family_key, players in family_payloads.items():
        (DATA_DIR / f"family-{family_key}.json").write_text(
            json.dumps({"family": family_key, "players": players}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    dax_src = Path("/tmp/all_dax.json")
    if dax_src.exists():
        shutil.copy(dax_src, REFERENCE_DIR / "dax-measures.json")

    print(f"Wrote {len(all_players)} player profiles to {DATA_DIR}")


if __name__ == "__main__":
    main()
