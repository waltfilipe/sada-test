#!/usr/bin/env python3
"""Foto + valor de mercado (SofaScore) — rode a partir da pasta do repo.

Equivalente a scripts/fetch_sofascore_photos.py, com caminhos pensados para allmatch/.

Exemplo Série C (Chrome CDP na 9222, uma linha):
  python -u allmatch/photo&mercado.py --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv --output ./allmatch/BRC26_Defensive/photos --transport cdp --cdp-url http://127.0.0.1:9222 --warmup-url "https://www.sofascore.com/football/tournament/brazil/brasileirao-serie-c/1281#id:90642" --resume --rate-limit 0.35 --apply-site --league serie-c

Só aplicar manifest já baixado:
  python -u allmatch/photo&mercado.py --apply-only --csv ./allmatch/BRC26_Defensive/BRC26_defensive.csv --manifest ./allmatch/BRC26_Defensive/photos/manifest.json --league serie-c
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def main() -> None:
    argv = sys.argv[1:]
    if argv[:1] == ["--apply-only"]:
        import argparse
        from apply_sofascore_to_site import apply_manifest

        parser = argparse.ArgumentParser()
        parser.add_argument("--apply-only", action="store_true")
        parser.add_argument("--league", default="serie-c")
        parser.add_argument("--csv", type=Path, required=True)
        parser.add_argument("--manifest", type=Path, required=True)
        parser.add_argument("--dry-run", action="store_true")
        args = parser.parse_args(argv)
        apply_manifest(args.league, args.csv, args.manifest, dry_run=args.dry_run)
        return

    from fetch_sofascore_photos import main as fetch_main

    sys.argv = [sys.argv[0], *argv]
    fetch_main()


if __name__ == "__main__":
    main()
