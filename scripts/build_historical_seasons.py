#!/usr/bin/env python3
"""Build static JSON snapshots for past Brasileirão seasons (Wyscout xlsx)."""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from build_site_data import build_league  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
HIST = ROOT / "wyscout" / "historical"

SNAPSHOTS: list[tuple[str, str, Path]] = [
    ("serie-a", "2025", HIST / "serie-a-2025.xlsx"),
    ("serie-a", "2024", HIST / "serie-a-2024.xlsx"),
    ("serie-a", "2023", HIST / "serie-a-2023.xlsx"),
    ("serie-a", "2022", HIST / "serie-a-2022.xlsx"),
    ("serie-b", "2025", HIST / "serie-b-2025.xlsx"),
    ("serie-b", "2024", HIST / "serie-b-2024.xlsx"),
    ("serie-b", "2023", HIST / "serie-b-2023.xlsx"),
    ("serie-b", "2022", HIST / "serie-b-2022.xlsx"),
    ("serie-c", "2025", HIST / "serie-c-2025.xlsx"),
    ("serie-c", "2024", HIST / "serie-c-2024.xlsx"),
    ("serie-c", "2023", HIST / "serie-c-2023.xlsx"),
    ("serie-c", "2022", HIST / "serie-c-2022.xlsx"),
]


SOFASCORE_CSV: dict[tuple[str, str], Path] = {
    ("serie-a", "2024"): ROOT / "BRA24_defensive.csv",
    ("serie-a", "2025"): ROOT / "BRA25_defensive.csv",
    ("serie-b", "2024"): ROOT / "BRB24_defensive.csv",
    ("serie-b", "2025"): ROOT / "BRB25_defensive.csv",
    ("serie-c", "2025"): ROOT / "BRC25_defensive.csv",
}

HEATMAPS_DIR: dict[tuple[str, str], Path] = {
    ("serie-a", "2024"): ROOT / "HeatmapsBRA24",
    ("serie-a", "2025"): ROOT / "HeatmapsBRA25",
    ("serie-c", "2025"): ROOT / "HeatmapsBRC25",
}


def main() -> None:
    for league_id, year, xlsx in SNAPSHOTS:
        if not xlsx.is_file():
            print(f"skip missing {xlsx}")
            continue
        defensive_csv = SOFASCORE_CSV.get((league_id, year))
        heatmaps_dir = HEATMAPS_DIR.get((league_id, year))
        out_dir = ROOT / "data" / league_id / "seasons" / year
        print(f"\n=== {league_id} {year} → {out_dir} ===")
        build_league(
            league_id,
            out_dir=out_dir,
            xlsx_override=[xlsx],
            season_label=year,
            skip_heatmaps=heatmaps_dir is None,
            skip_physical_run=True,
            skip_transfermarkt=True,
            skip_sofascore=defensive_csv is None,
            skip_profiles_dir=True,
            prefer_period_club=True,
            defensive_csv_override=defensive_csv,
            heatmaps_source_dir=heatmaps_dir,
        )


if __name__ == "__main__":
    main()
