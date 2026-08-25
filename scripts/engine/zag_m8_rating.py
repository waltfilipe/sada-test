"""Zagueiro tri-composite rating — profile metrics, share blend, shrinkage and tanh nota."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from .normalize import rank_players

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

ACTIVE_NOTA_COL = {
    "Construtor": "nota_construtor",
    "Defensor de Área": "nota_defensor_area",
    "Combativo": "nota_combativo",
}

PROFILE_RAW = {
    "construtor": "comp_construtor_raw",
    "defensor_area": "comp_defensor_area_raw",
    "combativo": "comp_combativo_raw",
}

SHRINK_MU = 50.0
SHRINK_EXP = 0.65
NOTA_MU = 6.5
NOTA_SCALE = 1.85
NOTA_TAU = 2.5


def _shrink(raw: float, pct_minutes: float) -> float:
    w = min(1.0, float(pct_minutes) ** SHRINK_EXP)
    return SHRINK_MU + w * (float(raw) - SHRINK_MU)


def _tanh_nota(series: pd.Series) -> pd.Series:
    mu = float(series.mean())
    sig = float(series.std())
    if sig == 0:
        return pd.Series(NOTA_MU, index=series.index)
    z = (series - mu) / (sig * NOTA_TAU)
    return NOTA_MU + NOTA_SCALE * np.tanh(z)


def apply_zag_m8_ratings(out: pd.DataFrame) -> pd.DataFrame:
    """Attach tri-composite profile scores and share-weighted hero rating."""
    from zag_composite_rating import build_tri_composite_metric_scores

    merged = out.merge(build_tri_composite_metric_scores(out), on="player_id", how="left")

    merged["comp_construtor_raw"] = merged[["passes_prog", "passes_long", "ptf_mitigated"]].mean(axis=1)
    merged["comp_defensor_area_raw"] = merged[["duelos_ar", "rebatidas", "eficiencia_def_v2"]].mean(axis=1)
    merged["comp_combativo_raw"] = merged[["duelos_def", "interceptions", "conducao_prog"]].mean(axis=1)

    for slug, raw_col in PROFILE_RAW.items():
        final_col = f"m8_final_{slug}"
        nota_col = f"nota_{slug}"
        merged[final_col] = merged.apply(lambda row, c=raw_col: _shrink(row[c], row["%Minutos"]), axis=1)
        merged[nota_col] = _tanh_nota(merged[final_col]).round(2)

    w_c = merged["cluster_share_construtor"].fillna(0) / 100.0
    w_da = merged["cluster_share_defensor_area"].fillna(0) / 100.0
    w_comb = merged["cluster_share_combativo"].fillna(0) / 100.0
    merged["m8_pre_shrink"] = (
        w_c * merged["comp_construtor_raw"]
        + w_da * merged["comp_defensor_area_raw"]
        + w_comb * merged["comp_combativo_raw"]
    )
    merged["m8_raw"] = merged["m8_pre_shrink"]
    merged["m8_final"] = merged.apply(lambda row: _shrink(row["m8_raw"], row["%Minutos"]), axis=1)
    merged["nota_global"] = _tanh_nota(merged["m8_final"]).round(2)

    def _active_nota(row: pd.Series) -> float:
        arch = row.get("cluster_archetype") or row.get("perfil")
        col = ACTIVE_NOTA_COL.get(str(arch) if pd.notna(arch) else "")
        if col:
            return float(row[col])
        return float(row["nota_global"])

    merged["rating_geral"] = merged["nota_global"].round(1)
    merged["rating_perfil"] = merged.apply(_active_nota, axis=1).round(1)
    merged["rank_geral"] = rank_players(merged["rating_geral"])
    merged["rank_perfil"] = rank_players(merged["rating_perfil"])

    return merged
