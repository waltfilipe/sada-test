#!/usr/bin/env python3
"""Rebuild Estaduais Nv1–Nv4 with percentiles fit inside each level.

Loads the Wyscout estaduais exports, keeps only clubs mapped to that level, and
runs the same family pipeline as build_site_data.build_league. This is not a
filter of the already-rated global estaduais JSON.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("SCOUT_TM_OFFLINE", "1")

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from build_site_data import build_league
from engine.estaduais_championship import LEVEL_IDS, classify_estadual_club
from engine.transfermarkt import seed_cache_from_profiles

# Old per-championship folders kept on disk. Used only to prove ratings moved.
_SPLIT_CHECKS = (
    ("est-nv1", "est-nv1-paulista"),
    ("est-nv2", "est-nv2-baiano"),
    ("est-nv3", "est-nv3-cearense"),
    ("est-nv4", "est-nv4-outros"),
)


def _assert_ratings_refit() -> None:
    """Fail if a level folder still matches the old global-pool split."""
    for level_id, split_id in _SPLIT_CHECKS:
        old_path = ROOT / "data" / split_id / "players.json"
        new_path = ROOT / "data" / level_id / "players.json"
        if not old_path.is_file() or not new_path.is_file():
            print(f"sanity {level_id}: pasta de comparação ausente, pulando")
            continue
        old_players = json.loads(old_path.read_text(encoding="utf-8")).get("players", [])
        new_players = json.loads(new_path.read_text(encoding="utf-8")).get("players", [])
        new_by = {(p.get("name"), p.get("club")): p for p in new_players}
        compared = 0
        same = 0
        for player in old_players:
            if player.get("position_family") != "zagueiros":
                continue
            fresh = new_by.get((player.get("name"), player.get("club")))
            if not fresh:
                continue
            compared += 1
            if abs(float(player.get("rating") or 0) - float(fresh.get("rating") or 0)) < 0.05:
                same += 1
        ratio = (same / compared) if compared else 1.0
        print(f"sanity {level_id} zagueiros vs {split_id}: {same}/{compared} notas iguais ({ratio:.0%})")
        if compared >= 25 and ratio > 0.9:
            raise SystemExit(
                f"{level_id} ainda parece um recorte do pool global ({split_id}). "
                "As notas precisam ser recalculadas dentro do nível."
            )


def _print_championship_mix() -> None:
    for level_id in LEVEL_IDS:
        path = ROOT / "data" / level_id / "players.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        mix: dict[str, int] = {}
        for player in payload.get("players", []):
            champ = classify_estadual_club(str(player.get("club") or ""))
            mix[champ] = mix.get(champ, 0) + 1
        bits = ", ".join(f"{key.split('-')[-1]}={count}" for key, count in sorted(mix.items()))
        print(f"  {level_id}: {payload.get('total')} atletas · {bits}")


def main() -> None:
    seeded = seed_cache_from_profiles(ROOT / "data")
    if seeded:
        print(f"Transfermarkt cache seeded from profiles: {seeded}")
    for league_id in LEVEL_IDS:
        build_league(league_id)
    print("\n=== Composição dos níveis ===")
    _print_championship_mix()
    _assert_ratings_refit()
    for league_id in LEVEL_IDS:
        meta = ROOT / "data" / league_id / "meta.json"
        players = ROOT / "data" / league_id / "players.json"
        if not meta.is_file() or not players.is_file():
            raise SystemExit(f"Saída incompleta em data/{league_id}")


if __name__ == "__main__":
    main()
