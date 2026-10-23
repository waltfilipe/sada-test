#!/usr/bin/env python3
"""Keep only state-championship rows and the club from that competition.

Wyscout exports mix the player's current club with the club inside the selected
window, and a few files are cups (Copa do Nordeste, Copa Paulista) rather than
the estadual. This writes one workbook per championship, with Equipe set to the
period club and a Campeonato column. Cup files are left out.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from engine.estaduais_championship import (  # noqa: E402
    EXCLUDED_COMPETITIONS,
    detect_estadual_competition,
)

UPLOAD_DIR = Path("/home/ubuntu/.cursor/projects/workspace/uploads")
OUT_DIR = ROOT / "wyscout" / "2026" / "estaduais"
PERIOD = "Equipa dentro de um período de tempo seleccionado"


def _sources() -> list[Path]:
    uploads = sorted(UPLOAD_DIR.glob("Search_results__*.xlsx"), key=lambda path: int(path.name.split("__")[1]))
    if uploads:
        return uploads
    raise FileNotFoundError(f"Exports originais não encontrados em {UPLOAD_DIR}")


def _prepare_frame(path: Path) -> tuple[str, pd.DataFrame] | None:
    df = pd.read_excel(path)
    if PERIOD not in df.columns:
        raise ValueError(f"{path.name} sem coluna do clube no período")
    clubs = df[PERIOD].dropna().astype(str).tolist()
    competition = detect_estadual_competition(clubs)
    if competition is None:
        print(f"  ignorado (sem fingerprint): {path.name}")
        return None
    if competition in EXCLUDED_COMPETITIONS:
        print(f"  fora do estadual ({competition}): {path.name}")
        return None
    out = df.copy()
    period = out[PERIOD].map(lambda value: "" if pd.isna(value) else str(value).strip())
    out = out.loc[period.ne("")].copy()
    period = period.loc[out.index]
    if "Equipa" in out.columns:
        out = out.rename(columns={"Equipa": "Clube atual"})
    out["Equipe"] = period
    out[PERIOD] = period
    out["Campeonato"] = competition
    # Prefer the competition club over the current club in the first columns.
    front = ["Jogador", "Equipe", "Campeonato", PERIOD]
    columns = front + [column for column in out.columns if column not in front]
    out = out[columns]
    out = out.drop_duplicates(subset=["Jogador", "Equipe", "Campeonato"], keep="first")
    print(f"  {competition}: {len(out)} atletas ← {path.name}")
    return competition, out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.xlsx"):
        stale.unlink()
    written = 0
    for path in _sources():
        prepared = _prepare_frame(path)
        if prepared is None:
            continue
        competition, frame = prepared
        target = OUT_DIR / f"{competition}.xlsx"
        frame.to_excel(target, sheet_name=f"Search results ({len(frame)})", index=False)
        written += 1
    if written < 8:
        raise SystemExit(f"Poucas competições gravadas ({written}).")
    print(f"Gravados {written} campeonatos em {OUT_DIR}")


if __name__ == "__main__":
    main()
