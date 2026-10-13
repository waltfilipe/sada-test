#!/usr/bin/env python3
"""Heatmaps de temporada (SofaScore) — rode a partir da pasta do repo.

Série C (uma linha, Chrome CDP na 9222):
  python -u "allmatch/onlyheatmaps.py" --url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv --output-dir ./allmatch/BRC26_Defensive/heatmaps --transport cdp --cdp-url http://127.0.0.1:9222 --warmup-url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" --resume --rate-limit 0.35 --apply-site --league serie-c

Só aplicar heatmaps já baixados:
  python -u "allmatch/onlyheatmaps.py" --apply-only --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv --source-dir ./allmatch/BRC26_Defensive/heatmaps --league serie-c
"""

from __future__ import annotations

import argparse
import inspect
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

# Flags só do wrapper / CDP — não repassar ao scripts/onlyheatmaps.py antigo
_STRIP_OPTIONS = (
    "--league",
    "--transport",
    "--cdp-url",
    "--warmup-url",
    "--proxy",
    "--cookies-file",
)
_STRIP_FLAGS = ("--apply-site", "--dry-run-apply")


def _strip_for_inner(argv: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(argv):
        token = argv[i]
        if token in _STRIP_FLAGS:
            i += 1
            continue
        if token in _STRIP_OPTIONS:
            i += 2
            continue
        out.append(token)
        i += 1
    return out


def _cdp_http(fd: Any, cdp_url: str, warmup_url: str | None) -> Any:
    params = inspect.signature(fd.CdpSofascoreHttp.__init__).parameters
    if "warmup_url" in params:
        return fd.CdpSofascoreHttp(cdp_url, warmup_url=warmup_url)
    print("CDP: abra o SofaScore manualmente no Chrome 9222.", flush=True)
    return fd.CdpSofascoreHttp(cdp_url)


def _open_api(
    transport: str,
    *,
    cdp_url: str,
    warmup_url: str | None,
    url: str | None,
    proxy: str | None,
    cookies_file: Path | None,
) -> Any | None:
    if transport == "auto":
        return None

    import fetch_defensive_league as fd

    proxy_url = fd.resolve_proxy(proxy)
    warmup = warmup_url or url or "https://www.sofascore.com/"

    if transport == "playwright":
        print("API heatmap: Playwright …", flush=True)
        return fd.BrowserSofascoreHttp(proxy_url=proxy_url, headless=True, warmup_url=warmup)
    if transport == "cdp":
        print(f"API heatmap: CDP → {cdp_url}", flush=True)
        return _cdp_http(fd, cdp_url, warmup)
    if transport == "cookies":
        if not cookies_file:
            raise SystemExit("Modo cookies exige --cookies-file")
        print(f"API heatmap: cookies ← {cookies_file}", flush=True)
        return fd.CookieCffiHttp(cookies_file, proxy_url=proxy_url)
    raise SystemExit(f"Transport desconhecido: {transport}")


def main() -> None:
    raw_argv = sys.argv[1:]

    if raw_argv[:1] == ["--apply-only"]:
        from apply_heatmaps_to_site import apply_heatmaps

        parser = argparse.ArgumentParser()
        parser.add_argument("--apply-only", action="store_true")
        parser.add_argument("--league", default="serie-c")
        parser.add_argument("--csv", type=Path, required=True)
        parser.add_argument("--source-dir", type=Path, required=True)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--overwrite", action="store_true")
        args = parser.parse_args(raw_argv)
        apply_heatmaps(args.league, args.csv, args.source_dir, dry_run=args.dry_run, overwrite=args.overwrite)
        return

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--apply-site", action="store_true")
    parser.add_argument("--dry-run-apply", action="store_true")
    parser.add_argument("--league", default="serie-c")
    parser.add_argument("--transport", default="auto")
    parser.add_argument("--cdp-url", default="http://127.0.0.1:9222")
    parser.add_argument("--warmup-url", default=None)
    parser.add_argument("--proxy", default=None)
    parser.add_argument("--cookies-file", type=Path, default=None)
    parser.add_argument("--url", default=None)
    parser.add_argument("--csv", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    wrapper_args, _rest = parser.parse_known_args(raw_argv)

    inner_argv = _strip_for_inner(raw_argv)
    sys.argv = [sys.argv[0], *inner_argv]

    import onlyheatmaps as oh

    api = _open_api(
        wrapper_args.transport,
        cdp_url=wrapper_args.cdp_url,
        warmup_url=wrapper_args.warmup_url,
        url=wrapper_args.url,
        proxy=wrapper_args.proxy,
        cookies_file=wrapper_args.cookies_file,
    )
    prev_api = getattr(oh, "_SOFA_API", None)
    oh._SOFA_API = api
    try:
        oh.main()
    finally:
        oh._SOFA_API = prev_api
        if api is not None:
            try:
                api.close()
            except Exception:
                pass

    if wrapper_args.apply_site:
        from apply_heatmaps_to_site import apply_heatmaps

        csv_path = wrapper_args.csv
        if csv_path is None:
            for i, tok in enumerate(raw_argv):
                if tok == "--csv" and i + 1 < len(raw_argv):
                    csv_path = Path(raw_argv[i + 1])
                    break
        source_dir = wrapper_args.output_dir
        if source_dir is None:
            for i, tok in enumerate(raw_argv):
                if tok == "--output-dir" and i + 1 < len(raw_argv):
                    source_dir = Path(raw_argv[i + 1])
                    break
        if csv_path is None:
            raise SystemExit("--apply-site exige --csv")
        if source_dir is None:
            source_dir = Path("./HeatmapsBR26")
        print(f"\nAplicando heatmaps no site ({wrapper_args.league})…", flush=True)
        apply_heatmaps(
            wrapper_args.league,
            csv_path,
            source_dir,
            dry_run=wrapper_args.dry_run_apply,
        )


if __name__ == "__main__":
    main()
