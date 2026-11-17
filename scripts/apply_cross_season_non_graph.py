#!/usr/bin/env python3
"""Propagate cross_season projections to leagues outside the person graph.

build_cross_season_projection.py enriches only the registry leagues
(serie-a/b/c). Rows in non-graph leagues (est-*, serie-d, mls-next-pro)
carry a verified athlete_id, so their ``cross_season`` block — season
history + per-metric ridge predictions — can be copied from the
athlete's current national row with no name matching.

The projection UI (lib/minuteProjection.ts) reads
``player.cross_season.metrics[sampleKey]`` as the ridge prior; without it
non-graph players fall back to the pool-only prior even when they have
real history (e.g. an athlete who played Série C + Goiano in the same
year). Predictions keep the national row's tier context — a valid prior
for the athlete's true level.

Rows whose athlete lost the national row get stale blocks removed —
mirrors apply_athlete_ids.py. Run after build_cross_season_projection.py
and apply_athlete_ids.py. Idempotent.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.json_util import dumps_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
GRAPH_LEAGUES = ("serie-a", "serie-b", "serie-c")


def log(*args) -> None:
    print(*(str(a).encode("ascii", "replace").decode("ascii") for a in args))


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def national_cross_season() -> dict[str, dict]:
    """athlete_id -> cross_season block from the current national row."""
    blocks: dict[str, dict] = {}
    for league in GRAPH_LEAGUES:
        for path in sorted((DATA / league).glob("family-*.json")):
            payload = load_json(path, {})
            for player in payload.get("players", []):
                aid = player.get("athlete_id")
                cs = player.get("cross_season")
                if not aid or not isinstance(cs, dict) or not cs.get("metrics"):
                    continue
                prev = blocks.get(aid)
                if prev is None or len(cs["metrics"]) > len(prev.get("metrics") or {}):
                    blocks[aid] = cs
    return blocks


def main() -> None:
    blocks = national_cross_season()
    log(f"{len(blocks)} atletas com cross_season nas ligas nacionais")

    touched_files = 0
    stamped = 0
    removed = 0
    for league_dir in sorted(DATA.iterdir()):
        if not league_dir.is_dir() or league_dir.name in GRAPH_LEAGUES:
            continue
        family_files = sorted(league_dir.glob("family-*.json"))
        if not family_files:
            continue
        profiles_dir = league_dir / "profiles"
        for path in family_files:
            payload = load_json(path, {})
            players = payload.get("players")
            if not isinstance(players, list):
                continue
            changed = False
            for player in players:
                had = "cross_season" in player
                player.pop("cross_season", None)
                block = blocks.get(player.get("athlete_id") or "")
                if block:
                    player["cross_season"] = json.loads(json.dumps(block))
                    if not had:
                        stamped += 1
                    changed = True
                elif had:
                    removed += 1
                    changed = True
            if changed:
                path.write_text(dumps_json(payload), encoding="utf-8")
                touched_files += 1
            if profiles_dir.is_dir():
                for player in players:
                    cid = player.get("player_id")
                    if cid and (profiles_dir / f"{cid}.json").is_file():
                        (profiles_dir / f"{cid}.json").write_text(
                            dumps_json(player), encoding="utf-8"
                        )

    log(f"cross_season propagado: {stamped} linhas, {removed} removidos, {touched_files} arquivos")


if __name__ == "__main__":
    main()
