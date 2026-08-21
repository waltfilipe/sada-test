#!/usr/bin/env python3
"""Compare current M8 rating vs composite-rebalance and weak-axis proposals."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

from engine.zag_m8_rating import (  # noqa: E402
    BALANCE_BONUS_MAX,
    BALANCE_STD_REF,
    NOTA_MU,
    NOTA_SCALE,
    NOTA_TAU,
    SCORE_COLS,
    SHRINK_EXP,
    SHRINK_MU,
    _balance_bonus,
    _load_hierarchical_perfil,
    _map_perfil_cluster,
    _shrink,
    _tanh_nota,
)

# Proposta composite: construcao fundida; passe 32.5%, def 67.5% (22.5% cada aspecto def)
W_CONSTRUCAO = 0.325
W_DEF_EACH = 0.675 / 3

# Proposta M8
STRONG_W = 0.70
WEAK_W = 0.30
GAP_ATUAL = 10.0
GAP_PROPOSTA = 6.0
STRONG_ATUAL = 0.85
WEAK_ATUAL = 0.15


def _model2_raw(
    con: float,
    def_: float,
    perfil: str,
    med_con: float,
    med_def: float,
    *,
    strong_w: float,
    weak_w: float,
    gap: float,
) -> float:
    lean_con = con >= def_
    if perfil == "Híbrido":
        base = 0.55 * con + 0.45 * def_ if lean_con else 0.45 * con + 0.55 * def_
        return max(base, 0.5 * con + 0.5 * def_)
    if perfil == "Construtor":
        def_eff = max(def_, min(con - gap, med_def))
        return strong_w * con + weak_w * def_eff
    con_eff = max(con, min(def_ - gap, med_con))
    return weak_w * con_eff + strong_w * def_


def _balance_bonus_cols(row: pd.Series, cols: list[str]) -> float:
    std = float(np.std([row[c] for c in cols]))
    if std < BALANCE_STD_REF:
        return BALANCE_BONUS_MAX * (1 - std / BALANCE_STD_REF)
    return 0.0


def _attach_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    prop = pd.read_csv(ROOT / "reference" / "zag_archetype_proposta_ratings_2026.csv")
    out = pool.merge(prop[["Jogador", "proposta"]], on="Jogador", how="left")
    out["proposta"] = out["proposta"].fillna("—")
    return out


def _load_pool() -> pd.DataFrame:
    comp = pd.read_csv(ROOT / "reference" / "zag_composite_rating_2026.csv")
    comp["%Minutos"] = comp["%Minutos"].fillna(0.8)
    for col in SCORE_COLS:
        comp[col] = pd.to_numeric(comp[col], errors="coerce").fillna(50.0)

    comp["construcao"] = (comp["passes_prog"] + comp["passes_long"]) / 2
    comp["con"] = comp["construcao"]
    comp["def"] = (comp["duelos_def"] + comp["duelos_ar"] + comp["eficiencia_def"]) / 3

    hier = _load_hierarchical_perfil()
    if not hier.empty:
        comp = comp.merge(hier, on="Jogador", how="left")
    if "perfil_cluster" in comp.columns:
        comp["perfil_m"] = comp["perfil_cluster"].fillna("Híbrido").apply(_map_perfil_cluster)
    else:
        comp["perfil_m"] = "Híbrido"

    return comp


def _score_m8(pool: pd.DataFrame, *, mode: str) -> pd.DataFrame:
    out = pool.copy()
    med_con = float(out["con"].median())
    med_def = float(out["def"].median())

    if mode == "atual":
        strong_w, weak_w, gap = STRONG_ATUAL, WEAK_ATUAL, GAP_ATUAL
        bonus_cols = SCORE_COLS
        use_composite_raw = False
    elif mode == "composite":
        strong_w, weak_w, gap = STRONG_ATUAL, WEAK_ATUAL, GAP_ATUAL
        bonus_cols = ["duelos_def", "duelos_ar", "eficiencia_def", "construcao"]
        use_composite_raw = True
    elif mode == "m8":
        strong_w, weak_w, gap = STRONG_W, WEAK_W, GAP_PROPOSTA
        bonus_cols = SCORE_COLS
        use_composite_raw = False
    else:
        raise ValueError(mode)

    if use_composite_raw:
        out["m8_pre_shrink"] = (
            W_CONSTRUCAO * out["construcao"]
            + W_DEF_EACH * out["duelos_def"]
            + W_DEF_EACH * out["duelos_ar"]
            + W_DEF_EACH * out["eficiencia_def"]
        )
    else:
        out["m8_pre_shrink"] = out.apply(
            lambda row: _model2_raw(
                float(row["con"]),
                float(row["def"]),
                row["perfil_m"],
                med_con,
                med_def,
                strong_w=strong_w,
                weak_w=weak_w,
                gap=gap,
            ),
            axis=1,
        )

    out["m8_bonus"] = out.apply(lambda row: _balance_bonus_cols(row, bonus_cols), axis=1)
    out["m8_raw"] = out["m8_pre_shrink"] + out["m8_bonus"]
    out["m8_final"] = out.apply(lambda row: _shrink(row["m8_raw"], row["%Minutos"]), axis=1)
    out["nota"] = _tanh_nota(out["m8_final"]).round(2)
    out["rank"] = out["nota"].rank(method="min", ascending=False).astype(int)
    return out


def _top20(df: pd.DataFrame, label: str) -> pd.DataFrame:
    top = df.nsmallest(20, "rank")[
        ["rank", "Jogador", "Equipe", "proposta", "perfil_m", "nota", "con", "def"]
    ].copy()
    top.insert(0, "modelo", label)
    return top


def _profile_means(df: pd.DataFrame, label: str) -> pd.DataFrame:
    means = (
        df.groupby("proposta", observed=True)["nota"]
        .agg(n="count", media="mean")
        .round(2)
        .reset_index()
    )
    means.insert(0, "modelo", label)
    return means


def main() -> None:
    pool = _attach_profiles(_load_pool())

    atual = _score_m8(pool, mode="atual")
    composite = _score_m8(pool, mode="composite")
    m8prop = _score_m8(pool, mode="m8")

    out_dir = ROOT / "reference"
    compare = pool[["player_id", "Jogador", "Equipe", "proposta", "perfil_m"]].copy()
    compare["nota_atual"] = atual["nota"]
    compare["rank_atual"] = atual["rank"]
    compare["nota_composite"] = composite["nota"]
    compare["rank_composite"] = composite["rank"]
    compare["nota_m8"] = m8prop["nota"]
    compare["rank_m8"] = m8prop["rank"]
    compare["delta_rank_composite"] = compare["rank_atual"] - compare["rank_composite"]
    compare["delta_rank_m8"] = compare["rank_atual"] - compare["rank_m8"]
    compare = compare.sort_values("rank_atual")
    compare.to_csv(out_dir / "zag_rating_proposal_compare_2026.csv", index=False, float_format="%.2f")

    top_blocks = pd.concat(
        [
            _top20(atual, "atual"),
            _top20(composite, "composite_32_5_67_5"),
            _top20(m8prop, "m8_70_30_gap6"),
        ],
        ignore_index=True,
    )
    top_blocks.to_csv(out_dir / "zag_rating_proposal_top20_2026.csv", index=False, float_format="%.2f")

    means = pd.concat(
        [
            _profile_means(atual, "atual"),
            _profile_means(composite, "composite_32_5_67_5"),
            _profile_means(m8prop, "m8_70_30_gap6"),
        ],
        ignore_index=True,
    )
    means.to_csv(out_dir / "zag_rating_proposal_means_2026.csv", index=False, float_format="%.2f")

    print("=" * 88)
    print("COMPARATIVO DE RATING — ATUAL vs PROPOSTA COMPOSITE vs PROPOSTA M8")
    print("=" * 88)
    print("\nProposta composite: construcao=(prog+long)/2; pesos 32.5% passe / 67.5% def; M8 weak-axis atual")
    print("Proposta M8: weak-axis 70/30 (vs 85/15); GAP 6 (vs 10); composite atual\n")

    for label, df in [
        ("ATUAL (M8 85/15, GAP 10)", atual),
        ("PROPOSTA COMPOSITE (32.5/67.5)", composite),
        ("PROPOSTA M8 (70/30, GAP 6)", m8prop),
    ]:
        print("-" * 88)
        print(label)
        print("-" * 88)
        top = df.nsmallest(20, "rank")
        print(f"{'#':>3}  {'Jogador':<22} {'Equipe':<16} {'Perfil':<18} {'M8':<8} {'Nota':>5}")
        for _, r in top.iterrows():
            print(
                f"{int(r['rank']):>3}  {str(r['Jogador'])[:22]:<22} {str(r['Equipe'])[:16]:<16} "
                f"{str(r['proposta'])[:18]:<18} {str(r['perfil_m'])[:8]:<8} {r['nota']:>5.2f}"
            )
        print("\nMédia por perfil (classificação proposta):")
        pm = df.groupby("proposta")["nota"].agg(["count", "mean"]).round(2)
        for perf, row in pm.iterrows():
            print(f"  {perf:<20} n={int(row['count']):>2}  média={row['mean']:.2f}")
        print()

    print(f"→ CSVs: {out_dir}/zag_rating_proposal_compare_2026.csv")
    print(f"        {out_dir}/zag_rating_proposal_top20_2026.csv")
    print(f"        {out_dir}/zag_rating_proposal_means_2026.csv")


if __name__ == "__main__":
    main()
