#!/usr/bin/env python3
"""Preenche foto/valor em transfermarkt a partir do manifest SofaScore (só lacunas)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from engine.load_data import load_players_dataframe
from engine.measures import attach_base_measures
from engine.sofascore_heatmap import build_sofascore_player_map

IMAGE_URL = "https://img.sofascore.com/api/v1/player/{player_id}/image"
PHOTO_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def log(msg: str) -> None:
    print(msg, flush=True)


def needs_photo(tm: dict[str, Any] | None) -> bool:
    if not tm:
        return True
    photo = tm.get("photo")
    return not photo or not str(photo).strip()


def is_sofascore_cdn_photo(photo: Any) -> bool:
    text = str(photo or "").strip()
    return "img.sofascore.com" in text


def resolve_local_photo_file(entry: dict[str, Any], ss_id: str, photos_dir: Path) -> str | None:
    """Return filename under photos/ if the file exists on disk."""
    if not photos_dir.is_dir():
        return None
    fname = entry.get("file")
    if isinstance(fname, str) and fname.strip():
        path = photos_dir / fname.strip()
        if path.is_file() and path.stat().st_size > 0:
            return path.name
    for ext in PHOTO_EXTENSIONS:
        candidate = photos_dir / f"{ss_id}{ext}"
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate.name
    return None


def resolve_photo_url(
    entry: dict[str, Any],
    ss_id: str,
    *,
    photos_dir: Path | None,
    prefer_local: bool,
) -> str | None:
    local_name = resolve_local_photo_file(entry, ss_id, photos_dir) if photos_dir else None
    if prefer_local and local_name:
        return f"/photos/{local_name}"
    if entry.get("photo_status") in {"missing", None} and not entry.get("file"):
        return None
    if local_name and not prefer_local:
        return f"/photos/{local_name}"
    return entry.get("photo_url") or IMAGE_URL.format(player_id=ss_id)


def should_set_photo(existing: dict[str, Any] | None, new_url: str | None, *, refresh_local: bool) -> bool:
    if not new_url or not str(new_url).startswith("/photos/"):
        return False
    current = str((existing or {}).get("photo") or "").strip()
    if not current:
        return True
    if current == new_url:
        return False
    if not refresh_local:
        return needs_photo(existing)
    # Pasta photos/ no repo: preferir arquivo local sobre CDN SofaScore ou TM genérico
    return True


def needs_market(tm: dict[str, Any] | None) -> bool:
    if not tm:
        return True
    mv = tm.get("market_value")
    if mv is None:
        return True
    text = str(mv).strip()
    return not text or text in {"-", "—", "null"}


def merge_transfermarkt(
    existing: dict[str, Any] | None,
    *,
    photo_url: str | None,
    market_label: str | None,
    market_eur: int | None,
    ss_player_id: str,
) -> dict[str, Any]:
    tm: dict[str, Any] = dict(existing) if existing else {}
    if photo_url:
        tm["photo"] = photo_url
    if market_label and needs_market(existing):
        tm["market_value"] = market_label
        if market_eur is not None:
            tm["market_value_eur"] = market_eur
    if not tm.get("id"):
        tm["id"] = None
    tm.setdefault("contract_until", existing.get("contract_until") if existing else None)
    tm.setdefault("contract_remaining", existing.get("contract_remaining") if existing else None)
    tm.setdefault("club", existing.get("club") if existing else None)
    tm.setdefault("profile_url", existing.get("profile_url") if existing else None)
    tm["sofascore_player_id"] = ss_player_id
    return tm


def write_player_transfermarkt(data_dir: Path, updates: dict[str, dict[str, Any]]) -> None:
    players_path = data_dir / "players.json"
    payload = json.loads(players_path.read_text(encoding="utf-8"))
    for row in payload.get("players", []):
        pid = row.get("player_id")
        if pid in updates:
            row["transfermarkt"] = updates[pid]
    players_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    for player_id, tm in updates.items():
        profile_path = data_dir / "profiles" / f"{player_id}.json"
        if not profile_path.is_file():
            continue
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        profile["transfermarkt"] = tm
        profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")

    for family_path in data_dir.glob("family-*.json"):
        family = json.loads(family_path.read_text(encoding="utf-8"))
        touched = False
        for row in family.get("players", []):
            pid = row.get("player_id")
            if pid in updates:
                row["transfermarkt"] = updates[pid]
                touched = True
        if touched:
            family_path.write_text(json.dumps(family, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_manifest(
    league_id: str,
    csv_path: Path,
    manifest_path: Path,
    *,
    photos_dir: Path | None = None,
    prefer_local: bool = True,
    refresh_local: bool = True,
    dry_run: bool = False,
) -> tuple[int, int]:
    data_dir = ROOT / "data" / league_id
    if not data_dir.is_dir():
        raise SystemExit(f"Pasta de dados não encontrada: {data_dir}")
    if not manifest_path.is_file():
        raise SystemExit(f"Manifest não encontrado: {manifest_path}")
    if not csv_path.is_file():
        raise SystemExit(f"CSV defensivo não encontrado: {csv_path}")

    manifest: dict[str, dict[str, Any]] = json.loads(manifest_path.read_text(encoding="utf-8"))
    local_dir = photos_dir or manifest_path.parent
    if not local_dir.is_dir():
        local_dir = ROOT / "photos"
    raw_df = load_players_dataframe(league_id)
    df = attach_base_measures(raw_df)
    ss_map = build_sofascore_player_map(df, csv_path)

    updates: dict[str, dict[str, Any]] = {}
    filled_photo = filled_market = 0

    for site_id, meta in ss_map.items():
        ss_id = str(meta["sofascore_player_id"])
        entry = manifest.get(ss_id)
        if not entry:
            continue

        profile_path = data_dir / "profiles" / f"{site_id}.json"
        if not profile_path.is_file():
            continue
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        existing = profile.get("transfermarkt")

        photo_url = resolve_photo_url(
            entry,
            ss_id,
            photos_dir=local_dir,
            prefer_local=prefer_local,
        )

        market_label = entry.get("market_value_label")
        market_eur = entry.get("market_value_eur")
        if entry.get("market_value_raw") is None and not market_label:
            market_label = None
            market_eur = None

        wants_photo = should_set_photo(existing, photo_url, refresh_local=refresh_local)
        wants_market = needs_market(existing)
        if not wants_photo and not wants_market:
            continue

        before_photo = needs_photo(existing) or is_sofascore_cdn_photo((existing or {}).get("photo"))
        before_market = needs_market(existing)

        tm = merge_transfermarkt(
            existing,
            photo_url=photo_url if wants_photo else None,
            market_label=market_label if isinstance(market_label, str) and wants_market else None,
            market_eur=market_eur if isinstance(market_eur, int) and wants_market else None,
            ss_player_id=ss_id,
        )

        if wants_photo and photo_url and tm.get("photo") == photo_url:
            filled_photo += 1
        elif before_photo and not needs_photo(tm):
            filled_photo += 1
        if before_market and not needs_market(tm):
            filled_market += 1

        updates[site_id] = tm
        log(f"  {profile.get('name')} ← SS {ss_id} | foto={'sim' if not needs_photo(tm) else '—'} | valor={tm.get('market_value') or '—'}")

    log(f"\n{len(updates)} perfis tocados | fotos novas: {filled_photo} | valores novos: {filled_market}")
    if dry_run:
        log("(dry-run — nada gravado)")
        return filled_photo, filled_market

    if updates:
        write_player_transfermarkt(data_dir, updates)
    return filled_photo, filled_market


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aplica manifest SofaScore nos JSON do site.")
    parser.add_argument("--league", default="serie-c", help="serie-a ou serie-c")
    parser.add_argument("--csv", type=Path, required=True, help="CSV defensivo (BRC26_defensive.csv)")
    parser.add_argument("--manifest", type=Path, required=True, help="manifest.json da pasta de fotos")
    parser.add_argument(
        "--photos-dir",
        type=Path,
        default=None,
        help="Pasta com arquivos de foto (default: pasta do manifest ou ./photos)",
    )
    parser.add_argument(
        "--no-prefer-local",
        action="store_true",
        help="Usar URL SofaScore em vez de /photos/arquivo local",
    )
    parser.add_argument(
        "--no-refresh-local",
        action="store_true",
        help="Não substituir fotos CDN já gravadas por /photos/…",
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    apply_manifest(
        args.league,
        args.csv,
        args.manifest,
        photos_dir=args.photos_dir,
        prefer_local=not args.no_prefer_local,
        refresh_local=not args.no_refresh_local,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
