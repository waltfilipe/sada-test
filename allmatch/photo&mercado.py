#!/usr/bin/env python3
"""Foto + valor de mercado (SofaScore) — rode a partir da pasta do repo.

Exemplo Série C (Chrome CDP na 9222, uma linha):
  python -u "allmatch/photo&mercado.py" --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv --output ./allmatch/BRC26_Defensive/photos --transport cdp --cdp-url http://127.0.0.1:9222 --warmup-url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" --resume --rate-limit 0.35 --apply-site --league serie-c

Só aplicar manifest já baixado (fotos locais em ./photos → /photos/… no site):
  python -u "allmatch/photo&mercado.py" --apply-only --csv ./BRC26_defensive.csv --manifest ./photos/manifest.json --league serie-c
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
        from apply_sofascore_to_site import apply_manifest

        parser = argparse.ArgumentParser()
        parser.add_argument("--apply-only", action="store_true")
        parser.add_argument("--league", default="serie-c")
        parser.add_argument("--csv", type=Path, required=True)
        parser.add_argument("--manifest", type=Path, required=True)
        parser.add_argument("--photos-dir", type=Path, default=None)
        parser.add_argument("--dry-run", action="store_true")
        args = parser.parse_args(argv)
        photos_dir = args.photos_dir or args.manifest.parent
        if not any(photos_dir.glob("*.jpg")) and (ROOT / "photos").is_dir():
            photos_dir = ROOT / "photos"
        apply_manifest(
            args.league,
            args.csv,
            args.manifest,
            photos_dir=photos_dir,
            dry_run=args.dry_run,
        )
        return

    argv, apply_site = _pop_flag(argv, "--apply-site")
    argv, dry_run_apply = _pop_flag(argv, "--dry-run-apply")
    argv, league = _pop_option(argv, "--league", "serie-c")

    csv_for_apply = _path_after_flag(argv, "--csv")
    output_for_apply = _path_after_flag(argv, "--output") or Path("./sofascore_photos")

    sys.argv = [sys.argv[0], *argv]
    from fetch_sofascore_photos import main as fetch_main

    fetch_main()

    if apply_site:
        from apply_sofascore_to_site import apply_manifest

        if not csv_for_apply:
            raise SystemExit("--apply-site exige --csv")
        manifest = output_for_apply / "manifest.json"
        photos_dir = output_for_apply if any(output_for_apply.glob("*.jpg")) else ROOT / "photos"
        print(f"\nAplicando no site ({league})…", flush=True)
        apply_manifest(
            league or "serie-c",
            csv_for_apply,
            manifest,
            photos_dir=photos_dir,
            dry_run=dry_run_apply,
        )


if __name__ == "__main__":
    main()
