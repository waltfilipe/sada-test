"""Semantic archetype tree for Serie A zagueiros (Wyscout + SofaScore)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .sofascore import SS_PATH, SS_STAT_COLS, aggregate_sofascore, match_ss_row

ARCHETYPE_LABELS = ("Rebatedor", "Construtor", "Agressivo")
CONSTRUTOR_SUBTYPE_LABELS = ("Construtor Defensivo", "Construtor Lançador")

# Mean construction z-score above pool → Construtor branch.
CONSTRUCTION_Z_THRESHOLD = 0.25
# M4 = (DD + INT) / (Rebatidas + DA) — contact/reading vs line/aerial.
M4_AGRESSIVO_THRESHOLD = 0.60
# Construtor with high M4 → hybrid (borderline with Agressivo).
M4_CONSTRUTOR_HYBRID_THRESHOLD = 0.75


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


def _construction_z(feat_df: pd.DataFrame) -> pd.Series:
    components = pd.DataFrame(
        {
            "ptf": _zscore(feat_df["passes_terco_final"]),
            "passes": _zscore(feat_df["passes_total_p90"]),
            "share_prog": _zscore(feat_df["share_prog"]),
            "conducao": _zscore(feat_df["conducao_prog"]),
        },
        index=feat_df.index,
    )
    return components.mean(axis=1)


def _m4_ratio(feat_df: pd.DataFrame) -> pd.Series:
    contact = feat_df["duelos_def"] + feat_df["interception_won_p90"]
    line = feat_df["total_clearance_p90"] + feat_df["duelos_aereos"]
    denom = line.replace(0, np.nan)
    return (contact / denom).fillna(0.0)


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


def _construtor_subtype_score(feat_df: pd.DataFrame) -> pd.Series:
    """z(rebatidas) + z(duelos aéreos) + z(tendência longo)."""
    return (
        _zscore(feat_df["total_clearance_p90"])
        + _zscore(feat_df["duelos_aereos"])
        + _zscore(feat_df["share_long"])
    )


def _classify_archetypes(feat_df: pd.DataFrame) -> pd.DataFrame:
    con_z = _construction_z(feat_df)
    m4 = _m4_ratio(feat_df)
    subtype_score = _construtor_subtype_score(feat_df)

    axis = _axis_scores(feat_df)
    share_matrix = _softmax_shares(axis.to_numpy())
    shares = pd.DataFrame(share_matrix, columns=ARCHETYPE_LABELS, index=feat_df.index)

    primaries: list[str] = []
    labels: list[str] = []
    subtypes: list[str | None] = []
    hybrids: list[bool] = []

    for idx in feat_df.index:
        cz = float(con_z.loc[idx])
        m4_val = float(m4.loc[idx])

        if cz >= CONSTRUCTION_Z_THRESHOLD:
            primary = "Construtor"
            is_hybrid = m4_val >= M4_CONSTRUTOR_HYBRID_THRESHOLD
            sub_score = float(subtype_score.loc[idx])
            if sub_score >= 0:
                subtype = CONSTRUTOR_SUBTYPE_LABELS[0]
            else:
                subtype = CONSTRUTOR_SUBTYPE_LABELS[1]
            label = subtype
        elif m4_val >= M4_AGRESSIVO_THRESHOLD:
            primary = "Agressivo"
            is_hybrid = False
            subtype = None
            label = primary
        else:
            primary = "Rebatedor"
            is_hybrid = False
            subtype = None
            label = primary

        primaries.append(primary)
        labels.append(label)
        subtypes.append(subtype)
        hybrids.append(is_hybrid)

    return pd.DataFrame(
        {
            "cluster_archetype": primaries,
            "cluster_archetype_label": labels,
            "cluster_construtor_subtype": subtypes,
            "cluster_is_hybrid": hybrids,
            "cluster_share_rebatedor": shares["Rebatedor"].round(1),
            "cluster_share_construtor": shares["Construtor"].round(1),
            "cluster_share_agressivo": shares["Agressivo"].round(1),
        },
        index=feat_df.index,
    )


def apply_zag_hierarchical_clusters(pool: pd.DataFrame) -> pd.DataFrame:
    """Add cluster_archetype, hybrid flag, constructor subtype and per-axis share columns."""
    out = pool.copy()
    empty_cols = {
        "cluster_archetype": None,
        "cluster_archetype_label": None,
        "cluster_construtor_subtype": None,
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
