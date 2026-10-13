#!/usr/bin/env python3
"""Heatmaps de temporada (SofaScore) — rode a partir da pasta do repo.

Exemplo Série C (Chrome CDP na 9222, igual photo&mercado):
  python -u "allmatch/onlyheatmaps.py" ^
    --url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" ^
    --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv ^
    --output-dir ./allmatch/BRC26_Defensive/heatmaps ^
    --transport cdp --cdp-url http://127.0.0.1:9222 ^
    --warmup-url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" ^
    --resume --rate-limit 0.35 --apply-site --league serie-c

Só aplicar heatmaps já baixados (sem API):
  python -u "allmatch/onlyheatmaps.py" --apply-only ^
    --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv ^
    --source-dir ./allmatch/BRC26_Defensive/heatmaps ^
    --league serie-c
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def _pop_flag(argv: list[str], name: str) -> tuple[list[str], bool]:
    out: list[str] = []
    found = False
    i = 0
    while i < len(argv):
        if argv[i] == name:
            found = True
            i += 1
            continue
        out.append(argv[i])
        i += 1
    return out, found


def _pop_option(argv: list[str], name: str, default: str | None = None) -> tuple[list[str], str | None]:
    out: list[str] = []
    value: str | None = default
    i = 0
    while i < len(argv):
        if argv[i] == name:
            if i + 1 < len(argv):
                value = argv[i + 1]
                i += 2
                continue
        out.append(argv[i])
        i += 1
    return out, value


def _path_after_flag(argv: list[str], flag: str) -> Path | None:
    for i, token in enumerate(argv):
        if token == flag and i + 1 < len(argv):
            return Path(argv[i + 1])
    return None


def main() -> None:
    argv = sys.argv[1:]

    if argv[:1] == ["--apply-only"]:
        from apply_heatmaps_to_site import apply_heatmaps

        parser = argparse.ArgumentParser()
        parser.add_argument("--apply-only", action="store_true")
        parser.add_argument("--league", default="serie-c")
        parser.add_argument("--csv", type=Path, required=True)
        parser.add_argument("--source-dir", type=Path, required=True)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--overwrite", action="store_true")
        args = parser.parse_args(argv)
        apply_heatmaps(args.league, args.csv, args.source_dir, dry_run=args.dry_run, overwrite=args.overwrite)
        return

    argv, apply_site = _pop_flag(argv, "--apply-site")
    argv, dry_run_apply = _pop_flag(argv, "--dry-run-apply")
    argv, league = _pop_option(argv, "--league", "serie-c")

    csv_for_apply = _path_after_flag(argv, "--csv")
    source_for_apply = _path_after_flag(argv, "--output-dir") or Path("./HeatmapsBR26")

    sys.argv = [sys.argv[0], *argv]
    from onlyheatmaps import main as heatmaps_main

    heatmaps_main()

    if apply_site:
        from apply_heatmaps_to_site import apply_heatmaps

        if not csv_for_apply:
            raise SystemExit("--apply-site exige --csv")
        print(f"\nAplicando heatmaps no site ({league or 'serie-c'})…", flush=True)
        apply_heatmaps(
            league or "serie-c",
            csv_for_apply,
            source_for_apply,
            dry_run=dry_run_apply,
        )


if __name__ == "__main__":
    main()
