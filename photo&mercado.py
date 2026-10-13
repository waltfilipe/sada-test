#!/usr/bin/env python3
"""Atalho local — mesmo programa que scripts/fetch_sofascore_photos.py.

Use no VS Code (Run/Debug) ou no terminal, sempre com a pasta do repo como cwd.
"""

from __future__ import annotations

import runpy
from pathlib import Path

if __name__ == "__main__":
    script = Path(__file__).resolve().parent / "allmatch" / "photo&mercado.py"
    runpy.run_path(str(script), run_name="__main__")
