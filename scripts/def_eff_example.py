"""Reproduce the defensive-efficiency pipeline (new model) for a worked example.

Prints pool moments, shrunk components, winsorized z's, block z's, final z
and percentile for selected zagueiros of Série A 2026, plus diagnostics
(component correlation matrix, action/cost correlation, shrinkage alphas).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import numpy as np

from engine.leagues import LEAGUES
from engine.load_data import load_players_dataframe
from engine.measures import attach_base_measures
from engine.normalize import numeric_col
from engine.pool_reference import distribution, reference_pool
from engine.sofascore import attach_sofascore_metrics
from engine.positions import (
    DEF_WINSOR_Z,
    _capital_errors_p90,
    _duelos_net_p90,
    _noventas,
    _num_col,
    _pool_z,
    _shrink_count_rate,
    _ss_clearance_col,
    _ss_inter_col,
    attach_aspect_percentiles,
    compute_family_metrics,
)

league = LEAGUES["serie-a"]
raw = load_players_dataframe("serie-a")
df = attach_base_measures(raw)
df = attach_sofascore_metrics(df, path=league["defensive_csv"])
df = df[df["Posição"] != "Goleiro"].copy()

computed = compute_family_metrics(df, "zagueiros", publish_all=True)
reference_index = computed.attrs.get("reference_index")

with reference_pool(reference_index):
    pool = attach_aspect_percentiles(computed)

    n90 = _noventas(pool)
    act_raw = pd.DataFrame(
        {
            "saldo_duelos": _duelos_net_p90(pool, n90),
            "intercept": _shrink_count_rate(_ss_inter_col(pool), n90),
            "rebatidas": _shrink_count_rate(_ss_clearance_col(pool), n90),
            "bloqueios": _shrink_count_rate(_num_col(pool, "outfielder_block_p90"), n90),
        }
    )
    cst_raw = pd.DataFrame(
        {
            "faltas": _shrink_count_rate(_num_col(pool, "Faltas/90"), n90),
            "erros_cap": _shrink_count_rate(_capital_errors_p90(pool), n90),
        }
    )
    z_act = act_raw.apply(_pool_z).clip(-DEF_WINSOR_Z, DEF_WINSOR_Z)
    z_cst = cst_raw.apply(_pool_z).clip(-DEF_WINSOR_Z, DEF_WINSOR_Z)
    a_std = _pool_z(z_act.mean(axis=1))
    c_std = _pool_z(z_cst.mean(axis=1))
    raw2 = a_std - c_std
    mu = float(distribution(raw2).mean())
    sigma = float(distribution(raw2).std(ddof=0))

    # shrinkage diagnostics: effective alpha per component
    def alpha_of(rate):
        count = rate * n90
        rc, rn = distribution(count), distribution(n90)
        mu_ = rc.sum() / rn.sum()
        var_obs = distribution(rate).var(ddof=0)
        samp = float((mu_ / rn.replace(0, np.nan)).mean())
        vt = var_obs - (0 if np.isnan(samp) else samp)
        return mu_, (np.inf if vt <= 1e-8 else mu_ / vt)

    print("=== SHRINKAGE (mu pool, alpha em noventas) ===")
    for name, rate in [
        ("intercept", _ss_inter_col(pool)),
        ("rebatidas", _ss_clearance_col(pool)),
        ("bloqueios", _num_col(pool, "outfielder_block_p90")),
        ("faltas", _num_col(pool, "Faltas/90")),
        ("erros_cap", _capital_errors_p90(pool)),
        ("duelos_D", _num_col(pool, "DuelosDef")),
    ]:
        m, a = alpha_of(rate.astype(float))
        print(f"{name:12s} mu={m:7.4f} alpha={a:8.2f}")

    print("\n=== CORR componentes z (amostra qualificada) ===")
    zall = pd.concat([z_act, z_cst], axis=1)
    print(zall.corr().round(2).to_string())
    print(f"\ncorr(action_std, cost_std) = {a_std.corr(c_std):.3f}")
    print(f"pool={len(pool)} qualificados={int(pool.index.isin(reference_index).sum())}")
    print(f"raw2 mu={mu:.4f} sigma={sigma:.4f}")

out = pd.concat(
    [
        pd.DataFrame(
            {
                "nome": pool["Jogador"],
                "clube": pool["Equipe"],
                "min": pool["Minutos jogados:"],
                "qual": pool.index.isin(reference_index),
            }
        ),
        act_raw,
        cst_raw,
        z_act.add_prefix("z_"),
        z_cst.add_prefix("z_"),
        pd.DataFrame(
            {
                "a_std": a_std,
                "c_std": c_std,
                "raw": raw2,
                "z": pool["_def_eff_z"],
                "pct": pool["_asp_custo_def_eff"],
                "err_tot": numeric_col(pool, "ss_def_error_total"),
            }
        ),
    ],
    axis=1,
).sort_values("z", ascending=False)

picks = ["Igor Rabello", "Jonathan", "Luan Peres", "Lucas Monzón"]
print("\n=== EXEMPLOS (novo modelo) ===")
pd.set_option("display.width", 320)
pd.set_option("display.max_columns", 60)
sel = out[out["nome"].isin(picks)]
print(sel.to_string(index=False))
print("\n=== TOP/BOTTOM 5 z ===")
print(out[["nome", "min", "qual", "z", "pct"]].head(5).to_string(index=False))
print(out[["nome", "min", "qual", "z", "pct"]].tail(5).to_string(index=False))
