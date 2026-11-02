"""Reproduce the defensive-efficiency pipeline for a worked example.

Prints, for a few zagueiros of Série A 2026: the 8 raw components, each
component z-score, action_z, cost_z, raw, final z and pool percentile.
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
from engine.sofascore import attach_sofascore_metrics
from engine.normalize import numeric_col, percentile_rank
from engine.pool_reference import distribution, reference_pool
from engine.positions import (
    _num_col,
    _pool_z,
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

    # --- rebuild intermediate values INSIDE the reference context --------
    dd = _num_col(pool, "DuelosDef")
    pct_w = _num_col(pool, "%DuelosDefW")
    comps = pd.DataFrame(
        {
            "duelos_venc": dd * pct_w,
            "intercept": _ss_inter_col(pool),
            "rebatidas": _ss_clearance_col(pool),
            "bloqueios": _num_col(pool, "outfielder_block_p90"),
            "duelos_perd": dd * (1 - pct_w),
            "faltas": _num_col(pool, "Faltas/90"),
            "erro_chute": _num_col(pool, "error_lead_to_a_shot_p90"),
            "erro_gol": _num_col(pool, "error_lead_to_a_goal_p90"),
        }
    )
    zcomps = comps.apply(_pool_z)
    action_z = zcomps[["duelos_venc", "intercept", "rebatidas", "bloqueios"]].mean(axis=1)
    cost_z = zcomps[["duelos_perd", "faltas", "erro_chute", "erro_gol"]].mean(axis=1)
    raw_score = action_z - cost_z

    moments = {}
    for col in comps.columns:
        sample = distribution(comps[col])
        moments[col] = (float(sample.mean()), float(sample.std(ddof=0)))
    mu = float(distribution(raw_score).mean())
    sigma = float(distribution(raw_score).std(ddof=0))

out = pd.concat(
    [
        pd.DataFrame(
            {
                "nome": pool["Jogador"],
                "clube": pool["Equipe"],
                "min": pool["Minutos jogados:"],
                "qualificado": pool.index.isin(reference_index),
            }
        ),
        comps,
        zcomps.add_prefix("z_"),
        pd.DataFrame(
            {
                "action_z": action_z,
                "cost_z": cost_z,
                "raw": raw_score,
                "z_stored": pool["_def_eff_z"],
                "z_check": (raw_score - mu) / sigma,
                "pct": pool["_asp_custo_def_eff"],
                "erros_totais": numeric_col(pool, "ss_def_error_total"),
                "pct_erros_inv": pool["_asp_error_def_inv"],
            }
        ),
    ],
    axis=1,
).sort_values("z_stored", ascending=False)

qualified = out[out["qualificado"]]
pick_names = [
    qualified.iloc[0]["nome"],
    out.iloc[0]["nome"],
    out.iloc[len(out) // 2]["nome"],
    out.iloc[-1]["nome"],
]
print("=== POOL MOMENTS (amostra qualificada) ===")
for col, (m, s) in moments.items():
    print(f"{col:14s} mu={m:8.4f} sigma={s:8.4f}")
print(f"raw_score   mu={mu:.4f} sigma={sigma:.4f}")
print(f"pool={len(pool)} qualificados={int(out['qualificado'].sum())}")
print("\n=== EXEMPLOS ===")
pd.set_option("display.width", 300)
pd.set_option("display.max_columns", 60)
cols = ["nome", "clube", "min", "qualificado", "duelos_venc", "intercept", "rebatidas",
        "bloqueios", "duelos_perd", "faltas", "erro_chute", "erro_gol",
        "z_duelos_venc", "z_intercept", "z_rebatidas", "z_bloqueios",
        "z_duelos_perd", "z_faltas", "z_erro_chute", "z_erro_gol",
        "action_z", "cost_z", "raw", "z_stored", "z_check", "pct",
        "erros_totais", "pct_erros_inv"]
sel = out[out["nome"].isin(pick_names)][cols]
print(sel.to_string(index=False))
