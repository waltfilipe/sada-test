#!/usr/bin/env python3
"""Baixa foto e valor de mercado (SofaScore) a partir do CSV defensivo.

Foto (CDN público, sem Akamai):
  https://img.sofascore.com/api/v1/player/{player_id}/image

Valor de mercado (API — costuma exigir Playwright, CDP ou cookies):
  GET /api/v1/player/{player_id}
  Campo: player.proposedMarketValueRaw { value, currency }

Exemplo (uma linha, Windows com Chrome na 9222):
  python -u scripts/fetch_sofascore_photos.py --csv ./BRC26_defensive.csv --output ./BRC26_photos --transport cdp --cdp-url http://127.0.0.1:9222 --resume
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Any, Protocol

import pandas as pd
import requests

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

IMAGE_URL = "https://img.sofascore.com/api/v1/player/{player_id}/image"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://www.sofascore.com/",
}


class SofascoreApi(Protocol):
    def get(self, path: str) -> dict[str, Any]: ...

    def close(self) -> None: ...


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


def format_market_value(value: int | float | None, currency: str | None) -> str | None:
    if value is None:
        return None
    cur = (currency or "EUR").upper()
    symbol = "€" if cur == "EUR" else f"{cur} "
    amount = float(value)
    if amount >= 1_000_000:
        text = f"{amount / 1_000_000:.2f}".rstrip("0").rstrip(".")
        return f"{symbol} {text} mi."
    if amount >= 1_000:
        text = f"{amount / 1_000:.0f}" if amount % 1000 == 0 else f"{amount / 1_000:.1f}"
        return f"{symbol} {text} mil"
    return f"{symbol} {int(amount)}"


def parse_market_from_player_payload(payload: dict[str, Any]) -> dict[str, Any]:
    player = payload.get("player") if isinstance(payload.get("player"), dict) else payload
    if not isinstance(player, dict):
        return {
            "market_value_eur": None,
            "market_value_currency": None,
            "market_value_raw": None,
            "market_value_label": None,
        }

    raw = player.get("proposedMarketValueRaw")
    currency = player.get("marketValueCurrency")
    value: int | float | None = None

    if isinstance(raw, dict):
        value = raw.get("value")
        currency = raw.get("currency") or currency
    elif raw is not None:
        value = raw
    elif player.get("proposedMarketValue") is not None:
        value = player.get("proposedMarketValue")

    if value is not None:
        try:
            value = int(value)
        except (TypeError, ValueError):
            value = None

    cur = str(currency).upper() if currency else None
    eur: int | None = value if value is not None and (cur in (None, "EUR")) else None

    return {
        "market_value_eur": eur,
        "market_value_currency": cur,
        "market_value_raw": value,
        "market_value_label": format_market_value(value, cur),
    }


def fetch_market(api: SofascoreApi, player_id: str) -> dict[str, Any]:
    payload = api.get(f"player/{player_id}")
    return parse_market_from_player_payload(payload)


def _cdp_http(fd: Any, cdp_url: str, warmup_url: str | None) -> SofascoreApi:
    """Compatível com fetch_defensive_league antigo (sem warmup_url no CDP)."""
    import inspect

    params = inspect.signature(fd.CdpSofascoreHttp.__init__).parameters
    if "warmup_url" in params:
        return fd.CdpSofascoreHttp(cdp_url, warmup_url=warmup_url)
    log("CDP: fetch_defensive_league antigo — abra o SofaScore manualmente no Chrome 9222.")
    return fd.CdpSofascoreHttp(cdp_url)


def open_sofascore_api(args: argparse.Namespace) -> SofascoreApi | None:
    if args.skip_market:
        return None

    import fetch_defensive_league as fd

    proxy_url = fd.resolve_proxy(args.proxy)
    warmup = args.warmup_url or "https://www.sofascore.com/"

    transport = args.transport
    if transport == "playwright":
        log("API mercado: Playwright …")
        return fd.BrowserSofascoreHttp(
            proxy_url=proxy_url,
            headless=not args.headed,
            channel=args.channel,
            warmup_url=warmup,
            warmup_wait_ms=args.warmup_wait,
            storage_state=args.load_storage,
            user_data_dir=args.user_data_dir,
        )
    if transport == "cdp":
        log(f"API mercado: CDP → {args.cdp_url}")
        return _cdp_http(fd, args.cdp_url, warmup)
    if transport == "cookies":
        if not args.cookies_file:
            raise SystemExit("Modo cookies exige --cookies-file ./cookies.txt")
        log(f"API mercado: Cookie ← {args.cookies_file}")
        return fd.CookieCffiHttp(args.cookies_file, proxy_url=proxy_url)
    if transport == "cache":
        log(f"API mercado: cache offline ← {args.cache_dir.resolve()}")
        return fd.FileCacheHttp(args.cache_dir)
    raise SystemExit(f"Transport desconhecido: {transport}")


def manifest_has_market(entry: dict[str, Any]) -> bool:
    return entry.get("market_fetched") is True or "market_value_raw" in entry


def write_market_csv(out_dir: Path, manifest: dict[str, dict[str, Any]]) -> None:
    path = out_dir / "market_values.csv"
    rows = []
    for player_id, entry in sorted(manifest.items(), key=lambda item: item[0]):
        rows.append(
            {
                "player_id": player_id,
                "player_name": entry.get("name", ""),
                "market_value_label": entry.get("market_value_label") or "",
                "market_value_raw": entry.get("market_value_raw") if entry.get("market_value_raw") is not None else "",
                "market_value_currency": entry.get("market_value_currency") or "",
                "market_value_eur": entry.get("market_value_eur") if entry.get("market_value_eur") is not None else "",
            }
        )
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else ["player_id"])
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Baixa fotos e valor de mercado (SofaScore).")
    parser.add_argument("--csv", type=Path, required=True, help="CSV defensivo com player_id e player_name")
    parser.add_argument("--output", type=Path, default=Path("./sofascore_photos"), help="Pasta de saída")
    parser.add_argument("--resume", action="store_true", help="Pula foto/arquivo já feitos")
    parser.add_argument("--limit", type=int, default=None, help="Máximo de jogadores nesta execução")
    parser.add_argument("--rate-limit", type=float, default=0.2, help="Pausa entre jogadores (s)")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--skip-photos", action="store_true", help="Só valor de mercado")
    parser.add_argument("--skip-market", action="store_true", help="Só fotos (comportamento antigo)")
    parser.add_argument(
        "--transport",
        choices=("playwright", "cdp", "cookies", "cache"),
        default="playwright",
        help="Como chamar a API do jogador para mercado (default: playwright)",
    )
    parser.add_argument("--cdp-url", default="http://127.0.0.1:9222")
    parser.add_argument("--cookies-file", type=Path, default=None)
    parser.add_argument("--cache-dir", type=Path, default=Path("./sofascore_cache"))
    parser.add_argument("--proxy", default=None)
    parser.add_argument("--warmup-url", default=None, help="Página da liga para warm-up (CDP/Playwright)")
    parser.add_argument("--headed", action="store_true", help="Navegador visível (Playwright)")
    parser.add_argument("--channel", default=None, help="chrome, msedge ou chromium")
    parser.add_argument("--warmup-wait", type=int, default=8000)
    parser.add_argument("--load-storage", type=Path, default=None)
    parser.add_argument("--user-data-dir", type=Path, default=None)
    parser.add_argument(
        "--apply-site",
        action="store_true",
        help="Após baixar, preenche foto/valor faltando em data/<league>/ (Transfermarkt block)",
    )
    parser.add_argument("--league", default="serie-c", help="Liga alvo com --apply-site (default: serie-c)")
    parser.add_argument("--dry-run-apply", action="store_true", help="Só simula o --apply-site")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.skip_photos and args.skip_market:
        raise SystemExit("Use --skip-photos ou --skip-market, não os dois.")

    if not args.csv.is_file():
        raise SystemExit(f"CSV não encontrado: {args.csv}")

    players = unique_players(args.csv)
    if args.limit is not None:
        players = players[: args.limit]

    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "manifest.json"
    manifest: dict[str, dict[str, Any]] = {}
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    photo_session = requests.Session()
    photo_session.headers.update(HEADERS)

    api = open_sofascore_api(args)
    photos_ok = photos_skip = photos_missing = photos_failed = 0
    market_ok = market_empty = market_failed = market_skip = 0

    log(f"{len(players)} jogadores únicos em {args.csv.name}")

    try:
        for index, player in enumerate(players, start=1):
            player_id = player["player_id"]
            name = player["player_name"]
            entry: dict[str, Any] = dict(manifest.get(player_id) or {})
            entry["name"] = name

            # --- foto ---
            if args.skip_photos:
                pass
            elif args.resume and (cached_photo := existing_photo(args.output, player_id)):
                photos_skip += 1
                entry["file"] = cached_photo.name
                entry["photo_url"] = IMAGE_URL.format(player_id=player_id)
                entry["photo_status"] = "cached"
            else:
                try:
                    saved = download_photo(photo_session, player_id, args.output / player_id, args.timeout)
                    photos_ok += 1
                    entry["file"] = saved.name
                    entry["photo_url"] = IMAGE_URL.format(player_id=player_id)
                    entry["photo_status"] = "ok"
                except FileNotFoundError:
                    photos_missing += 1
                    entry["file"] = None
                    entry["photo_status"] = "missing"
                except Exception as exc:
                    photos_failed += 1
                    entry["file"] = None
                    entry["photo_status"] = f"error: {exc}"

            # --- mercado ---
            if args.skip_market:
                pass
            elif args.resume and manifest_has_market(entry):
                market_skip += 1
            elif api is None:
                market_failed += 1
                entry["market_status"] = "no_api"
            else:
                try:
                    market = fetch_market(api, player_id)
                    entry.update(market)
                    entry["market_fetched"] = True
                    if market["market_value_raw"] is None:
                        market_empty += 1
                        entry["market_status"] = "empty"
                        log(f"[{index}/{len(players)}] {name} — sem valor no SofaScore")
                    else:
                        market_ok += 1
                        entry["market_status"] = "ok"
                        log(
                            f"[{index}/{len(players)}] {name} — "
                            f"{market['market_value_label'] or market['market_value_raw']}"
                        )
                except Exception as exc:
                    market_failed += 1
                    entry["market_fetched"] = True
                    entry["market_status"] = f"error: {exc}"
                    log(f"[{index}/{len(players)}] {name} mercado falhou: {exc}")

            manifest[player_id] = entry

            if args.rate_limit > 0:
                time.sleep(args.rate_limit)
            if index % 25 == 0:
                manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    finally:
        if api is not None:
            api.close()

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    if not args.skip_market:
        write_market_csv(args.output, manifest)

    parts = []
    if not args.skip_photos:
        parts.append(f"fotos ok={photos_ok} cache={photos_skip} 404={photos_missing} err={photos_failed}")
    if not args.skip_market:
        parts.append(f"mercado ok={market_ok} vazio={market_empty} cache={market_skip} err={market_failed}")
    log("Pronto. " + " | ".join(parts))
    log(f"Pasta: {args.output.resolve()}")

    if args.apply_site:
        from apply_sofascore_to_site import apply_manifest

        log(f"\nAplicando no site ({args.league})…")
        apply_manifest(
            args.league,
            args.csv,
            manifest_path,
            dry_run=args.dry_run_apply,
        )


if __name__ == "__main__":
    main()
