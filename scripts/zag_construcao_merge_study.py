#!/usr/bin/env python3
"""Compare scoring passes separately (atual) vs merged construcao before scoring (opcao B)."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

from engine.zag_m8_rating import (  # noqa: E402
    BALANCE_BONUS_MAX,
    BALANCE_STD_REF,
    GAP,
    SHRINK_EXP,
    SHRINK_MU,
    _load_hierarchical_perfil,
    _map_perfil_cluster,
    _shrink,
    _tanh_nota,
)
from zag_aspect_regression_study import METRICS, MetricSpec, enrich_base, load_zagueiros  # noqa: E402
from zag_aspect_regression_study import HISTORICAL_FILES, match_site_players  # noqa: E402
from zag_composite_rating import (  # noqa: E402
    _score_eficiencia_def_frame,
    _score_impact_5050_frame,
    enrich_pool,
    fit_impact_regression,
)

STRONG_W, WEAK_W = 0.85, 0.15


def _add_merged_construcao(df: pd.DataFrame) -> pd.DataFrame:
    """Fuse prog+long raw metrics before aspect scoring."""
    out = df.copy()
    vol = out["passes_prog_vol"] + out["passes_long_vol"]
    impact = out["passes_prog_impact"] + out["passes_long_impact"]
    eff_num = out["passes_prog_vol"] * out["passes_prog_eff"] + out["passes_long_vol"] * out["passes_long_eff"]
    out["construcao_vol"] = vol
    out["construcao_impact"] = impact
    out["construcao_eff"] = (eff_num / vol.replace(0, np.nan)).fillna(0.0)
    return out


CONSTRUCAO_SPEC = MetricSpec(
    key="construcao",
    title="Construção (prog+long)",
    vol_label="Passes constr/90",
    eff_label="Eff %",
    impact_label="Certos/90",
    conf_ref=220.0,
    resid_cap=5.0,
)


def _metric_columns(spec: MetricSpec) -> tuple[str, str, str, str]:
    if spec.key == "construcao":
        return "construcao_vol", "construcao_eff", "construcao_impact", "construcao_vol"
    if spec.key == "duelos_def":
        return "duelos_def_vol", "duelos_def_eff", "duelos_def_impact", "duelos_def_vol"
    if spec.key == "duelos_ar":
        return "duelos_ar_vol", "duelos_ar_eff", "duelos_ar_impact", "duelos_ar_vol"
    if spec.key == "passes_prog":
        return "passes_prog_vol", "passes_prog_eff", "passes_prog_impact", "passes_prog_vol"
    if spec.key == "passes_long":
        return "passes_long_vol", "passes_long_eff", "passes_long_impact", "passes_long_vol"
    return "acoes_def", "custo_def", "inter_clear_p90", "acoes_def"


def _prepare_metric_df(df: pd.DataFrame, spec: MetricSpec) -> pd.DataFrame:
    vol_col, eff_col, impact_col, conf_vol_col = _metric_columns(spec)
    out = df.copy()
    out["vol"] = out[vol_col]
    if spec.key == "eficiencia_def":
        out["eff"] = -out[eff_col]
    else:
        out["eff"] = out[eff_col]
    out["impact"] = out[impact_col]
    out["n_attempts"] = out[conf_vol_col] * (out["minutes"] / 90.0)
    return out.dropna(subset=["vol", "eff", "impact"])


def _impact_coef(spec: MetricSpec) -> dict[str, float]:
    hist = pd.concat([_add_merged_construcao(enrich_base(load_zagueiros(p))) for p in HISTORICAL_FILES], ignore_index=True)
    return fit_impact_regression(_prepare_metric_df(hist, spec))


def _score_aspect(target: pd.DataFrame, spec: MetricSpec) -> pd.DataFrame:
    coef = _impact_coef(spec)
    scored = match_site_players(_prepare_metric_df(target, spec)).copy()
    return _score_impact_5050_frame(scored, spec, coef)


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


def _balance_bonus(row: pd.Series, cols: list[str]) -> float:
    std = float(np.std([row[c] for c in cols]))
    if std < BALANCE_STD_REF:
        return BALANCE_BONUS_MAX * (1 - std / BALANCE_STD_REF)
    return 0.0


def _score_m8(pool: pd.DataFrame, *, mode: str) -> pd.DataFrame:
    out = pool.copy()
    med_con = float(out["con"].median())
    med_def = float(out["def"].median())
    if mode == "atual":
        bonus_cols = ["duelos_def", "duelos_ar", "passes_prog", "passes_long", "eficiencia_def"]
    else:
        bonus_cols = ["duelos_def", "duelos_ar", "construcao", "eficiencia_def"]

    out["m8_pre_shrink"] = out.apply(
        lambda row: _model2_raw(float(row["con"]), float(row["def"]), row["perfil_m"], med_con, med_def),
        axis=1,
    )
    out["m8_bonus"] = out.apply(lambda row: _balance_bonus(row, bonus_cols), axis=1)
    out["m8_raw"] = out["m8_pre_shrink"] + out["m8_bonus"]
    out["m8_final"] = out.apply(lambda row: _shrink(row["m8_raw"], row["%Minutos"]), axis=1)
    out["nota"] = _tanh_nota(out["m8_final"]).round(2)
    out["rank"] = out["nota"].rank(method="min", ascending=False).astype(int)
    return out


def _attach_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    prop = pd.read_csv(ROOT / "reference" / "zag_archetype_proposta_ratings_2026.csv")
    out = pool.merge(prop[["Jogador", "proposta"]], on="Jogador", how="left")
    out["proposta"] = out["proposta"].fillna("—")
    return out


def build_scores() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    target_raw = enrich_base(load_zagueiros(ROOT / "Serie A 26.xlsx"))
    target = _add_merged_construcao(target_raw)

    dd_spec = next(m for m in METRICS if m.key == "duelos_def")
    ar_spec = next(m for m in METRICS if m.key == "duelos_ar")
    prog_spec = next(m for m in METRICS if m.key == "passes_prog")
    long_spec = next(m for m in METRICS if m.key == "passes_long")

    frames = [
        _score_aspect(target, dd_spec),
        _score_aspect(target, ar_spec),
        _score_aspect(target, prog_spec),
        _score_aspect(target, long_spec),
        _score_aspect(target, CONSTRUCAO_SPEC),
    ]
    out = frames[0]
    for df in frames[1:]:
        out = out.merge(df, on=["player_id", "Jogador", "Equipe"], how="outer", suffixes=("", "_dup"))
        out = out[[c for c in out.columns if not c.endswith("_dup")]]

    efic = _score_eficiencia_def_frame(match_site_players(enrich_pool(target)))
    out = out.merge(efic[["player_id", "eficiencia_def"]], on="player_id", how="left")

    minutes = target_raw[["Jogador", "%Minutos"]].drop_duplicates("Jogador")
    out = out.merge(minutes, on="Jogador", how="left")
    out["%Minutos"] = out["%Minutos"].fillna(0.8)

    # Atual: con = média dos scores já separados
    out["con_atual"] = (out["passes_prog"] + out["passes_long"]) / 2
    out["con_opcao_b"] = out["construcao"]
    out["def"] = (out["duelos_def"] + out["duelos_ar"] + out["eficiencia_def"]) / 3

    hier = _load_hierarchical_perfil()
    if not hier.empty:
        out = out.merge(hier, on="Jogador", how="left")
    out["perfil_m"] = out.get("perfil_cluster", pd.Series("Híbrido", index=out.index)).fillna("Híbrido").apply(_map_perfil_cluster)

    atual = out.copy()
    atual["con"] = atual["con_atual"]
    atual = _score_m8(atual, mode="atual")

    opcao_b = out.copy()
    opcao_b["con"] = opcao_b["con_opcao_b"]
    opcao_b = _score_m8(opcao_b, mode="opcao_b")

    detail = out[
        [
            "player_id",
            "Jogador",
            "Equipe",
            "passes_prog",
            "passes_long",
            "con_atual",
            "construcao",
            "con_opcao_b",
            "duelos_def",
            "duelos_ar",
            "eficiencia_def",
            "def",
        ]
    ].copy()
    detail["delta_con"] = detail["construcao"] - detail["con_atual"]
    return _attach_profiles(atual), _attach_profiles(opcao_b), detail


def _top20(df: pd.DataFrame, label: str) -> pd.DataFrame:
    top = df.nsmallest(20, "rank")[
        ["rank", "Jogador", "Equipe", "proposta", "perfil_m", "nota", "con", "def"]
    ].copy()
    top.insert(0, "modelo", label)
    return top


def _profile_means(df: pd.DataFrame, label: str) -> pd.DataFrame:
    means = df.groupby("proposta", observed=True)["nota"].agg(n="count", media="mean").round(2).reset_index()
    means.insert(0, "modelo", label)
    return means


def main() -> None:
    atual, opcao_b, detail = build_scores()

    out_dir = ROOT / "reference"
    compare = atual[
        ["player_id", "Jogador", "Equipe", "proposta", "perfil_m", "con", "def", "nota", "rank"]
    ].rename(columns={"con": "con_atual", "nota": "nota_atual", "rank": "rank_atual"})
    compare = compare.merge(
        opcao_b[["player_id", "con", "nota", "rank"]].rename(
            columns={"con": "con_opcao_b", "nota": "nota_opcao_b", "rank": "rank_opcao_b"}
        ),
        on="player_id",
        how="left",
    )
    compare = compare.merge(
        detail[
            [
                "player_id",
                "passes_prog",
                "passes_long",
                "construcao",
                "delta_con",
            ]
        ],
        on="player_id",
        how="left",
    )
    compare["delta_rank"] = compare["rank_atual"] - compare["rank_opcao_b"]
    compare = compare.sort_values("rank_atual")
    compare.to_csv(out_dir / "zag_construcao_merge_compare_2026.csv", index=False, float_format="%.2f")

    top = pd.concat([_top20(atual, "atual"), _top20(opcao_b, "opcao_b_merge_antes")], ignore_index=True)
    top.to_csv(out_dir / "zag_construcao_merge_top20_2026.csv", index=False, float_format="%.2f")

    means = pd.concat([_profile_means(atual, "atual"), _profile_means(opcao_b, "opcao_b_merge_antes")], ignore_index=True)
    means.to_csv(out_dir / "zag_construcao_merge_means_2026.csv", index=False, float_format="%.2f")

    print("=" * 90)
    print("OPÇÃO B — fundir prog+long ANTES de pontuar (50/50 impacto, regressão no pool histórico)")
    print("=" * 90)
    print("\nConstrução merged (raw, antes do score):")
    print("  vol  = passes_prog_vol + passes_long_vol")
    print("  impact = passes_prog_impact + passes_long_impact")
    print("  eff  = média ponderada por volume de eff_prog e eff_long")
    print("  → 1 regressão + 1 score 0–100 (conf_ref=220)\n")
    print("Atual: score(prog) e score(long) separados → con = (prog+long)/2\n")

    for label, df in [("ATUAL (prog+long separados)", atual), ("OPÇÃO B (merge antes de pontuar)", opcao_b)]:
        print("-" * 90)
        print(label)
        print("-" * 90)
        print(f"{'#':>3}  {'Jogador':<22} {'Perfil':<18} {'M8':<8} {'Nota':>5}  {'con':>5}")
        for _, r in df.nsmallest(20, "rank").iterrows():
            print(
                f"{int(r['rank']):>3}  {str(r['Jogador'])[:22]:<22} {str(r['proposta'])[:18]:<18} "
                f"{str(r['perfil_m'])[:8]:<8} {r['nota']:>5.2f}  {r['con']:>5.1f}"
            )
        print("\nMédia por perfil (classificação proposta):")
        for perf, row in df.groupby("proposta")["nota"].agg(["count", "mean"]).iterrows():
            print(f"  {perf:<20} n={int(row['count']):>2}  média={row['mean']:.2f}")
        print()

    print("Maior diferença con_atual vs construcao (score):")
    movers = detail.nlargest(8, "delta_con")[["Jogador", "passes_prog", "passes_long", "con_atual", "construcao", "delta_con"]]
    for _, r in movers.iterrows():
        print(
            f"  {str(r['Jogador'])[:22]:<22} prog={r['passes_prog']:5.1f} long={r['passes_long']:5.1f} "
            f"avg={r['con_atual']:5.1f} merged={r['construcao']:5.1f} Δ={r['delta_con']:+.1f}"
        )
    print("\nLeo Pereira:")
    leo = compare[compare["Jogador"] == "Léo Pereira"].iloc[0]
    print(
        f"  prog={leo['passes_prog']:.1f} long={leo['passes_long']:.1f} "
        f"con_atual={leo['con_atual']:.1f} construcao={leo['construcao']:.1f} "
        f"rank {int(leo['rank_atual'])}→{int(leo['rank_opcao_b'])} "
        f"nota {leo['nota_atual']:.2f}→{leo['nota_opcao_b']:.2f}"
    )
    print(f"\n→ {out_dir}/zag_construcao_merge_compare_2026.csv")


if __name__ == "__main__":
    main()
