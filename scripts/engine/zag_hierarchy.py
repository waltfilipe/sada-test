"""Hierarchical K=2×2 clustering for Serie A zagueiros (Wyscout + SofaScore)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from .sofascore import SS_PATH, SS_STAT_COLS, aggregate_sofascore, match_ss_row

CLUSTER_FEATURES = [
    "duelos_def",
    "duelos_aereos",
    "passes_terco_final",
    "conducao_prog",
    "duelos_ofensivos",
    "interception_won_p90",
    "total_clearance_p90",
    "outfielder_block_p90",
    "ball_recovery_p90",
    "share_long",
    "share_prog",
    "passes_total_p90",
]

MACRO_LABELS = {0: "Defensor", 1: "Construtor"}
MICRO_LABELS = {
    (0, 0): ("D1", "Rebatedor / âncora"),
    (0, 1): ("D2", "Distribuidor longo"),
    (1, 0): ("C1", "Construtor agressivo"),
    (1, 1): ("C2", "Construtor puro"),
}


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


def _macro_ids(feat_df: pd.DataFrame, labels: np.ndarray) -> dict[int, int]:
    """Map KMeans id -> semantic id (0=Defensor, 1=Construtor)."""
    scores: dict[int, float] = {}
    for cluster_id in np.unique(labels):
        sub = feat_df[labels == cluster_id]
        build = sub["passes_terco_final"].mean() + sub["conducao_prog"].mean() + sub["passes_total_p90"].mean()
        defend = sub["total_clearance_p90"].mean() + sub["outfielder_block_p90"].mean()
        scores[int(cluster_id)] = float(build - defend)
    ordered = sorted(scores, key=lambda k: scores[k])
    return {ordered[0]: 0, ordered[1]: 1}


def _assign_micro_labels(feat_df: pd.DataFrame, macro: np.ndarray) -> np.ndarray:
    """Semantic micro labels within each macro group (stable 28/16/8/19 split)."""
    micro = np.zeros(len(feat_df), dtype=int)
    def_mask = macro == 0
    con_mask = macro == 1

    if def_mask.any():
        def_sub = feat_df.loc[def_mask, "share_long"]
        d2_cut = float(def_sub.quantile(1 - 16 / 44))
        micro[def_mask] = np.where(feat_df.loc[def_mask, "share_long"].to_numpy() >= d2_cut, 1, 0)

    if con_mask.any():
        con_sub = feat_df.loc[con_mask]
        agressivo = con_sub["duelos_ofensivos"] * 2 + con_sub["share_prog"]
        c1_cut = float(agressivo.quantile(0.7))
        scores = feat_df.loc[con_mask, "duelos_ofensivos"] * 2 + feat_df.loc[con_mask, "share_prog"]
        micro[con_mask] = np.where(scores.to_numpy() >= c1_cut, 0, 1)

    return micro


def apply_zag_hierarchical_clusters(pool: pd.DataFrame) -> pd.DataFrame:
    """Add cluster_macro, cluster_micro, cluster_macro_label, cluster_micro_label."""
    out = pool.copy()
    if not SS_PATH.exists():
        out["cluster_macro"] = None
        out["cluster_micro"] = None
        out["cluster_macro_label"] = None
        out["cluster_micro_label"] = None
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
    X = StandardScaler().fit_transform(feat_df[CLUSTER_FEATURES].astype(float))

    raw_macro = KMeans(n_clusters=2, random_state=42, n_init=50).fit_predict(X)
    macro_map = _macro_ids(feat_df, raw_macro)
    macro = np.array([macro_map[int(label)] for label in raw_macro], dtype=int)
    micro = _assign_micro_labels(feat_df, macro)

    macro_labels: list[str | None] = []
    micro_codes: list[str | None] = []
    micro_labels: list[str | None] = []
    for m, s in zip(macro, micro):
        if m not in MACRO_LABELS:
            macro_labels.append(None)
            micro_codes.append(None)
            micro_labels.append(None)
            continue
        code, label = MICRO_LABELS.get((int(m), int(s)), (None, None))
        macro_labels.append(MACRO_LABELS[int(m)])
        micro_codes.append(code)
        micro_labels.append(label)

    out["cluster_macro"] = macro_labels
    out["cluster_micro"] = micro_codes
    out["cluster_macro_label"] = macro_labels
    out["cluster_micro_label"] = micro_labels
    return out
