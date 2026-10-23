from __future__ import annotations

from pathlib import Path
from typing import TypedDict


class LeagueConfig(TypedDict):
    id: str
    label: str
    season: str
    xlsx: list[Path]
    defensive_csv: Path
    heatmaps: bool
    heatmaps_dir: Path | None
    physical_run: bool
    run_csv: Path | None


ROOT = Path(__file__).resolve().parents[2]
WYSCOUT_2026 = ROOT / "wyscout" / "2026"

LEAGUES: dict[str, LeagueConfig] = {
    "serie-a": {
        "id": "serie-a",
        "label": "Série A",
        "season": "2026",
        "xlsx": [WYSCOUT_2026 / "serie-a-pt1.xlsx", WYSCOUT_2026 / "serie-a-pt2.xlsx"],
        "defensive_csv": ROOT / "BR26_defensive.csv",
        "heatmaps": True,
        "heatmaps_dir": ROOT / "HeatmapsBR26",
        "physical_run": True,
        "run_csv": ROOT / "BR26_run.csv",
    },
    "serie-b": {
        "id": "serie-b",
        "label": "Série B",
        "season": "2026",
        "xlsx": [WYSCOUT_2026 / "serie-b-pt1.xlsx", WYSCOUT_2026 / "serie-b-pt2.xlsx"],
        "defensive_csv": ROOT / "BRB26_defensive.csv",
        "heatmaps": True,
        "heatmaps_dir": ROOT / "HeatmapsBRB26",
        "physical_run": False,
        "run_csv": None,
    },
    "serie-c": {
        "id": "serie-c",
        "label": "Série C",
        "season": "2026",
        "xlsx": [WYSCOUT_2026 / "serie-c-pt1.xlsx", WYSCOUT_2026 / "serie-c-pt2.xlsx"],
        "defensive_csv": ROOT / "BRC26_defensive.csv",
        "heatmaps": True,
        "heatmaps_dir": ROOT / "HeatmapsBRC26",
        "physical_run": False,
        "run_csv": None,
    },
    "serie-d": {
        "id": "serie-d",
        "label": "Série D",
        "season": "2026",
        "xlsx": [WYSCOUT_2026 / "serie-d-pt1.xlsx", WYSCOUT_2026 / "serie-d-pt2.xlsx"],
        "defensive_csv": ROOT / "BRD26_defensive.csv",
        "heatmaps": True,
        "heatmaps_dir": ROOT / "HeatmapsBRD26",
        "physical_run": False,
        "run_csv": None,
    },
    "mls-next-pro": {
        "id": "mls-next-pro",
        "label": "MLS Next Pro",
        "season": "2026",
        "xlsx": [WYSCOUT_2026 / "mls-next-pro-pt1.xlsx", WYSCOUT_2026 / "mls-next-pro-pt2.xlsx"],
        "defensive_csv": ROOT / "MLS_NEXT_PRO_defensive.csv",
        "heatmaps": True,
        "heatmaps_dir": ROOT / "HeatmapsMLSN",
        "physical_run": False,
        "run_csv": None,
    },
    "estaduais": {
        "id": "estaduais",
        "label": "Estaduais",
        "season": "2026",
        "xlsx": sorted(WYSCOUT_2026.glob("estaduais-pt*.xlsx")),
        "defensive_csv": ROOT / "BRE26_defensive.csv",
        "heatmaps": False,
        "heatmaps_dir": None,
        "physical_run": False,
        "run_csv": None,
    },
}
