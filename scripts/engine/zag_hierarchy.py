"""Semantic K=3 archetype clustering for Serie A zagueiros (Wyscout + SofaScore)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .sofascore import SS_PATH, SS_STAT_COLS, aggregate_sofascore, match_ss_row

ARCHETYPE_LABELS = ("Rebatedor", "Construtor", "Agressivo")

# Primary type when no axis clearly dominates (top share below cutoff).
HYBRID_TOP_SHARE_CUTOFF = 45.0
# Minimum gap (pp) between top two shares to avoid hybrid flag.
HYBRID_GAP_CUTOFF = 12.0
# Down-weight rebatedor score when PTF is above pool median (avoids false positives).
REBATEDOR_PTF_PENALTY = 0.65


def _build_feature_row(wy_row: pd.Series, ss_row: pd.Series | None) -> dict[str, float]:
    total = float(wy_row.get("Passes/90") or wy_row.get("Passe") or 0)
    share_long = float(wy_row.get("Passes longos/90") or wy_row.get("PassesLongos") or 0) / total if total else 0.0
    share_prog = float(wy_row.get("Passes progressivos/90") or wy_row.get("PassesProg") or 0) / total if total else 0.0
    feats = {
        "duelos_def": float(wy_row.get("DuelosDef") or 0),
        "duelos_aereos": float(wy_row.get("DuelosAr") or 0),
        "passes_terco_final": float(wy_row.get("PTF") or 0),
        "conducao_prog": float(wy_row.get("Cond.Prog") or 0),
        "duelos_ofensivos": float(wy_row.get("DuelosOf") or 0),
        "share_long": share_long,
        "share_prog": share_prog,
        "passes_total_p90": total,
    }
    for col in SS_STAT_COLS:
        key = f"{col}_p90"
        feats[key] = float(ss_row[f"{col}_p90"]) if ss_row is not None else float(wy_row.get(key) or 0)
    return feats


def _zscore(series: pd.Series) -> pd.Series:
    std = float(series.std())
    if std == 0:
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def _softmax_shares(scores: np.ndarray) -> np.ndarray:
    """Row-wise softmax → percentage shares summing to 100."""
    shifted = scores - scores.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    weights = exp / exp.sum(axis=1, keepdims=True)
    return weights * 100.0


def _axis_scores(feat_df: pd.DataFrame) -> pd.DataFrame:
    reb = (
        _zscore(feat_df["total_clearance_p90"])
        + _zscore(feat_df["outfielder_block_p90"])
        + _zscore(feat_df["duelos_aereos"])
        + _zscore(feat_df["duelos_def"])
    )
    con = (
        _zscore(feat_df["passes_terco_final"])
        + _zscore(feat_df["passes_total_p90"])
        + _zscore(feat_df["share_prog"])
        + _zscore(feat_df["conducao_prog"])
    )
    agr = (
        _zscore(feat_df["duelos_ofensivos"])
        + _zscore(feat_df["conducao_prog"])
        + _zscore(feat_df["passes_terco_final"])
        + _zscore(feat_df["share_prog"])
    )
    return pd.DataFrame({"Rebatedor": reb, "Construtor": con, "Agressivo": agr}, index=feat_df.index)


def _classify_archetypes(feat_df: pd.DataFrame) -> pd.DataFrame:
    axis = _axis_scores(feat_df)
    ptf_median = float(feat_df["passes_terco_final"].median())

    adjusted = axis.copy()
    high_ptf = feat_df["passes_terco_final"] >= ptf_median
    adjusted.loc[high_ptf, "Rebatedor"] *= REBATEDOR_PTF_PENALTY

    share_matrix = _softmax_shares(adjusted.to_numpy())
    shares = pd.DataFrame(share_matrix, columns=ARCHETYPE_LABELS, index=feat_df.index)

    primaries: list[str] = []
    hybrids: list[bool] = []
    for idx in feat_df.index:
        row_shares = shares.loc[idx].sort_values(ascending=False)
        top = str(row_shares.index[0])
        top_val = float(row_shares.iloc[0])
        second_val = float(row_shares.iloc[1])
        gap = top_val - second_val
        is_hybrid = top_val < HYBRID_TOP_SHARE_CUTOFF or gap < HYBRID_GAP_CUTOFF
        primaries.append(top)
        hybrids.append(is_hybrid)

    return pd.DataFrame(
        {
            "cluster_archetype": primaries,
            "cluster_is_hybrid": hybrids,
            "cluster_share_rebatedor": shares["Rebatedor"].round(1),
            "cluster_share_construtor": shares["Construtor"].round(1),
            "cluster_share_agressivo": shares["Agressivo"].round(1),
        },
        index=feat_df.index,
    )


def apply_zag_hierarchical_clusters(pool: pd.DataFrame) -> pd.DataFrame:
    """Add cluster_archetype, hybrid flag and per-axis share columns."""
    out = pool.copy()
    empty_cols = {
        "cluster_archetype": None,
        "cluster_is_hybrid": None,
        "cluster_share_rebatedor": None,
        "cluster_share_construtor": None,
        "cluster_share_agressivo": None,
    }
    if not SS_PATH.exists():
        for col, default in empty_cols.items():
            out[col] = default
        return out

    ss = aggregate_sofascore(SS_PATH)
    feature_rows: list[dict[str, float]] = []
    for _, row in out.iterrows():
        if float(row.get("interception_won_p90") or 0) > 0 or float(row.get("total_clearance_p90") or 0) > 0:
            ss_hit = {
                "interception_won_p90": row["interception_won_p90"],
                "total_clearance_p90": row["total_clearance_p90"],
                "outfielder_block_p90": row.get("outfielder_block_p90", 0),
                "ball_recovery_p90": row.get("ball_recovery_p90", 0),
            }
            feature_rows.append(_build_feature_row(row, pd.Series(ss_hit)))
        else:
            ss_hit = match_ss_row(row, ss)
            feature_rows.append(_build_feature_row(row, ss_hit))

    feat_df = pd.DataFrame(feature_rows, index=out.index)
    classified = _classify_archetypes(feat_df)
    for col in classified.columns:
        out[col] = classified[col]
    return out
