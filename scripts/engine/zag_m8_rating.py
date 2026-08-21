"""M8 zagueiro rating — composite axis scores, profile weights, shrinkage and tanh nota."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from .normalize import rank_players

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

SCORE_COLS = ["duelos_def", "duelos_ar", "passes_prog", "passes_long", "eficiencia_def"]

ARCHETYPE_WEIGHTS: dict[str, dict[str, float]] = {
    "Construtor": {
        "passes_prog": 0.35,
        "passes_long": 0.35,
        "duelos_def": 0.10,
        "duelos_ar": 0.10,
        "eficiencia_def": 0.10,
    },
    "Combativo": {
        "passes_prog": 0.10,
        "passes_long": 0.10,
        "duelos_def": 0.50,
        "duelos_ar": 0.10,
        "eficiencia_def": 0.20,
    },
    "Defensor de Área": {
        "passes_prog": 0.10,
        "passes_long": 0.10,
        "duelos_def": 0.20,
        "duelos_ar": 0.30,
        "eficiencia_def": 0.30,
    },
}

ARCHETYPE_SLUGS = {
    "Construtor": "construtor",
    "Combativo": "combativo",
    "Defensor de Área": "defensor_area",
}

SHRINK_MU = 50.0
SHRINK_EXP = 0.65
NOTA_MU = 6.5
NOTA_SCALE = 1.85
NOTA_TAU = 2.5


def _shrink(raw: float, pct_minutes: float) -> float:
    w = min(1.0, float(pct_minutes) ** SHRINK_EXP)
    return SHRINK_MU + w * (float(raw) - SHRINK_MU)


def _weighted_raw(row: pd.Series, weights: dict[str, float]) -> float:
    return float(sum(float(row[col]) * weights[col] for col in SCORE_COLS))


def _tanh_nota(series: pd.Series) -> pd.Series:
    mu = float(series.mean())
    sig = float(series.std())
    if sig == 0:
        return pd.Series(NOTA_MU, index=series.index)
    z = (series - mu) / (sig * NOTA_TAU)
    return NOTA_MU + NOTA_SCALE * np.tanh(z)


def _tanh_nota_by_archetype(m8_final: pd.Series, archetypes: pd.Series) -> pd.Series:
    """Tanh calibrated within each primary-archetype group (mean nota = 6.5 per group)."""
    out = pd.Series(index=m8_final.index, dtype=float)
    for archetype in ARCHETYPE_WEIGHTS:
        mask = archetypes == archetype
        if not mask.any():
            continue
        out.loc[mask] = _tanh_nota(m8_final.loc[mask])
    remaining = out.isna()
    if remaining.any():
        out.loc[remaining] = _tanh_nota(m8_final.loc[remaining])
    return out


def apply_zag_m8_ratings(out: pd.DataFrame) -> pd.DataFrame:
    """Attach M8 scores and tanh notes to a zagueiro engine pool."""
    from zag_composite_rating import build_axis_scores_for_pool

    scores = build_axis_scores_for_pool(out)
    merged = out.merge(scores, on="player_id", how="left", suffixes=("", "_axis"))
    for col in SCORE_COLS:
        if f"{col}_axis" in merged.columns:
            merged[col] = merged[f"{col}_axis"].combine_first(merged.get(col))
            merged = merged.drop(columns=[f"{col}_axis"])
        merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(50.0)

    archetype = merged["cluster_archetype"].fillna("Defensor de Área")

    for arch, weights in ARCHETYPE_WEIGHTS.items():
        slug = ARCHETYPE_SLUGS[arch]
        raw_col = f"m8_raw_{slug}"
        final_col = f"m8_final_{slug}"
        nota_col = f"nota_{slug}"
        merged[raw_col] = merged.apply(lambda row, w=weights: _weighted_raw(row, w), axis=1)
        merged[final_col] = merged.apply(lambda row, c=raw_col: _shrink(row[c], row["%Minutos"]), axis=1)
        merged[nota_col] = _tanh_nota(merged[final_col])

    merged["m8_raw"] = merged.apply(
        lambda row: _weighted_raw(row, ARCHETYPE_WEIGHTS.get(str(row["cluster_archetype"]), ARCHETYPE_WEIGHTS["Defensor de Área"])),
        axis=1,
    )
    merged["m8_final"] = merged.apply(lambda row: _shrink(row["m8_raw"], row["%Minutos"]), axis=1)
    merged["nota_perfil"] = _tanh_nota_by_archetype(merged["m8_final"], archetype).round(2)
    merged["nota_global"] = _tanh_nota(merged["m8_final"]).round(2)

    merged["rating_geral"] = merged["nota_perfil"].round(1)
    merged["rating_perfil"] = merged["nota_perfil"].round(1)
    merged["rank_geral"] = rank_players(merged["rating_geral"])
    merged["rank_perfil"] = rank_players(merged["rating_perfil"])

    return merged
