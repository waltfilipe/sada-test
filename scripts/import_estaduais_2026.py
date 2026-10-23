#!/usr/bin/env python3
"""Merge Wyscout estaduais 2026 exports into site inputs and Estaduais 26.xlsx."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from engine.load_data import (  # noqa: E402
    _alias_wyscout_columns,
    _dedupe_columns,
    _dedupe_players,
    _map_wyscout_position,
    _read_wyscout_frame,
)
from engine.measures import attach_base_measures  # noqa: E402
from engine.wyscout_i18n import rename_english_wyscout_columns  # noqa: E402

UPLOAD_DIR = Path("/home/ubuntu/.cursor/projects/workspace/uploads")
WYSCOUT_OUT = ROOT / "wyscout" / "2026"
WORKBOOK = ROOT / "Estaduais 26.xlsx"
CHUNK_SIZE = 500


def _upload_files() -> list[Path]:
    paths = sorted(UPLOAD_DIR.glob("Search_results__*.xlsx"))
    if not paths:
        raise FileNotFoundError(f"Nenhum export em {UPLOAD_DIR}")

    def sort_key(path: Path) -> int:
        match = re.search(r"__\d+__", path.name)
        if not match:
            return 0
        # filename pattern Search_results__10__4282.xlsx — use leading number after first __
        parts = path.stem.split("__")
        for part in parts:
            if part.isdigit():
                return int(part)
        return 0

    return sorted(paths, key=sort_key)


def load_merged_estaduais() -> pd.DataFrame:
    frames = []
    for path in _upload_files():
        frame = _read_wyscout_frame(path)
        if frame is not None and len(frame):
            frames.append(frame)
    if not frames:
        raise RuntimeError("Exports estaduais vazios.")

    df = _dedupe_players(pd.concat(frames, ignore_index=True))
    df = _dedupe_columns(df)
    mapped = [_map_wyscout_position(v) for v in df.get("Posição", [])]
    df["Posição"] = mapped
    df = df[df["Posição"].notna()].copy()
    df = _alias_wyscout_columns(df)
    return df.reset_index(drop=True)


def _tb_sheet(df: pd.DataFrame) -> pd.DataFrame:
    """Formato alinhado ao Tb_SerieC25 do Power BI + colunas de Medidas."""
    out = df.copy()
    if "Equipe" not in out.columns and "Equipa" in out.columns:
        out = out.rename(columns={"Equipa": "Equipe"})
    period = "Equipa dentro de um período de tempo seleccionado"
    if period in out.columns:
        blank = out["Equipe"].isna() | (out["Equipe"].astype(str).str.strip() == "")
        out.loc[blank, "Equipe"] = out.loc[blank, period]
    measured = attach_base_measures(out)
    return measured


def write_wyscout_parts(raw: pd.DataFrame) -> list[Path]:
    WYSCOUT_OUT.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    total = len(raw)
    part = 1
    for start in range(0, total, CHUNK_SIZE):
        chunk = raw.iloc[start : start + CHUNK_SIZE].copy()
        chunk = rename_english_wyscout_columns(chunk)
        n = len(chunk)
        path = WYSCOUT_OUT / f"estaduais-pt{part}.xlsx"
        sheet = f"Search results ({n})"
        chunk.to_excel(path, sheet_name=sheet, index=False)
        written.append(path)
        part += 1
    return written


def write_workbook(raw: pd.DataFrame, tb: pd.DataFrame) -> None:
    n = len(raw)
    with pd.ExcelWriter(WORKBOOK, engine="openpyxl") as writer:
        raw.to_excel(writer, sheet_name=f"Search results ({n})", index=False)
        tb.to_excel(writer, sheet_name="Tb_Estaduais26", index=False)


def main() -> None:
    raw = load_merged_estaduais()
    tb = _tb_sheet(raw)
    parts = write_wyscout_parts(raw)
    write_workbook(raw, tb)
    print(f"Jogadores únicos: {len(raw)}")
    print(f"Partes Wyscout: {len(parts)} → {WYSCOUT_OUT}/estaduais-pt*.xlsx")
    print(f"Planilha: {WORKBOOK} (Search results + Tb_Estaduais26 com Medidas)")


if __name__ == "__main__":
    main()
