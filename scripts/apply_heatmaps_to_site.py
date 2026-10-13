#!/usr/bin/env python3
"""Copia heatmaps baixados (SofaScore id) para os JSON do site (Wyscout player_id)."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from engine.load_data import load_players_dataframe
from engine.measures import attach_base_measures
from engine.sofascore_heatmap import (
    HEATMAP_DIR,
    PUBLIC_HEATMAP_DIR,
    build_sofascore_player_map,
    infer_extremo_flank_from_points,
    save_heatmap,
    write_heatmap_index,
)


def log(msg: str) -> None:
    print(msg, flush=True)


def profile_has_heatmap(profile: dict[str, Any]) -> bool:
    hm = profile.get("heatmap")
    return bool(hm and hm.get("points"))


def embed_heatmap_field(payload: dict[str, Any], site_id: str, public_dir: Path) -> dict[str, Any]:
    image_url = None
    if (public_dir / f"{site_id}.png").is_file():
        image_url = f"/heatmaps/{site_id}.png"
    return {
        "tournament_id": payload.get("tournament_id"),
        "season_id": payload.get("season_id"),
        "scope": payload.get("scope", "overall"),
        "competition": payload.get("competition"),
        "points": payload.get("points"),
        "point_count": payload.get("point_count", len(payload.get("points") or [])),
        "image_url": image_url,
    }


def patch_family_files(data_dir: Path, updates: dict[str, dict[str, Any]]) -> None:
    for family_path in data_dir.glob("family-*.json"):
        family = json.loads(family_path.read_text(encoding="utf-8"))
        touched = False
        for row in family.get("players", []):
            pid = row.get("player_id")
            if pid in updates:
                row["heatmap"] = updates[pid]
                touched = True
        if touched:
            family_path.write_text(json.dumps(family, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_heatmaps(
    league_id: str,
    csv_path: Path,
    source_dir: Path,
    *,
    dry_run: bool = False,
    overwrite: bool = False,
) -> tuple[int, int]:
    data_dir = ROOT / "data" / league_id
    if not data_dir.is_dir():
        raise SystemExit(f"Pasta de dados não encontrada: {data_dir}")
    if not source_dir.is_dir():
        raise SystemExit(f"Pasta de heatmaps não encontrada: {source_dir}")
    if not csv_path.is_file():
        raise SystemExit(f"CSV defensivo não encontrado: {csv_path}")

    raw_df = load_players_dataframe(league_id)
    df = attach_base_measures(raw_df)
    ss_map = build_sofascore_player_map(df, csv_path)

    storage_dir = HEATMAP_DIR
    public_dir = PUBLIC_HEATMAP_DIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)

    profile_updates: dict[str, dict[str, Any]] = {}
    filled = skipped = 0

    for site_id, meta in ss_map.items():
        ss_id = str(meta["sofascore_player_id"])
        src_json = source_dir / f"{ss_id}.json"
        if not src_json.is_file():
            continue

        profile_path = data_dir / "profiles" / f"{site_id}.json"
        if not profile_path.is_file():
            continue

        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        if profile_has_heatmap(profile) and not overwrite:
            skipped += 1
            continue

        try:
            payload = json.loads(src_json.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not payload.get("points"):
            continue

        payload = dict(payload)
        payload["player_id"] = site_id
        payload["sofascore_player_id"] = int(ss_id)
        payload["source"] = payload.get("source") or "onlyheatmaps"

        hm_field = embed_heatmap_field(payload, site_id, public_dir)
        log(f"  {profile.get('name')} ← SS {ss_id} | {hm_field['point_count']} pts")

        if dry_run:
            filled += 1
            continue

        save_heatmap(site_id, payload, storage_dir)
        png_src = source_dir / f"{ss_id}.png"
        if png_src.is_file():
            shutil.copy2(png_src, public_dir / f"{site_id}.png")
            hm_field["image_url"] = f"/heatmaps/{site_id}.png"

        profile["heatmap"] = hm_field
        if profile.get("position_family") == "extremos":
            flank = infer_extremo_flank_from_points(payload.get("points") or [])
            if flank:
                profile["position"] = flank
        profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
        profile_updates[site_id] = hm_field
        filled += 1

    log(f"\n{filled} heatmaps aplicados | {skipped} já tinham mapa (use --overwrite para substituir)")

    if dry_run or not profile_updates:
        return filled, skipped

    patch_family_files(data_dir, profile_updates)
    write_heatmap_index(storage_dir)

    meta_path = data_dir / "meta.json"
    if meta_path.is_file():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if not meta.get("heatmaps_enabled"):
            meta["heatmaps_enabled"] = True
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            log("meta.json: heatmaps_enabled = true")

    return filled, skipped


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aplica heatmaps SofaScore nos JSON do site.")
    parser.add_argument("--league", default="serie-c", help="serie-a ou serie-c")
    parser.add_argument("--csv", type=Path, required=True, help="CSV defensivo (BRC26_defensive.csv)")
    parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="Pasta com {sofascore_player_id}.json (saída do onlyheatmaps)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overwrite", action="store_true", help="Substituir heatmap já presente no perfil")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    apply_heatmaps(
        args.league,
        args.csv,
        args.source_dir,
        dry_run=args.dry_run,
        overwrite=args.overwrite,
    )


if __name__ == "__main__":
    main()
