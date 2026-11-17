"""Freeze distribution moments on a qualified sample while still scoring everyone.

Site percentiles, z-scores and archetype thresholds use the players above the
minutes line. Everyone else is placed on that same scale, so a short sample
does not move the players who were already in the pool.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar

import numpy as np
import pandas as pd

_reference_index: ContextVar[pd.Index | None] = ContextVar("reference_index", default=None)


@contextmanager
def reference_pool(index: pd.Index):
    token = _reference_index.set(pd.Index(index))
    try:
        yield
    finally:
        _reference_index.reset(token)


def reference_mask(index: pd.Index) -> pd.Series:
    ref = _reference_index.get()
    if ref is None:
        return pd.Series(True, index=index)
    return pd.Series(index.isin(ref), index=index)


def distribution(series: pd.Series) -> pd.Series:
    """Rows that define the mean, spread and percentile scale.

    Falls back to the whole series when no reference is active, or when this
    series does not share that index.
    """
    ref = _reference_index.get()
    if ref is None or len(series) == 0:
        return series
    sample = series.loc[series.index.isin(ref)]
    if len(sample) < 2:
        return series
    return sample


def zscore_against(
    series: pd.Series,
    *,
    ddof: int = 1,
    center: str = "mean",
    clip: float | None = None,
    fillna: float | None = None,
) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    if fillna is not None:
        values = values.fillna(fillna)
    sample = distribution(values)
    center_value = float(sample.mean() if center == "mean" else sample.median())
    sigma = float(sample.std(ddof=ddof))
    if sigma <= 1e-12 or np.isnan(sigma):
        return pd.Series(0.0, index=series.index)
    scored = (values - center_value) / sigma
    if clip is not None:
        scored = scored.clip(-clip, clip)
    return scored


def zscore_by_season(series: pd.Series, seasons: pd.Series | None) -> pd.Series:
    """Z-score dentro de cada temporada, sobre a amostra qualificada daquele ano.

    As métricas defensivas do SofaScore mudaram de definição entre gerações de
    scrape (total_clearance/90 saltou ~40% nos exports de 2025-26 enquanto
    ball_recovery caiu), então um z pooled sobre pools multi-ano de estaduais
    infla sistematicamente as temporadas recentes. Normalizar por temporada
    mantém o pool multi-ano comparável. Com uma única temporada no pool cai
    no z pooled normal.
    """
    values = pd.to_numeric(series, errors="coerce").fillna(0.0)
    if seasons is None:
        return zscore_against(values)
    seasons = seasons.reindex(values.index)
    if seasons.nunique(dropna=True) < 2:
        return zscore_against(values)
    scored = values.groupby(seasons).transform(zscore_against)
    return scored.fillna(0.0)
