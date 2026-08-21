#!/usr/bin/env python3
"""Compare current M8 vs statistical symmetry (z-scored con + def meta-axis)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

from engine.zag_m8_rating import (  # noqa: E402
    GAP,
    SCORE_COLS,
    SHRINK_EXP,
    SHRINK_MU,
    _balance_bonus,
    _load_hierarchical_perfil,
    _map_perfil_cluster,
    _shrink,
    _tanh_nota,
)

STRONG_W, WEAK_W = 0.85, 0.15
META_K = 15.0  # escala 0-100: meta = 50 + k * (z_con + z_def) / 2


def _model2_raw(con: float, def_: float, perfil: str, med_con: float, med_def: float) -> float:
    lean_con = con >= def_
    if perfil == "Híbrido":
        base = 0.55 * con + 0.45 * def_ if lean_con else 0.45 * con + 0.55 * def_
        return max(base, 0.5 * con + 0.5 * def_)
    if perfil == "Construtor":
        def_eff = max(def_, min(con - GAP, med_def))
        return STRONG_W * con + WEAK_W * def_eff
    con_eff = max(con, min(def_ - GAP, med_con))
    return WEAK_W * con_eff + STRONG_W * def_


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
    comp["con"] = (comp["passes_prog"] + comp["passes_long"]) / 2
    comp["def"] = (comp["duelos_def"] + comp["duelos_ar"] + comp["eficiencia_def"]) / 3

    hier = _load_hierarchical_perfil()
    if not hier.empty:
        comp = comp.merge(hier, on="Jogador", how="left")
    comp["perfil_m"] = comp.get("perfil_cluster", pd.Series("Híbrido", index=comp.index)).fillna("Híbrido").apply(_map_perfil_cluster)
    return comp


def _z(series: pd.Series) -> pd.Series:
    mu = float(series.mean())
    sig = float(series.std())
    if sig == 0:
        return pd.Series(0.0, index=series.index)
    return (series - mu) / sig


def _score(pool: pd.DataFrame, *, mode: str) -> pd.DataFrame:
    out = pool.copy()
    med_con = float(out["con"].median())
    med_def = float(out["def"].median())

    out["z_con"] = _z(out["con"])
    out["z_def"] = _z(out["def"])
    out["z_meta"] = (out["z_con"] + out["z_def"]) / 2

    if mode == "atual":
        out["m8_pre_shrink"] = out.apply(
            lambda row: _model2_raw(float(row["con"]), float(row["def"]), row["perfil_m"], med_con, med_def),
            axis=1,
        )
        out["m8_bonus"] = out.apply(_balance_bonus, axis=1)
    else:
        out["m8_pre_shrink"] = 50.0 + META_K * out["z_meta"]
        out["m8_bonus"] = 0.0

    out["m8_raw"] = out["m8_pre_shrink"] + out["m8_bonus"]
    out["m8_final"] = out.apply(lambda row: _shrink(row["m8_raw"], row["%Minutos"]), axis=1)
    out["nota"] = _tanh_nota(out["m8_final"]).round(2)
    out["rank"] = out["nota"].rank(method="min", ascending=False).astype(int)
    return out


def _top20(df: pd.DataFrame, label: str) -> pd.DataFrame:
    top = df.nsmallest(20, "rank")[
        ["rank", "Jogador", "Equipe", "proposta", "perfil_m", "nota", "con", "def", "z_con", "z_def", "z_meta"]
    ].copy()
    top.insert(0, "modelo", label)
    return top


def main() -> None:
    pool = _attach_profiles(_load_pool())
    atual = _score(pool, mode="atual")
    simetria = _score(pool, mode="simetria")

    out_dir = ROOT / "reference"
    compare = atual[
        ["player_id", "Jogador", "Equipe", "proposta", "con", "def", "z_con", "z_def", "z_meta", "nota", "rank"]
    ].rename(columns={"nota": "nota_atual", "rank": "rank_atual"})
    compare = compare.merge(
        simetria[["player_id", "m8_pre_shrink", "nota", "rank"]].rename(
            columns={"m8_pre_shrink": "meta_raw", "nota": "nota_sim", "rank": "rank_sim"}
        ),
        on="player_id",
        how="left",
    )
    compare["delta_rank"] = compare["rank_atual"] - compare["rank_sim"]
    compare = compare.sort_values("rank_atual")
    compare.to_csv(out_dir / "zag_symmetry_compare_2026.csv", index=False, float_format="%.2f")

    top = pd.concat([_top20(atual, "atual"), _top20(simetria, "simetria_z")], ignore_index=True)
    top.to_csv(out_dir / "zag_symmetry_top20_2026.csv", index=False, float_format="%.2f")

    print("=" * 92)
    print("SIMETRIA ESTATÍSTICA — z_con + z_def vs M8 ATUAL")
    print("=" * 92)
    print(f"\nPool: con μ={pool['con'].mean():.1f} σ={pool['con'].std():.1f}  |  def μ={pool['def'].mean():.1f} σ={pool['def'].std():.1f}")
    print(f"Simetria: meta = 50 + {META_K:.0f} × (z_con + z_def)/2  →  shrink  →  tanh (mesmo do M8)\n")

    for label, df in [("ATUAL (M8 weak-axis 85/15)", atual), ("SIMETRIA (z_con + z_def)", simetria)]:
        print("-" * 92)
        print(label)
        print("-" * 92)
        print(f"{'#':>3}  {'Jogador':<22} {'Perfil':<18} {'Nota':>5}  {'con':>5} {'def':>5}  {'z_meta':>6}")
        for _, r in df.nsmallest(20, "rank").iterrows():
            print(
                f"{int(r['rank']):>3}  {str(r['Jogador'])[:22]:<22} {str(r['proposta'])[:18]:<18} "
                f"{r['nota']:>5.2f}  {r['con']:>5.1f} {r['def']:>5.1f}  {r['z_meta']:>+6.2f}"
            )
        print("\nMédia por perfil (classificação proposta):")
        for perf, row in df.groupby("proposta")["nota"].agg(["count", "mean"]).iterrows():
            print(f"  {perf:<20} n={int(row['count']):>2}  média={row['mean']:.2f}")
        print("\nMédia meta_raw (pré-tanh) por perfil:")
        raw_col = "m8_pre_shrink" if "m8_pre_shrink" in df.columns else "meta_raw"
        for perf, row in df.groupby("proposta")[raw_col].agg(["mean"]).iterrows():
            print(f"  {perf:<20} meta={row['mean']:.1f}")
        print()

    leo = compare[compare["Jogador"] == "Léo Pereira"].iloc[0]
    print(
        f"Léo Pereira: con={leo['con']:.1f} def={leo['def']:.1f} "
        f"z_con={leo['z_con']:+.2f} z_def={leo['z_def']:+.2f} z_meta={leo['z_meta']:+.2f} "
        f"rank {int(leo['rank_atual'])}→{int(leo['rank_sim'])} "
        f"nota {leo['nota_atual']:.2f}→{leo['nota_sim']:.2f}"
    )
    print(f"\n→ {out_dir}/zag_symmetry_compare_2026.csv")


if __name__ == "__main__":
    main()
