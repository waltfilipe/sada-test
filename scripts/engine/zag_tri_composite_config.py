"""Tri-composite rating configuration for zagueiros."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from .tri_composite_rating import (
    MetricScoresBuilder,
    ProfileCompositeSpec,
    TriCompositeFamilyConfig,
    TriCompositeRatingParams,
    apply_tri_composite_ratings,
)

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

# Order: duelos_def, duelos_ar, def_acoes, passes_prog, passes_long
ZAG_METRIC_COLS: tuple[str, ...] = (
    "duelos_def",
    "duelos_ar",
    "def_acoes",
    "passes_prog",
    "passes_long",
)

ZAG_PROFILES: tuple[ProfileCompositeSpec, ...] = (
    ProfileCompositeSpec(
        slug="construtor",
        archetype_label="Construtor",
        nota_col="nota_construtor",
        share_col="cluster_share_construtor",
        raw_col="comp_construtor_raw",
        metric_cols=ZAG_METRIC_COLS,
        metric_weights=(0.05, 0.05, 0.10, 0.35, 0.35),
    ),
    ProfileCompositeSpec(
        slug="defensor_area",
        archetype_label="Defensor de Área",
        nota_col="nota_defensor_area",
        share_col="cluster_share_defensor_area",
        raw_col="comp_defensor_area_raw",
        metric_cols=ZAG_METRIC_COLS,
        metric_weights=(0.10, 0.35, 0.35, 0.10, 0.10),
    ),
    ProfileCompositeSpec(
        slug="combativo",
        archetype_label="Combativo",
        nota_col="nota_combativo",
        share_col="cluster_share_combativo",
        raw_col="comp_combativo_raw",
        metric_cols=ZAG_METRIC_COLS,
        metric_weights=(0.50, 0.10, 0.10, 0.15, 0.15),
    ),
)

ZAGUEIRO_TRI_COMPOSITE_CONFIG = TriCompositeFamilyConfig(
    family_key="zagueiros",
    profiles=ZAG_PROFILES,
    params=TriCompositeRatingParams(
        shrink_exp=0.45,
        nota_from_shrunk_linear=True,
        nota_linear_scale=0.045,
        specialty_floor=True,
    ),
    geral_metric_cols=ZAG_METRIC_COLS,
    geral_metric_weights=(0.20, 0.20, 0.20, 0.20, 0.20),
)


def build_zag_metric_scores(pool: pd.DataFrame) -> pd.DataFrame:
    from zag_composite_rating import build_tri_composite_metric_scores

    return build_tri_composite_metric_scores(pool)


def apply_zag_tri_composite_ratings(pool: pd.DataFrame) -> pd.DataFrame:
    return apply_tri_composite_ratings(
        pool,
        ZAGUEIRO_TRI_COMPOSITE_CONFIG,
        build_zag_metric_scores,
    )
