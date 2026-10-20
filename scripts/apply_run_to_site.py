#!/usr/bin/env python3
"""Aplica dados Run/GPS (SofaScore) nos JSON de perfil já gerados."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from engine.leagues import LEAGUES
from engine.load_data import load_players_dataframe
from engine.sofascore_run import attach_physical_run_to_players


def log(msg: str) -> None:
    print(msg, flush=True)


def patch_family_files(data_dir: Path, updates: dict[str, dict[str, Any]]) -> None:
    for family_path in data_dir.glob("family-*.json"):
        family = json.loads(family_path.read_text(encoding="utf-8"))
        touched = False
        for row in family.get("players", []):
            pid = row.get("player_id")
            if pid in updates:
                row["physical_run"] = updates[pid]
                touched = True
            elif "physical_run" in row:
                del row["physical_run"]
                touched = True
        if touched:
            family_path.write_text(json.dumps(family, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_run(
    league_id: str,
    *,
    run_csv: Path,
    defensive_csv: Path | None = None,
    dry_run: bool = False,
) -> tuple[int, int]:
    league = LEAGUES.get(league_id)
    if not league:
        raise SystemExit(f"Liga desconhecida: {league_id}")
    data_dir = ROOT / "data" / league_id
    if not data_dir.is_dir():
        raise SystemExit(f"Pasta de dados não encontrada: {data_dir}")
    if not run_csv.is_file():
        raise SystemExit(f"CSV Run não encontrado: {run_csv}")

    def_csv = defensive_csv or league["defensive_csv"]
    raw_df = load_players_dataframe(league_id)

    profile_paths = sorted((data_dir / "profiles").glob("*.json"))
    players: list[dict[str, Any]] = []
    for path in profile_paths:
        players.append(json.loads(path.read_text(encoding="utf-8")))

    attach_physical_run_to_players(
        players,
        raw_df,
        defensive_csv=def_csv,
        run_csv=run_csv,
    )

    updates: dict[str, dict[str, Any]] = {}
    filled = cleared = 0
    for player, path in zip(players, profile_paths, strict=True):
        run = player.get("physical_run")
        if run:
            filled += 1
            updates[player["player_id"]] = run
            log(f"  {player.get('name')} · {run['position_pool']} · {run['kilometers_p90']} km/90")
        else:
            cleared += 1
        if dry_run:
            continue
        if run:
            player["physical_run"] = run
        else:
            player.pop("physical_run", None)
        path.write_text(json.dumps(player, ensure_ascii=False, indent=2), encoding="utf-8")

    log(f"\n{filled} perfis com GPS | {cleared} sem match/dados")

    if dry_run or not updates:
        return filled, cleared

    patch_family_files(data_dir, updates)

    meta_path = data_dir / "meta.json"
    if meta_path.is_file():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if not meta.get("physical_run_enabled"):
            meta["physical_run_enabled"] = True
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            log("meta.json: physical_run_enabled = true")

    return filled, cleared


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aplica GPS/Run SofaScore nos JSON do site.")
    parser.add_argument("--league", default="serie-a", help="serie-a, serie-b, …")
    parser.add_argument("--run-csv", type=Path, default=ROOT / "BR26_run.csv")
    parser.add_argument("--csv", type=Path, default=None, help="CSV defensivo para match de jogadores")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    apply_run(
        args.league,
        run_csv=args.run_csv,
        defensive_csv=args.csv,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
