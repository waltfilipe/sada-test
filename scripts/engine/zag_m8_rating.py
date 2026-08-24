"""M8 zagueiro rating — weak-axis blend, balance bonus, shrinkage and tanh nota."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from .normalize import rank_players

SCRIPTS = Path(__file__).resolve().parents[1]
ROOT = SCRIPTS.parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

SCORE_COLS = ["duelos_def", "duelos_ar", "passes_prog", "passes_long", "eficiencia_def"]

FORCED_PROFILES: tuple[tuple[str, str], ...] = (
    ("Construtor", "construtor"),
    ("Defensivo", "defensor_area"),
    ("Combativo", "combativo"),
)

ACTIVE_NOTA_COL = {
    "Construtor": "nota_construtor",
    "Defensor de Área": "nota_defensor_area",
    "Combativo": "nota_combativo",
}

GAP = 10.0
SHRINK_MU = 50.0
SHRINK_EXP = 0.65
BALANCE_STD_REF = 12.0
BALANCE_BONUS_MAX = 3.0
NOTA_MU = 6.5
NOTA_SCALE = 1.85
NOTA_TAU = 2.5

# Hero rating: blend M8 weak-axis with z-symmetry (con/def percentiles).
STRONG_W = 0.70
WEAK_W = 0.30
M8_BLEND_WEIGHT = 0.50
SYM_DOM_W = 0.10
SYM_WEAK_W = 0.90
SYM_K = 15.0


def _map_perfil_cluster(perfil: str) -> str:
    if perfil == "Construtor":
        return "Construtor"
    if perfil in ("Posicional", "Combativo", "Defensivo", "Defensor de Área"):
        return "Defensivo"
    return "Híbrido"


def _zscore_series(series: pd.Series) -> pd.Series:
    mu = float(series.mean())
    sig = float(series.std())
    if sig == 0:
        return pd.Series(0.0, index=series.index)
    return (series - mu) / sig


def _symmetry_raw(con: float, def_: float, z_con: pd.Series, z_def: pd.Series, idx) -> float:
    zc = float(z_con.loc[idx])
    zd = float(z_def.loc[idx])
    z_meta = SYM_DOM_W * max(zc, zd) + SYM_WEAK_W * min(zc, zd)
    return 50.0 + SYM_K * z_meta


def _load_reference_axis_scores() -> pd.DataFrame | None:
    path = ROOT / "reference" / "zag_composite_rating_2026.csv"
    if not path.exists():
        return None
    return pd.read_csv(path)[["player_id", *SCORE_COLS]]


def _def_branch_score(row: pd.Series, branch: str) -> float:
    if branch == "Combativo":
        return (
            0.625 * float(row["duelos_def"])
            + 0.125 * float(row["duelos_ar"])
            + 0.25 * float(row["eficiencia_def"])
        )
    if branch == "Defensivo":
        return (
            0.25 * float(row["duelos_def"])
            + 0.375 * float(row["duelos_ar"])
            + 0.375 * float(row["eficiencia_def"])
        )
    return float(row["def"])


def _model2_raw(row: pd.Series, med_con: float, med_def: float) -> float:
    con = float(row["con"])
    def_ = float(row["def"])
    perfil = row["perfil_m"]
    lean_con = con >= def_
    if perfil == "Híbrido":
        base = 0.55 * con + 0.45 * def_ if lean_con else 0.45 * con + 0.55 * def_
        return max(base, 0.5 * con + 0.5 * def_)
    if perfil == "Construtor":
        def_eff = max(def_, min(con - GAP, med_def))
        return STRONG_W * con + WEAK_W * def_eff
    con_eff = max(con, min(def_ - GAP, med_con))
    return WEAK_W * con_eff + STRONG_W * def_


def _model2_raw_forced(row: pd.Series, perfil_m: str, med_con: float, med_def: float) -> float:
    """Counterfactual M8 weak-axis for a forced profile (no symmetry blend)."""
    if perfil_m == "Construtor":
        forced = row.copy()
        forced["perfil_m"] = "Construtor"
        return _model2_raw(forced, med_con, med_def)
    con = float(row["con"])
    def_ = _def_branch_score(row, perfil_m)
    con_eff = max(con, min(def_ - GAP, med_con))
    return WEAK_W * con_eff + STRONG_W * def_


def _balance_bonus(row: pd.Series) -> float:
    std = float(np.std([row[c] for c in SCORE_COLS]))
    if std < BALANCE_STD_REF:
        return BALANCE_BONUS_MAX * (1 - std / BALANCE_STD_REF)
    return 0.0


def _shrink(raw: float, pct_minutes: float) -> float:
    w = min(1.0, float(pct_minutes) ** SHRINK_EXP)
    return SHRINK_MU + w * (float(raw) - SHRINK_MU)


def _tanh_nota(series: pd.Series) -> pd.Series:
    mu = float(series.mean())
    sig = float(series.std())
    if sig == 0:
        return pd.Series(NOTA_MU, index=series.index)
    z = (series - mu) / (sig * NOTA_TAU)
    return NOTA_MU + NOTA_SCALE * np.tanh(z)


def apply_zag_m8_ratings(out: pd.DataFrame) -> pd.DataFrame:
    """Attach M8 scores and tanh notes to a zagueiro engine pool."""
    from zag_composite_rating import build_axis_scores_for_pool

    ref_scores = _load_reference_axis_scores()
    if ref_scores is not None:
        scores = ref_scores
    else:
        scores = build_axis_scores_for_pool(out)
    merged = out.merge(scores, on="player_id", how="left", suffixes=("", "_axis"))
    for col in SCORE_COLS:
        if f"{col}_axis" in merged.columns:
            merged[col] = merged[f"{col}_axis"].combine_first(merged.get(col))
            merged = merged.drop(columns=[f"{col}_axis"])
        merged[col] = pd.to_numeric(merged[col], errors="coerce").fillna(50.0)

    merged["con"] = (merged["passes_prog"] + merged["passes_long"]) / 2
    merged["def"] = (merged["duelos_def"] + merged["duelos_ar"] + merged["eficiencia_def"]) / 3
    med_con = float(merged["con"].median())
    med_def = float(merged["def"].median())
    z_con = _zscore_series(merged["con"])
    z_def = _zscore_series(merged["def"])

    if "cluster_archetype" in merged.columns:
        merged["perfil_m"] = merged["cluster_archetype"].fillna(merged.get("perfil")).apply(_map_perfil_cluster)
    elif "perfil_cluster" in merged.columns:
        merged["perfil_m"] = merged["perfil_cluster"].fillna(merged.get("perfil")).apply(_map_perfil_cluster)
    else:
        merged["perfil_m"] = merged.get("perfil", "Híbrido").apply(_map_perfil_cluster)

    m8_core = merged.apply(lambda row: _model2_raw(row, med_con, med_def), axis=1)
    merged["m8_bonus"] = merged.apply(_balance_bonus, axis=1)
    m8_full = m8_core + merged["m8_bonus"]
    sym_raw = merged.apply(lambda row: _symmetry_raw(row["con"], row["def"], z_con, z_def, row.name), axis=1)
    merged["m8_pre_shrink"] = M8_BLEND_WEIGHT * m8_full + (1.0 - M8_BLEND_WEIGHT) * sym_raw
    merged["m8_raw"] = merged["m8_pre_shrink"]
    merged["m8_final"] = merged.apply(lambda row: _shrink(row["m8_raw"], row["%Minutos"]), axis=1)
    merged["nota_global"] = _tanh_nota(merged["m8_final"]).round(2)

    for perfil_m, slug in FORCED_PROFILES:
        raw_col = f"m8_raw_{slug}"
        final_col = f"m8_final_{slug}"
        nota_col = f"nota_{slug}"
        merged[raw_col] = merged.apply(
            lambda row, pm=perfil_m: _model2_raw_forced(row, pm, med_con, med_def) + row["m8_bonus"],
            axis=1,
        )
        merged[final_col] = merged.apply(lambda row, c=raw_col: _shrink(row[c], row["%Minutos"]), axis=1)
        merged[nota_col] = _tanh_nota(merged[final_col]).round(2)

    def _active_nota(row: pd.Series) -> float:
        arch = row.get("cluster_archetype") or row.get("perfil")
        col = ACTIVE_NOTA_COL.get(str(arch) if pd.notna(arch) else "")
        if col:
            return float(row[col])
        return float(row["nota_global"])

    merged["rating_geral"] = merged["nota_global"].round(1)
    merged["rating_perfil"] = merged.apply(_active_nota, axis=1).round(1)
    merged["rank_geral"] = rank_players(merged["rating_geral"])
    merged["rank_perfil"] = rank_players(merged["rating_perfil"])

    return merged
