#!/usr/bin/env python3
"""Aggregate SofaScore defensive data, match to Wyscout zagueiros, cluster from scratch."""

from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from engine.load_data import load_players_dataframe
from engine.measures import attach_base_measures
from engine.positions import _eligible_pool

ROOT = Path(__file__).resolve().parents[1]
SS_PATH = ROOT / "BR26_defensive.csv"
OUT_PATH = ROOT / "reference" / "zag_ss_cluster_study.json"

SS_STAT_COLS = [
    "interception_won",
    "total_clearance",
    "outfielder_block",
    "ball_recovery",
]

WY_FEATURES = {
    "duelos_def": "DuelosDef",
    "duelos_aereos": "DuelosAr",
    "passes_prog": "PassesProg",
    "passes_terco_final": "PTF",
    "passes_longos": "PassesLongos",
    "conducao_prog": "Cond.Prog",
    "duelos_ofensivos": "DuelosOf",
}

SS_FEATURES = {
    "interception_won_p90": "interception_won",
    "total_clearance_p90": "total_clearance",
    "outfielder_block_p90": "outfielder_block",
    "ball_recovery_p90": "ball_recovery",
}

ALL_FEATURES = list(WY_FEATURES.keys()) + list(SS_FEATURES.keys())

# Wyscout club name -> SofaScore team strings
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

# Manual fixes when fuzzy+club still fails (Wyscout name -> SS player_name)
MANUAL_NAME_MAP: dict[str, str] = {}


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


def load_wyscout_zagueiros() -> pd.DataFrame:
    df = attach_base_measures(load_players_dataframe())
    pool = _eligible_pool(df, ["Zagueiro"]).copy()
    pool = pool.reset_index(drop=True)
    return pool


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

    # Primary team = club with most minutes in sample
    team_minutes = (
        raw.groupby(["player_id", "team"], as_index=False)["minutes_played"]
        .sum()
        .sort_values("minutes_played", ascending=False)
    )
    primary_team = team_minutes.drop_duplicates("player_id").set_index("player_id")["team"]

    players = raw.groupby(["player_id", "player_name"], as_index=False).agg(**agg_dict)
    players["primary_team"] = players["player_id"].map(primary_team)
    players["player_name_norm"] = players["player_name"].map(normalize_text)

    for col in SS_STAT_COLS:
        players[f"{col}_p90"] = players[col] / players["minutes_played"] * 90

    return players


def match_players(wy: pd.DataFrame, ss: pd.DataFrame) -> pd.DataFrame:
    ss_by_norm_name = ss.groupby("player_name_norm").first().reset_index()
    records: list[dict] = []

    for _, row in wy.iterrows():
        wy_name = str(row["Jogador"])
        wy_club = str(row["Equipe"])
        wy_norm = normalize_text(wy_name)

        if wy_name in MANUAL_NAME_MAP:
            target = normalize_text(MANUAL_NAME_MAP[wy_name])
            hit = ss[ss["player_name_norm"] == target]
            if len(hit) == 1:
                records.append(_build_match_record(row, hit.iloc[0], 100.0, 100, "manual"))
                continue

        best_score = -1.0
        best_row = None
        best_name = 0.0
        best_club = 0

        for _, cand in ss.iterrows():
            ns = name_similarity(wy_name, cand["player_name"])
            cs = club_match_score(wy_club, cand["primary_team"])
            # Wyscout club labels are often stale; trust strong name matches.
            if cs < 50 and ns < 90:
                continue
            if cs < 50:
                combined = ns
            else:
                combined = 0.58 * ns + 0.42 * cs
            if combined > best_score:
                best_score = combined
                best_row = cand
                best_name = ns
                best_club = cs

        if best_row is None or best_score < 62:
            records.append(
                {
                    "player_id_wy": row["player_id"],
                    "jogador": wy_name,
                    "equipe": wy_club,
                    "matched": False,
                    "match_score": round(best_score, 1) if best_score >= 0 else None,
                }
            )
            continue

        records.append(_build_match_record(row, best_row, best_name, best_club, "fuzzy"))

    return pd.DataFrame(records)


def _build_match_record(wy_row: pd.Series, ss_row: pd.Series, name_score: float, club_score: int, method: str) -> dict:
    return {
        "player_id_wy": wy_row["player_id"],
        "jogador": wy_row["Jogador"],
        "equipe": wy_row["Equipe"],
        "matched": True,
        "match_method": method,
        "name_score": round(name_score, 1),
        "club_score": club_score,
        "player_id_ss": int(ss_row["player_id"]),
        "player_name_ss": ss_row["player_name"],
        "team_ss": ss_row["primary_team"],
        "ss_minutes": int(ss_row["minutes_played"]),
        "ss_matches": int(ss_row["matches"]),
        "minutes_wy": int(wy_row.get("Minutos jogados:", 0) or 0),
        **{f: float(wy_row[field]) for f, field in WY_FEATURES.items()},
        **{f: float(ss_row[f"{src}_p90"]) for f, src in SS_FEATURES.items()},
    }


def build_feature_matrix(matched: pd.DataFrame) -> pd.DataFrame:
    ok = matched[matched["matched"]].copy()
    return ok[["player_id_wy", "jogador", "equipe"] + ALL_FEATURES].set_index("player_id_wy")


def describe_clusters(labels: np.ndarray, matrix: pd.DataFrame, meta: pd.DataFrame) -> list[dict]:
    profiles: list[dict] = []
    feats = matrix[ALL_FEATURES]
    for cluster_id in sorted(np.unique(labels)):
        mask = labels == cluster_id
        sub = feats[mask]
        centroid = sub.mean()
        z = (centroid - feats.mean()) / feats.std(ddof=0)
        top_pos = z.nlargest(3)
        top_neg = z.nsmallest(3)
        examples = meta[mask][["jogador", "equipe"]].head(5).to_dict("records")
        profiles.append(
            {
                "cluster": int(cluster_id),
                "n": int(len(sub)),
                "examples": examples,
                "high": {k: round(float(v), 2) for k, v in top_pos.items()},
                "low": {k: round(float(v), 2) for k, v in top_neg.items()},
            }
        )
    return profiles


def run_cluster_study(matrix: pd.DataFrame) -> dict:
    X = matrix[ALL_FEATURES].astype(float)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    k_range = range(2, 8)
    silhouette: dict[str, float] = {}
    models: dict[int, np.ndarray] = {}
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=50)
        labels = km.fit_predict(Xs)
        models[k] = labels
        silhouette[str(k)] = round(float(silhouette_score(Xs, labels)), 4)

    best_k = max(k_range, key=lambda k: silhouette[str(k)])
    labels = models[best_k]

    k3_labels = models[3]

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(Xs)

    agg = AgglomerativeClustering(n_clusters=best_k, linkage="ward")
    agg_labels = agg.fit_predict(Xs)
    agg_sil = float(silhouette_score(Xs, agg_labels))

    players_out = []
    for idx, (pid, row) in enumerate(matrix.iterrows()):
        players_out.append(
            {
                "player_id": pid,
                "jogador": row["jogador"],
                "equipe": row["equipe"],
                "cluster_kmeans": int(labels[idx]),
                "cluster_agg": int(agg_labels[idx]),
                "pca_x": round(float(coords[idx, 0]), 4),
                "pca_y": round(float(coords[idx, 1]), 4),
                "features": {f: round(float(row[f]), 3) for f in ALL_FEATURES},
            }
        )

    return {
        "n_players": len(matrix),
        "features": ALL_FEATURES,
        "silhouette_by_k": silhouette,
        "best_k": int(best_k),
        "best_k_silhouette": silhouette[str(best_k)],
        "agg_silhouette_same_k": round(agg_sil, 4),
        "pca_explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
        "cluster_profiles": describe_clusters(labels, matrix, matrix[["jogador", "equipe"]]),
        "cluster_profiles_k3": describe_clusters(k3_labels, matrix, matrix[["jogador", "equipe"]]),
        "players": players_out,
    }


def main() -> None:
    wy = load_wyscout_zagueiros()
    ss = aggregate_sofascore(SS_PATH)
    matches = match_players(wy, ss)

    matched_n = int(matches["matched"].sum())
    print(f"Wyscout zagueiros: {len(wy)}")
    print(f"SofaScore players aggregated: {len(ss)}")
    print(f"Matched: {matched_n}/{len(wy)}")

    unmatched = matches[~matches["matched"]]
    if len(unmatched):
        print("\nUnmatched:")
        for _, r in unmatched.iterrows():
            print(f"  {r['jogador']:25} ({r['equipe']}) score={r.get('match_score')}")

    if matched_n < len(wy):
        print("\nRetrying unmatched with relaxed club threshold...")
        # second pass handled in match_players - for remaining, try global name-only high confidence
        for i, r in unmatched.iterrows():
            wy_row = wy[wy["player_id"] == r["player_id_wy"]].iloc[0]
            best = None
            best_ns = 0.0
            for _, cand in ss.iterrows():
                ns = name_similarity(wy_row["Jogador"], cand["player_name"])
                if ns > best_ns:
                    best_ns = ns
                    best = cand
            if best is not None and best_ns >= 92:
                matches.loc[i] = pd.Series(_build_match_record(wy_row, best, best_ns, 0, "name_only"))

    matched_n = int(matches["matched"].sum())
    fuzzy_n = int((matches["matched"] & (matches["match_method"] == "fuzzy")).sum())
    name_only_n = int((matches["matched"] & (matches["match_method"] == "name_only")).sum())
    print(f"\nFinal matched: {matched_n}/{len(wy)} (fuzzy={fuzzy_n}, name_only={name_only_n})")

    matrix_df = build_feature_matrix(matches)
    cluster_result = run_cluster_study(matrix_df)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "wyscout_pool": len(wy),
            "sofascore_players": len(ss),
            "matched": matched_n,
            "ss_source": str(SS_PATH.name),
        },
        "matching": matches.where(matches.notna(), None).to_dict(orient="records"),
        "clustering": cluster_result,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT_PATH}")
    print(f"Best K={cluster_result['best_k']} silhouette={cluster_result['best_k_silhouette']}")
    for prof in cluster_result["cluster_profiles"]:
        print(f"\nK={cluster_result['best_k']} Cluster {prof['cluster']} (n={prof['n']}): +{list(prof['high'].keys())} / -{list(prof['low'].keys())}")
    print("\n--- K=3 (exploratory) ---")
    for prof in cluster_result["cluster_profiles_k3"]:
        print(f"K=3 Cluster {prof['cluster']} (n={prof['n']}): +{list(prof['high'].keys())} / -{list(prof['low'].keys())}")


if __name__ == "__main__":
    main()
