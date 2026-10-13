#!/usr/bin/env python3
"""Baixa fotos de atletas do SofaScore a partir do CSV defensivo.

A foto pública fica em:
  https://img.sofascore.com/api/v1/player/{player_id}/image

O CSV gerado por fetch_defensive_league.py já traz player_id e player_name.
Este script deduplica os IDs e salva JPEG/PNG + um manifesto JSON.

Exemplo (uma linha):
  python -u scripts/fetch_sofascore_photos.py --csv ./BRC26_defensive.csv --output ./BRC26_photos --resume
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import pandas as pd
import requests

IMAGE_URL = "https://img.sofascore.com/api/v1/player/{player_id}/image"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://www.sofascore.com/",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def unique_players(csv_path: Path) -> list[dict[str, str]]:
    df = pd.read_csv(csv_path, usecols=["player_id", "player_name"])
    df = df.dropna(subset=["player_id"]).copy()
    df["player_id"] = df["player_id"].astype(int).astype(str)
    df["player_name"] = df["player_name"].fillna("").astype(str)
    grouped = df.groupby("player_id", as_index=False)["player_name"].first()
    return grouped.to_dict("records")


def extension_for(content_type: str) -> str:
    kind = content_type.split(";", 1)[0].strip().lower()
    if kind in {"image/png"}:
        return ".png"
    if kind in {"image/webp"}:
        return ".webp"
    return ".jpg"


def download_photo(session: requests.Session, player_id: str, dest_stem: Path, timeout: float) -> Path:
    response = session.get(IMAGE_URL.format(player_id=player_id), timeout=timeout)
    if response.status_code == 404:
        raise FileNotFoundError(player_id)
    response.raise_for_status()
    ext = extension_for(response.headers.get("content-type", "image/jpeg"))
    dest = dest_stem.with_suffix(ext)
    dest.write_bytes(response.content)
    return dest


def existing_photo(out_dir: Path, player_id: str) -> Path | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        path = out_dir / f"{player_id}{ext}"
        if path.is_file() and path.stat().st_size > 0:
            return path
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Baixa fotos de jogadores do SofaScore.")
    parser.add_argument("--csv", type=Path, required=True, help="CSV defensivo com player_id e player_name")
    parser.add_argument("--output", type=Path, default=Path("./sofascore_photos"), help="Pasta das imagens")
    parser.add_argument("--resume", action="store_true", help="Pula arquivos que já existem")
    parser.add_argument("--limit", type=int, default=None, help="Máximo de jogadores nesta execução")
    parser.add_argument("--rate-limit", type=float, default=0.2, help="Pausa em segundos entre downloads")
    parser.add_argument("--timeout", type=float, default=20.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.csv.is_file():
        raise SystemExit(f"CSV não encontrado: {args.csv}")

    players = unique_players(args.csv)
    if args.limit is not None:
        players = players[: args.limit]

    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "manifest.json"
    manifest: dict[str, dict[str, str | None]] = {}
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    session = requests.Session()
    session.headers.update(HEADERS)

    ok = skipped = missing = failed = 0
    log(f"{len(players)} jogadores únicos em {args.csv.name}")

    for index, player in enumerate(players, start=1):
        player_id = player["player_id"]
        name = player["player_name"]
        cached = existing_photo(args.output, player_id) if args.resume else None
        if cached:
            skipped += 1
            manifest[player_id] = {"name": name, "file": cached.name, "status": "cached"}
            continue
        try:
            saved = download_photo(session, player_id, args.output / player_id, args.timeout)
            ok += 1
            manifest[player_id] = {"name": name, "file": saved.name, "status": "ok"}
            log(f"[{index}/{len(players)}] {name} → {saved.name}")
        except FileNotFoundError:
            missing += 1
            manifest[player_id] = {"name": name, "file": None, "status": "missing"}
            log(f"[{index}/{len(players)}] {name} sem foto (404)")
        except Exception as exc:
            failed += 1
            manifest[player_id] = {"name": name, "file": None, "status": f"error: {exc}"}
            log(f"[{index}/{len(players)}] {name} falhou: {exc}")
        if args.rate_limit > 0:
            time.sleep(args.rate_limit)
        if index % 25 == 0:
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"Pronto. baixadas={ok} cache={skipped} sem_foto={missing} erros={failed}")
    log(f"Pasta: {args.output.resolve()}")


if __name__ == "__main__":
    main()
