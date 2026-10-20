"""Aggregate SofaScore Run (GPS) CSV and attach to site player payloads."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .normalize import percentile_rank
from .sofascore_heatmap import build_sofascore_player_map

ROOT = Path(__file__).resolve().parents[2]
RUN_PATH = ROOT / "BR26_run.csv"

RUN_SUM_COLS = [
    "kilometers_covered",
    "number_of_sprints",
    "meters_covered_running_km",
    "meters_covered_high_speed_running_km",
    "meters_covered_sprinting_km",
]

METRIC_KEYS = [
    "kilometers_p90",
    "top_speed",
    "sprints_p90",
    "running_km_p90",
    "high_speed_km_p90",
    "sprinting_km_p90",
]

MIN_POOL_MINUTES = 270


def aggregate_sofascore_run(path: Path | None = None) -> pd.DataFrame:
    csv_path = path or RUN_PATH
    raw = pd.read_csv(csv_path)
    raw = raw[raw["minutes_played"] > 0].copy()
    raw["team"] = np.where(raw["is_home"], raw["home_team"], raw["away_team"])

    agg_dict: dict[str, tuple[str, str]] = {
        "minutes_played": ("minutes_played", "sum"),
        "matches": ("event_id", "nunique"),
        "top_speed": ("top_speed", "max"),
    }
    for col in RUN_SUM_COLS:
        agg_dict[col] = (col, "sum")

    team_minutes = (
        raw.groupby(["player_id", "team"], as_index=False)["minutes_played"]
        .sum()
        .sort_values("minutes_played", ascending=False)
    )
    primary_team = team_minutes.drop_duplicates("player_id").set_index("player_id")["team"]

    players = raw.groupby(["player_id", "player_name"], as_index=False).agg(**agg_dict)
    players["primary_team"] = players["player_id"].map(primary_team)

    mins = players["minutes_played"].astype(float)
    factor = np.where(mins > 0, 90.0 / mins, 0.0)
    players["kilometers_p90"] = players["kilometers_covered"] * factor
    players["sprints_p90"] = players["number_of_sprints"] * factor
    players["running_km_p90"] = players["meters_covered_running_km"] * factor
    players["high_speed_km_p90"] = players["meters_covered_high_speed_running_km"] * factor
    players["sprinting_km_p90"] = players["meters_covered_sprinting_km"] * factor
    return players


def _rank_in_pool(values: pd.Series) -> pd.Series:
    ranks = values.rank(method="min", ascending=False)
    total = int(values.notna().sum())
    if total <= 1:
        return pd.Series(1, index=values.index, dtype="Int64")
    return ranks.astype("Int64")


def attach_physical_run_to_players(
    players: list[dict[str, Any]],
    raw_df: pd.DataFrame,
    *,
    defensive_csv: Path,
    run_csv: Path | None = None,
) -> int:
    """Merge run/GPS stats + position percentiles into each player dict. Returns match count."""
    run_path = run_csv or RUN_PATH
    if not run_path.is_file():
        print(f"  Run CSV ausente ({run_path.name}) — GPS omitido.")
        return 0

    ss_run = aggregate_sofascore_run(run_path)
    ss_by_id = ss_run.set_index("player_id", drop=False)
    ss_map = build_sofascore_player_map(raw_df, defensive_csv)

    rows: list[dict[str, Any]] = []
    for player in players:
        site_id = str(player["player_id"])
        link = ss_map.get(site_id)
        if not link:
            continue
        ss_id = int(link["sofascore_player_id"])
        if ss_id not in ss_by_id.index:
            continue
        hit = ss_by_id.loc[ss_id]
        if isinstance(hit, pd.DataFrame):
            hit = hit.iloc[0]
        minutes = float(hit["minutes_played"] or 0)
        if minutes <= 0:
            continue
        rows.append(
            {
                "player_id": site_id,
                "position": str(player.get("position") or ""),
                "matches": int(hit["matches"] or 0),
                "minutes": int(round(minutes)),
                "kilometers_p90": float(hit["kilometers_p90"] or 0),
                "top_speed": float(hit["top_speed"] or 0),
                "sprints_p90": float(hit["sprints_p90"] or 0),
                "running_km_p90": float(hit["running_km_p90"] or 0),
                "high_speed_km_p90": float(hit["high_speed_km_p90"] or 0),
                "sprinting_km_p90": float(hit["sprinting_km_p90"] or 0),
            }
        )

    if not rows:
        return 0

    frame = pd.DataFrame(rows)
    pool = frame[frame["minutes"] >= MIN_POOL_MINUTES].copy()
    percentiles = pd.DataFrame(index=frame.index)
    ranks = pd.DataFrame(index=frame.index)
    for key in METRIC_KEYS:
        pct_col = f"pct_{key}"
        rank_col = f"rank_{key}"
        percentiles[pct_col] = np.nan
        ranks[rank_col] = pd.NA
        for position, group in pool.groupby("position"):
            idx = group.index
            percentiles.loc[idx, pct_col] = percentile_rank(group[key], ascending=True)
            ranks.loc[idx, rank_col] = _rank_in_pool(group[key])

    pool_sizes = pool.groupby("position").size().to_dict()

    attached = 0
    for player in players:
        site_id = str(player["player_id"])
        match = frame[frame["player_id"] == site_id]
        if match.empty:
            player.pop("physical_run", None)
            continue
        idx = match.index[0]
        row = match.iloc[0]
        position = str(row["position"])
        pool_size = int(pool_sizes.get(position, 0))
        pct: dict[str, float] = {}
        rank: dict[str, int] = {}
        for key in METRIC_KEYS:
            pct_val = percentiles.loc[idx, f"pct_{key}"]
            rank_val = ranks.loc[idx, f"rank_{key}"]
            if pd.notna(pct_val):
                pct[key] = round(float(pct_val), 1)
            if pd.notna(rank_val):
                rank[key] = int(rank_val)

        player["physical_run"] = {
            "source": "sofascore_run",
            "competition": "Brasileirão Série A",
            "position_pool": position,
            "position_pool_size": pool_size,
            "matches": int(row["matches"]),
            "minutes": int(row["minutes"]),
            "kilometers_p90": round(float(row["kilometers_p90"]), 2),
            "top_speed": round(float(row["top_speed"]), 2),
            "sprints_p90": round(float(row["sprints_p90"]), 2),
            "running_km_p90": round(float(row["running_km_p90"]), 2),
            "high_speed_km_p90": round(float(row["high_speed_km_p90"]), 2),
            "sprinting_km_p90": round(float(row["sprinting_km_p90"]), 2),
            "percentiles": pct,
            "ranks": rank,
        }
        attached += 1

    return attached
