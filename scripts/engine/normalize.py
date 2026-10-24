from __future__ import annotations

import numpy as np
import pandas as pd

from .pool_reference import distribution


def numeric_col(pool: pd.DataFrame, col: str, default: float = 0.0) -> pd.Series:
    if col not in pool.columns:
        return pd.Series(default, index=pool.index, dtype=float)
    return pd.to_numeric(pool[col], errors="coerce").fillna(default)


def _percentile_rank_raw(values: pd.Series, ascending: bool) -> pd.Series:
    if ascending:
        ranks = values.rank(method="dense", ascending=True)
        max_rank = ranks.max()
    else:
        ranks = values.rank(method="min", ascending=False)
        max_rank = ranks.max()
    if max_rank <= 1:
        return pd.Series(100.0, index=values.index)
    return ((ranks - 1) / (max_rank - 1)) * 100


def _percentile_rank_against(values: pd.Series, sample: pd.Series, ascending: bool) -> pd.Series:
    """Same rank formula as the raw pool, with the scale taken from `sample`."""
    sample_num = pd.to_numeric(sample, errors="coerce").dropna()
    vals = pd.to_numeric(values, errors="coerce")
    if sample_num.empty:
        return _percentile_rank_raw(vals, ascending)
    if ascending:
        uniq = np.sort(sample_num.unique())
        max_rank = float(len(uniq))
        if max_rank <= 1:
            return pd.Series(100.0, index=values.index)
        arr = vals.to_numpy(dtype=float)
        ranks = np.empty(len(arr), dtype=float)
        for i, value in enumerate(arr):
            if np.isnan(value):
                ranks[i] = np.nan
            else:
                ranks[i] = float(np.searchsorted(uniq, value, side="left") + 1)
    else:
        sample_np = sample_num.to_numpy(dtype=float)
        max_rank = float(sample_num.rank(method="min", ascending=False).max())
        if max_rank <= 1:
            return pd.Series(100.0, index=values.index)
        arr = vals.to_numpy(dtype=float)
        ranks = np.empty(len(arr), dtype=float)
        for i, value in enumerate(arr):
            if np.isnan(value):
                ranks[i] = np.nan
            else:
                ranks[i] = 1.0 + float(np.sum(sample_np > value))
    pct = (ranks - 1) / (max_rank - 1) * 100
    return pd.Series(np.clip(pct, 0, 100), index=values.index)


def percentile_rank(series: pd.Series, ascending: bool = True) -> pd.Series:
    values = series.astype(float)
    sample = distribution(values)
    if sample.index.equals(values.index):
        return _percentile_rank_raw(values, ascending)
    return _percentile_rank_against(values, sample, ascending)


def rank_desc_normalized(series: pd.Series) -> pd.Series:
    ranks = series.rank(method="min", ascending=False)
    total = len(series)
    if total <= 1:
        return pd.Series(100.0, index=series.index)
    return ((total - ranks) / (total - 1)) * 100


def zscore(value: float, pool: pd.Series, clip: float = 2.0) -> float:
    sample = distribution(pool)
    med = float(sample.median())
    std = float(sample.std(ddof=1))
    if not std:
        return 0.0
    z = (value - med) / std
    return float(max(min(z, clip), -clip))


def composite_z(
    values: list[float],
    pools: list[pd.Series],
    weights: list[float],
    clip: float = 2.0,
) -> float:
    total = 0.0
    for value, pool, weight in zip(values, pools, weights):
        total += zscore(value, pool, clip=clip) * weight
    return total


def apply_bonus(base: float) -> float:
    if base > 90:
        return base * 1.10
    if base > 80:
        return base * 1.05
    return base


def normalize_rating_component(base: float) -> float:
    return 5 + apply_bonus(base) * 0.045


def rank_players(series: pd.Series) -> pd.Series:
    return series.rank(method="min", ascending=False).astype(int)


def zscore_linear_100(series: pd.Series, spread: float = 15.0) -> pd.Series:
    """Map pool values to 0–100 via z-score (50 = mean), preserving rank order."""
    values = series.astype(float)
    sample = distribution(values)
    std = float(sample.std(ddof=1))
    if not std:
        return pd.Series(50.0, index=series.index)
    z = (values - sample.mean()) / std
    return (50 + z * spread).clip(0, 100)
