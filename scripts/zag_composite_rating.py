#!/usr/bin/env python3
"""Rating composto zagueiros Serie A 26.

Aspectos com regressão de impacto (pool A+B 2022–25):
  50% resíduo certos/90 vs esperado(vol) + 50% certos/90 bruto (percentil)

Eficiência defensiva (sem regressão):
  60% eficiência (−custo ajustado, menor = melhor) + 40% ações bem-sucedidas/90

Rating geral = média simples dos 5 aspectos.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from zag_aspect_regression_study import (  # noqa: E402
    HISTORICAL_FILES,
    METRICS,
    enrich_base,
    load_zagueiros,
    match_site_players,
    metric_columns,
    prepare_metric_df,
)

WEIGHT_RESID = 0.50
WEIGHT_IMPACT = 0.50
WEIGHT_EFF_DEF = 0.60
WEIGHT_ACOES = 0.40

IMPACT_METRICS = ("duelos_def", "duelos_ar", "passes_prog", "passes_long")


def pct_rank(value: float, series: pd.Series) -> float:
    return float(stats.percentileofscore(series, value, kind="mean"))


def fit_impact_regression(pool: pd.DataFrame) -> dict[str, float]:
    vol = pool["vol"].to_numpy()
    imp = pool["impact"].to_numpy()
    X = np.column_stack([np.ones(len(vol)), vol, vol**2])
    beta, _, _, _ = np.linalg.lstsq(X, imp, rcond=None)
    return {"b0": float(beta[0]), "b1": float(beta[1]), "b2": float(beta[2])}


def predict_impact(vol: float, coef: dict[str, float]) -> float:
    return coef["b0"] + coef["b1"] * vol + coef["b2"] * vol ** 2


def score_impact_5050(target: pd.DataFrame, spec) -> pd.DataFrame:
    hist = pd.concat([enrich_base(load_zagueiros(p)) for p in HISTORICAL_FILES], ignore_index=True)
    hist_m = prepare_metric_df(hist, spec)
    coef = fit_impact_regression(hist_m)

    scored = match_site_players(prepare_metric_df(target, spec)).copy()
    scored["impact_expected"] = scored["vol"].apply(lambda v: predict_impact(v, coef))
    scored["resid_impact"] = scored["impact"] - scored["impact_expected"]
    scored["conf"] = (scored["n_attempts"] / spec.conf_ref).clip(0, 1)
    resid_pct = scored["resid_impact"].apply(lambda r: pct_rank(r, scored["resid_impact"]))
    scored["score_resid"] = 50.0 + scored["conf"] * (resid_pct - 50.0)
    scored["score_impact"] = scored["impact"].apply(lambda x: pct_rank(x, scored["impact"]))
    scored["score"] = WEIGHT_RESID * scored["score_resid"] + WEIGHT_IMPACT * scored["score_impact"]
    return scored[["player_id", "Jogador", "Equipe", "score"]].rename(columns={"score": spec.key})


def score_eficiencia_def_simple(target_enriched: pd.DataFrame) -> pd.DataFrame:
    enriched = match_site_players(target_enriched).copy()
    # menor custo = melhor eficiência
    enriched["eff_pct"] = enriched["custo_def"].apply(
        lambda c: 100.0 - pct_rank(c, enriched["custo_def"])
    )
    enriched["acoes_pct"] = enriched["acoes_def"].apply(
        lambda a: pct_rank(a, enriched["acoes_def"])
    )
    enriched["eficiencia_def"] = (
        WEIGHT_EFF_DEF * enriched["eff_pct"] + WEIGHT_ACOES * enriched["acoes_pct"]
    )
    return enriched[["player_id", "Jogador", "Equipe", "eficiencia_def", "custo_def", "acoes_def"]]


def build_composite() -> pd.DataFrame:
    target = enrich_base(load_zagueiros(ROOT / "Serie A 26.xlsx"))

    frames = []
    for key in IMPACT_METRICS:
        spec = next(m for m in METRICS if m.key == key)
        frames.append(score_impact_5050(target, spec))

    out = frames[0]
    for df in frames[1:]:
        out = out.merge(df, on=["player_id", "Jogador", "Equipe"], how="outer")

    efic = score_eficiencia_def_simple(target)
    out = out.merge(
        efic[["player_id", "eficiencia_def"]],
        on="player_id",
        how="left",
    )

    score_cols = list(IMPACT_METRICS) + ["eficiencia_def"]
    out["rating_mean"] = out[score_cols].mean(axis=1)
    out = out.sort_values("rating_mean", ascending=False).reset_index(drop=True)
    out["rank"] = np.arange(1, len(out) + 1)
    return out


def main() -> None:
    composite = build_composite()
    out_csv = ROOT / "reference" / "zag_composite_rating_2026.csv"
    composite.to_csv(out_csv, index=False, float_format="%.2f")

    print(f"Rating composto — {len(composite)} zagueiros (Serie A 2026)\n")
    print(
        "Modelo: 50/50 impact-residual (duelos def, aéreos, prog, long) + "
        "60/40 efic/custo vs ações (sem regressão)\n"
    )
    header = (
        f"{'#':>3}  {'Jogador':<22} {'Equipe':<20} "
        f"{'DD':>5} {'Ar':>5} {'Prog':>5} {'Long':>5} {'Efic':>5} {'MÉDIA':>6}"
    )
    print(header)
    print("-" * len(header))

    for _, r in composite.head(20).iterrows():
        print(
            f"{int(r['rank']):>3}  {str(r['Jogador'])[:22]:<22} {str(r['Equipe'])[:20]:<20} "
            f"{r['duelos_def']:>5.1f} {r['duelos_ar']:>5.1f} {r['passes_prog']:>5.1f} "
            f"{r['passes_long']:>5.1f} {r['eficiencia_def']:>5.1f} {r['rating_mean']:>6.1f}"
        )

    print(f"\n→ {out_csv}")


if __name__ == "__main__":
    main()
