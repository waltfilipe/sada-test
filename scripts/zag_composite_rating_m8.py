#!/usr/bin/env python3
"""Rating M8 — pesos por arquetipo + shrinkage %Minutos + nota tanh (μ=6.5)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

SCORE_COLS = ["duelos_def", "duelos_ar", "passes_prog", "passes_long", "eficiencia_def"]

ARCHETYPE_WEIGHTS: dict[str, dict[str, float]] = {
    "Construtor": {
        "passes_prog": 0.35,
        "passes_long": 0.35,
        "duelos_def": 0.10,
        "duelos_ar": 0.10,
        "eficiencia_def": 0.10,
    },
    "Combativo": {
        "passes_prog": 0.10,
        "passes_long": 0.10,
        "duelos_def": 0.50,
        "duelos_ar": 0.10,
        "eficiencia_def": 0.20,
    },
    "Defensor de Área": {
        "passes_prog": 0.10,
        "passes_long": 0.10,
        "duelos_def": 0.20,
        "duelos_ar": 0.30,
        "eficiencia_def": 0.30,
    },
}

SHRINK_MU = 50.0
SHRINK_EXP = 0.65
NOTA_MU = 6.5
NOTA_SCALE = 1.85
NOTA_TAU = 2.5


def _shrink(raw: float, pct_minutes: float) -> tuple[float, float]:
    w = min(1.0, float(pct_minutes) ** SHRINK_EXP)
    final = SHRINK_MU + w * (float(raw) - SHRINK_MU)
    return final, w


def _weighted_raw(row: pd.Series, weights: dict[str, float]) -> float:
    return float(sum(float(row[c]) * weights[c] for c in SCORE_COLS))


def _tanh_nota(series: pd.Series) -> pd.Series:
    mu = float(series.mean())
    sig = float(series.std())
    if sig == 0:
        return pd.Series(NOTA_MU, index=series.index)
    return NOTA_MU + NOTA_SCALE * np.tanh((series - mu) / (sig * NOTA_TAU))


def build_m8_ratings() -> pd.DataFrame:
    composite = pd.read_csv(ROOT / "reference/zag_composite_rating_2026.csv")
    profiles = pd.read_json(ROOT / "data" / "family-zagueiros.json")["players"]
    archetype_map = {p["player_id"]: p.get("cluster", {}).get("archetype") for p in profiles}
    out = composite.copy()
    out["archetype"] = out["player_id"].map(archetype_map).fillna("Defensor de Área")

    for arch, weights in ARCHETYPE_WEIGHTS.items():
        slug = arch.lower().replace(" ", "_").replace("á", "a")
        out[f"m8_raw_{slug}"] = out.apply(lambda r, w=weights: _weighted_raw(r, w), axis=1)

    out["m8_raw"] = out.apply(
        lambda r: _weighted_raw(r, ARCHETYPE_WEIGHTS.get(str(r["archetype"]), ARCHETYPE_WEIGHTS["Defensor de Área"])),
        axis=1,
    )
    shrunk = out.apply(lambda r: _shrink(r["m8_raw"], r["%Minutos"]), axis=1)
    out["minutes_weight"] = [s[1] for s in shrunk]
    out["m8_final"] = [s[0] for s in shrunk]

    for arch in ARCHETYPE_WEIGHTS:
        slug = arch.lower().replace(" ", "_").replace("á", "a")
        col = f"m8_raw_{slug}"
        out[f"m8_final_{slug}"] = out.apply(lambda r, c=col: _shrink(r[c], r["%Minutos"])[0], axis=1)
        out[f"nota_{slug}"] = _tanh_nota(out[f"m8_final_{slug}"])

    out["nota_global"] = _tanh_nota(out["m8_final"]).round(3)
    nota_perfil = pd.Series(index=out.index, dtype=float)
    for arch in ARCHETYPE_WEIGHTS:
        mask = out["archetype"] == arch
        if mask.any():
            nota_perfil.loc[mask] = _tanh_nota(out.loc[mask, "m8_final"])
    out["nota_perfil"] = nota_perfil.round(3)

    out = out.sort_values("m8_final", ascending=False).reset_index(drop=True)
    out["rank_m8"] = np.arange(1, len(out) + 1)
    out["rank_perfil"] = out["nota_perfil"].rank(ascending=False, method="min").astype(int)
    out["rank_global"] = out["nota_global"].rank(ascending=False, method="min").astype(int)
    return out
