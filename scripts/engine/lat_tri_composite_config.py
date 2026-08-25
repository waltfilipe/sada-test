"""Tri-composite rating configuration for laterais (stub — metrics TBD).

Structure mirrors zagueiros so ``apply_lat_tri_composite_ratings`` can replace the
legacy percentile geral in ``_compute_lat_indices`` once lateral composite metrics
are defined.
"""

from __future__ import annotations

import pandas as pd

from .tri_composite_rating import (
    MetricScoresBuilder,
    ProfileCompositeSpec,
    TriCompositeFamilyConfig,
    TriCompositeRatingParams,
    apply_tri_composite_ratings,
)

LAT_PROFILES: tuple[ProfileCompositeSpec, ...] = (
    ProfileCompositeSpec(
        slug="defensivo",
        archetype_label="Defensivo",
        nota_col="nota_defensivo",
        share_col="cluster_share_defensivo",
        raw_col="comp_defensivo_raw",
        metric_cols=(),  # fill when lateral composite metrics are built
    ),
    ProfileCompositeSpec(
        slug="construtor",
        archetype_label="Construtor",
        nota_col="nota_construtor",
        share_col="cluster_share_construtor",
        raw_col="comp_construtor_raw",
        metric_cols=(),
    ),
    ProfileCompositeSpec(
        slug="ofensivo",
        archetype_label="Ofensivo",
        nota_col="nota_ofensivo",
        share_col="cluster_share_ofensivo",
        raw_col="comp_ofensivo_raw",
        metric_cols=(),
    ),
)

LATERAL_TRI_COMPOSITE_CONFIG = TriCompositeFamilyConfig(
    family_key="laterais",
    profiles=LAT_PROFILES,
    params=TriCompositeRatingParams(geral_alpha=0.25),
)


def build_lat_metric_scores(pool: pd.DataFrame) -> pd.DataFrame:
    """Build lateral tri-composite metric scores — not implemented yet."""
    raise NotImplementedError(
        "Lateral tri-composite metrics are not defined yet. "
        "Implement build_lat_tri_composite_metric_scores and wire metric_cols in LAT_PROFILES."
    )


def apply_lat_tri_composite_ratings(pool: pd.DataFrame) -> pd.DataFrame:
    return apply_tri_composite_ratings(
        pool,
        LATERAL_TRI_COMPOSITE_CONFIG,
        build_lat_metric_scores,
    )
