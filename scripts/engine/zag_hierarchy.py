"""Semantic archetype tree for Serie A zagueiros (Wyscout + SofaScore)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .sofascore import SS_PATH, SS_STAT_COLS, aggregate_sofascore, match_ss_row

ARCHETYPE_LABELS = ("Defensor de Área", "Construtor", "Combativo")
CONSTRUTOR_BADGE_LABELS = ("Construtor Âncora", "Construtor Nato")

# Mean construction z-score above pool → Construtor branch.
CONSTRUCTION_Z_THRESHOLD = 0.25
# M4 = (DD + INT) / (Rebatidas + DA) — contact/reading vs line/aerial.
M4_COMBATIVO_THRESHOLD = 0.60
# Nudge the tree winner so mix-card shares match the primary archetype label.
PRIMARY_SHARE_BOOST = 1.0


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


def _branch_scores(feat_df: pd.DataFrame) -> pd.DataFrame:
    """Tree-aligned branch strengths for mix-card shares."""
    return pd.DataFrame(
        {
            "Defensor de Área": (
                _zscore(feat_df["total_clearance_p90"])
                + _zscore(feat_df["duelos_aereos"])
                + _zscore(feat_df["outfielder_block_p90"])
            )
            / 3.0,
            "Construtor": _construction_z(feat_df),
            "Combativo": _zscore(_m4_ratio(feat_df)),
        },
        index=feat_df.index,
    )[list(ARCHETYPE_LABELS)]


def _primary_archetype(con_z: float, m4_val: float) -> str:
    if con_z >= CONSTRUCTION_Z_THRESHOLD:
        return "Construtor"
    if m4_val >= M4_COMBATIVO_THRESHOLD:
        return "Combativo"
    return "Defensor de Área"


def _mix_shares(feat_df: pd.DataFrame, primaries: list[str]) -> pd.DataFrame:
    branches = _branch_scores(feat_df).copy()
    for idx, primary in zip(feat_df.index, primaries):
        branches.loc[idx, primary] += PRIMARY_SHARE_BOOST
    share_matrix = _softmax_shares(branches.to_numpy())
    return pd.DataFrame(share_matrix, columns=ARCHETYPE_LABELS, index=feat_df.index)


def _classify_archetypes(feat_df: pd.DataFrame) -> pd.DataFrame:
    con_z = _construction_z(feat_df)
    m4 = _m4_ratio(feat_df)
    mean_share_long = float(feat_df["share_long"].mean())

    primaries: list[str] = []
    labels: list[str] = []
    badges: list[str | None] = []
    badge_short: list[str | None] = []

    for idx in feat_df.index:
        cz = float(con_z.loc[idx])
        m4_val = float(m4.loc[idx])
        share_long = float(feat_df.loc[idx, "share_long"])

        primary = _primary_archetype(cz, m4_val)
        label = primary
        if primary == "Construtor":
            if share_long > mean_share_long:
                badge = CONSTRUTOR_BADGE_LABELS[0]
                badge_short.append("Âncora")
            else:
                badge = CONSTRUTOR_BADGE_LABELS[1]
                badge_short.append("Nato")
        else:
            badge = None
            badge_short.append(None)

        primaries.append(primary)
        labels.append(label)
        badges.append(badge)

    shares = _mix_shares(feat_df, primaries)

    return pd.DataFrame(
        {
            "cluster_archetype": primaries,
            "cluster_archetype_label": labels,
            "cluster_construtor_badge": badges,
            "cluster_construtor_badge_short": badge_short,
            "cluster_share_defensor_area": shares["Defensor de Área"].round(1),
            "cluster_share_construtor": shares["Construtor"].round(1),
            "cluster_share_combativo": shares["Combativo"].round(1),
        },
        index=feat_df.index,
    )


def apply_zag_hierarchical_clusters(pool: pd.DataFrame) -> pd.DataFrame:
    """Add cluster_archetype, constructor badge and per-axis share columns."""
    out = pool.copy()
    empty_cols = {
        "cluster_archetype": None,
        "cluster_archetype_label": None,
        "cluster_construtor_badge": None,
        "cluster_construtor_badge_short": None,
        "cluster_share_defensor_area": None,
        "cluster_share_construtor": None,
        "cluster_share_combativo": None,
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
