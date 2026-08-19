"""Hierarchical K=2×2 clustering for Serie A zagueiros (Wyscout + SofaScore)."""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
SS_PATH = ROOT / "BR26_defensive.csv"

SS_STAT_COLS = ["interception_won", "total_clearance", "outfielder_block", "ball_recovery"]

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

SS_CLUB_ALIASES: dict[str, list[str]] = {
    "athletico paranaense": ["athletico"],
    "red bull bragantino": ["bragantino"],
    "atletico mineiro": ["atletico mineiro"],
    "vasco da gama": ["vasco"],
    "internacional": ["internacional"],
    "coritiba": ["coritiba"],
    "sao paulo": ["sao paulo"],
    "fluminense": ["fluminense"],
}


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def name_similarity(query: str, candidate: str) -> float:
    q = normalize_text(query)
    c = normalize_text(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 100.0
    q_tokens = q.split()
    c_tokens = c.split()
    q_words = [token for token in q_tokens if len(token) > 1]
    q_initials = [token for token in q_tokens if len(token) == 1]
    leftover = list(c_tokens)
    matched = 0
    for word in q_words:
        if word in leftover:
            leftover.remove(word)
            matched += 1
    for initial in q_initials:
        hit = next((token for token in leftover if token.startswith(initial)), None)
        if hit:
            leftover.remove(hit)
            matched += 1
    coverage_query = matched / len(q_tokens) if q_tokens else 0.0
    coverage_candidate = matched / len(c_tokens) if c_tokens else 0.0
    ratio = SequenceMatcher(None, q, c).ratio()
    if coverage_query >= 1.0:
        score = 90.0 + 6.0 * coverage_candidate
    elif coverage_candidate >= 1.0:
        score = 82.0 + 6.0 * coverage_query
    elif matched:
        score = 55.0 + 25.0 * max(coverage_query, coverage_candidate)
    else:
        score = ratio * 50.0
    return min(100.0, score)


def club_match_score(wy_club: str, ss_team: str) -> int:
    wy_norm = normalize_text(wy_club)
    ss_norm = normalize_text(ss_team)
    if not wy_norm or not ss_norm:
        return 0
    if wy_norm in ss_norm or ss_norm in wy_norm:
        return 100
    wy_tokens = set(wy_norm.split())
    ss_tokens = set(ss_norm.split())
    overlap = len(wy_tokens & ss_tokens)
    if overlap:
        return 40 + overlap * 15
    for key, aliases in SS_CLUB_ALIASES.items():
        wy_hit = key in wy_norm or any(alias in wy_norm for alias in aliases)
        ss_hit = key in ss_norm or any(alias in ss_norm for alias in aliases)
        if wy_hit and ss_hit:
            return 85
    return 0


def aggregate_sofascore(path: Path) -> pd.DataFrame:
    raw = pd.read_csv(path)
    raw = raw[raw["minutes_played"] > 0].copy()
    raw["team"] = np.where(raw["is_home"], raw["home_team"], raw["away_team"])
    agg_dict: dict[str, tuple[str, str]] = {
        "minutes_played": ("minutes_played", "sum"),
        "matches": ("event_id", "nunique"),
    }
    for col in SS_STAT_COLS:
        agg_dict[col] = (col, "sum")
    team_minutes = (
        raw.groupby(["player_id", "team"], as_index=False)["minutes_played"]
        .sum()
        .sort_values("minutes_played", ascending=False)
    )
    primary_team = team_minutes.drop_duplicates("player_id").set_index("player_id")["team"]
    players = raw.groupby(["player_id", "player_name"], as_index=False).agg(**agg_dict)
    players["primary_team"] = players["player_id"].map(primary_team)
    for col in SS_STAT_COLS:
        players[f"{col}_p90"] = players[col] / players["minutes_played"] * 90
    return players


def _match_ss_row(wy_row: pd.Series, ss: pd.DataFrame) -> pd.Series | None:
    wy_name = str(wy_row["Jogador"])
    wy_club = str(wy_row["Equipe"])
    best_score = -1.0
    best_row = None
    for _, cand in ss.iterrows():
        ns = name_similarity(wy_name, cand["player_name"])
        cs = club_match_score(wy_club, cand["primary_team"])
        if cs < 50 and ns < 90:
            continue
        combined = ns if cs < 50 else 0.58 * ns + 0.42 * cs
        if combined > best_score:
            best_score = combined
            best_row = cand
    if best_row is None or best_score < 62:
        return None
    return best_row


def _build_feature_row(wy_row: pd.Series, ss_row: pd.Series | None) -> dict[str, float]:
    total = float(wy_row.get("Passes/90") or 0)
    share_long = float(wy_row.get("Passes longos/90") or 0) / total if total else 0.0
    share_prog = float(wy_row.get("Passes progressivos/90") or 0) / total if total else 0.0
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
        feats[key] = float(ss_row[f"{col}_p90"]) if ss_row is not None else 0.0
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
        # D2 = distribuidor longo (top ~16 of 44 by share_long)
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
        ss_hit = _match_ss_row(row, ss)
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
