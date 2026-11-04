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
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode(), flush=True)


def _run_competition_name(league: dict) -> str:
    label = str(league.get("label") or "")
    if label.startswith("Série"):
        return f"Brasileirão {label}"
    return label or "Brasileirão Série A"


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


def patch_players_file(data_dir: Path, updates: dict[str, dict[str, Any]]) -> None:
    players_path = data_dir / "players.json"
    if not players_path.is_file():
        return
    blob = json.loads(players_path.read_text(encoding="utf-8"))
    rows = blob.get("players", blob if isinstance(blob, list) else [])
    touched = False
    for row in rows:
        pid = row.get("player_id")
        if pid in updates:
            row["physical_run"] = updates[pid]
            touched = True
        elif "physical_run" in row:
            del row["physical_run"]
            touched = True
    if touched:
        players_path.write_text(json.dumps(blob, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_run(
    league_id: str,
    *,
    run_csv: Path,
    defensive_csv: Path | None = None,
    data_dir: Path | None = None,
    xlsx: list[Path] | None = None,
    prefer_period_club: bool = False,
    dry_run: bool = False,
) -> tuple[int, int]:
    league = LEAGUES.get(league_id)
    if not league:
        raise SystemExit(f"Liga desconhecida: {league_id}")
    data_dir = data_dir or ROOT / "data" / league_id
    if not data_dir.is_dir():
        raise SystemExit(f"Pasta de dados não encontrada: {data_dir}")
    if not run_csv.is_file():
        raise SystemExit(f"CSV Run não encontrado: {run_csv}")

    def_csv = defensive_csv or league["defensive_csv"]
    raw_df = load_players_dataframe(
        league_id, xlsx_override=xlsx, prefer_period_club=prefer_period_club
    )

    profile_paths = sorted((data_dir / "profiles").glob("*.json"))
    players_blob: dict[str, Any] | None = None
    if profile_paths:
        players = [json.loads(path.read_text(encoding="utf-8")) for path in profile_paths]
    elif (data_dir / "players.json").is_file():
        # Season snapshots (data/<league>/seasons/<ano>) não têm pasta profiles/.
        players_blob = json.loads((data_dir / "players.json").read_text(encoding="utf-8"))
        players = players_blob.get("players", [])
    else:
        raise SystemExit(f"Nenhum perfil ou players.json em {data_dir}")

    attach_physical_run_to_players(
        players,
        raw_df,
        defensive_csv=def_csv,
        run_csv=run_csv,
        competition=_run_competition_name(league),
    )

    updates: dict[str, dict[str, Any]] = {}
    filled = cleared = 0
    for player in players:
        run = player.get("physical_run")
        if run:
            filled += 1
            updates[player["player_id"]] = run
            log(f"  {player.get('name')} · {run['position_pool']} · {run['kilometers_p90']} km/90")
        else:
            cleared += 1

    log(f"\n{filled} perfis com GPS | {cleared} sem match/dados")

    if dry_run:
        return filled, cleared

    if profile_paths:
        for player, path in zip(players, profile_paths, strict=True):
            run = player.get("physical_run")
            if run:
                player["physical_run"] = run
            else:
                player.pop("physical_run", None)
            path.write_text(json.dumps(player, ensure_ascii=False, indent=2), encoding="utf-8")
    elif players_blob is not None:
        # attach_* já mutou as linhas in-place; regrava o blob original.
        (data_dir / "players.json").write_text(
            json.dumps(players_blob, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    if not updates:
        return filled, cleared

    patch_family_files(data_dir, updates)
    patch_players_file(data_dir, updates)

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
    parser.add_argument("--season", type=str, default=None, help="Snapshot em data/<liga>/seasons/<ano>")
    parser.add_argument("--xlsx", type=Path, default=None, help="XLSX da temporada (snapshots históricos)")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_dir = ROOT / "data" / args.league / "seasons" / args.season if args.season else None
    apply_run(
        args.league,
        run_csv=args.run_csv,
        defensive_csv=args.csv,
        data_dir=data_dir,
        xlsx=[args.xlsx] if args.xlsx else None,
        prefer_period_club=bool(args.season),
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
