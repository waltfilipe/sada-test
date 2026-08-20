#!/usr/bin/env python3
"""Offline study: defensive duels regression score for zagueiros.

Pool histórico (2022–2025): regressões
  A) eff% ~ vol/90 (+ vol²)
  B) vol/90 ~ minutes_pct (dentro da temporada)

Aplicação 2026 (71 zagueiros do site):
  score_A = percentil do resíduo de eficiência (encolhido por confiança)
  score_B = percentil do resíduo de volume vs minutos
  score = 0.75 × score_A_final + 0.25 × score_B
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

from engine.load_data import _dedupe_columns, _map_wyscout_position
from engine.measures import attach_base_measures

# ── Config ────────────────────────────────────────────────────────────────────
MIN_PCT_MINUTES = 0.20  # mesmo filtro do engine (_eligible_pool)
MIN_MINUTES_ABS = 400
CONF_REF_DUELS = 80  # tentativas totais para confiança plena em score_A
WEIGHT_EFF = 0.75
WEIGHT_VOL = 0.25

HISTORICAL_FILES = [
    (ROOT / "base_dados" / "Série A 2022.xlsx", 2022),
    (ROOT / "base_dados" / "Série A 23.xlsx", 2023),
    (ROOT / "base_dados" / "Serie A 24.xlsx", 2024),
    (ROOT / "base_dados" / "Série A 25 Final.xlsx", 2025),
]
TARGET_FILE = (ROOT / "Serie A 26.xlsx", 2026)
OUT_CSV = ROOT / "reference" / "zag_duel_regression_rankings_2026.csv"


def load_zagueiros(path: Path, season: int) -> pd.DataFrame:
    xl = pd.ExcelFile(path)
    sheet = "Tb_SerieC25" if "Tb_SerieC25" in xl.sheet_names else "Search results (500)"
    df = pd.read_excel(path, sheet_name=sheet)
    df = _dedupe_columns(df)
    if "Equipa" in df.columns and "Equipe" not in df.columns:
        df = df.rename(columns={"Equipa": "Equipe"})
    df["Posição"] = [_map_wyscout_position(v) for v in df.get("Posição", [])]
    df = df[df["Posição"] == "Zagueiro"].copy()
    df["season"] = season
    return df


def prepare_df(df: pd.DataFrame) -> pd.DataFrame:
    """Attach measures and duel columns."""
    out = attach_base_measures(df.copy())
    out["vol"] = pd.to_numeric(out["Duelos defensivos/90"], errors="coerce")
    out["eff"] = pd.to_numeric(out["Duelos defensivos ganhos, %"], errors="coerce")
    out["minutes"] = pd.to_numeric(out["Minutos jogados:"], errors="coerce")
    out = out.dropna(subset=["vol", "eff", "minutes"])
    out = out[out["minutes"] >= MIN_MINUTES_ABS].copy()
    out = out[out["%Minutos"] > MIN_PCT_MINUTES].copy()
    out["n_duels"] = out["vol"] * (out["minutes"] / 90.0)
    out["won_p90"] = out["vol"] * out["eff"] / 100.0
    return out


def fit_eff_regression(pool: pd.DataFrame) -> dict:
    """eff ~ vol + vol²"""
    vol = pool["vol"].to_numpy()
    eff = pool["eff"].to_numpy()
    X = np.column_stack([np.ones(len(vol)), vol, vol**2])
    beta, _, _, _ = np.linalg.lstsq(X, eff, rcond=None)
    return {"b0": beta[0], "b1": beta[1], "b2": beta[2]}


def fit_vol_regression(pool: pd.DataFrame) -> dict:
    """vol ~ minutes_pct (%Minutos × 100)"""
    pct = (pool["%Minutos"] * 100).to_numpy()
    vol = pool["vol"].to_numpy()
    X = np.column_stack([np.ones(len(pct)), pct])
    beta, _, _, _ = np.linalg.lstsq(X, vol, rcond=None)
    return {"g0": beta[0], "g1": beta[1]}


def predict_eff(vol: float, coef: dict) -> float:
    return coef["b0"] + coef["b1"] * vol + coef["b2"] * vol**2


def predict_vol(minutes_pct100: float, coef: dict) -> float:
    return coef["g0"] + coef["g1"] * minutes_pct100


def pct_rank(value: float, series: pd.Series) -> float:
    return float(stats.percentileofscore(series, value, kind="mean"))


def confidence(n_duels: float, ref: float = CONF_REF_DUELS) -> float:
    return min(1.0, max(0.0, n_duels / ref))


def score_players(df: pd.DataFrame, eff_coef: dict, vol_coef: dict) -> pd.DataFrame:
    out = df.copy()
    out["eff_expected"] = out["vol"].apply(lambda v: predict_eff(v, eff_coef))
    out["vol_expected"] = (out["%Minutos"] * 100).apply(lambda p: predict_vol(p, vol_coef))
    out["resid_eff"] = out["eff"] - out["eff_expected"]
    out["resid_vol"] = out["vol"] - out["vol_expected"]
    out["conf"] = out["n_duels"].apply(confidence)

    out["score_A_pct"] = out["resid_eff"].apply(lambda r: pct_rank(r, out["resid_eff"]))
    # Encolhe score_A em direção a 50 (neutro) quando poucas tentativas
    out["score_A"] = 50.0 + out["conf"] * (out["score_A_pct"] - 50.0)

    out["score_B"] = out["resid_vol"].apply(lambda r: pct_rank(r, out["resid_vol"]))
    out["score_final"] = WEIGHT_EFF * out["score_A"] + WEIGHT_VOL * out["score_B"]
    return out


def main() -> None:
    # ── Pool histórico ──
    hist_frames = [prepare_df(load_zagueiros(p, s)) for p, s in HISTORICAL_FILES]
    hist = pd.concat(hist_frames, ignore_index=True)
    print(f"Pool histórico (2022–25): {len(hist)} observações de zagueiros")
    print(f"  vol/90 med={hist['vol'].median():.2f}  eff% med={hist['eff'].median():.1f}")

    eff_coef = fit_eff_regression(hist)
    vol_coef = fit_vol_regression(hist)

    print("\n── Regressão A: eff% ~ vol + vol² ──")
    print(f"  eff_esperada = {eff_coef['b0']:.2f} + {eff_coef['b1']:.3f}·vol + {eff_coef['b2']:.4f}·vol²")
    print(f"  R² = {1 - np.var(hist['eff'] - hist['vol'].apply(lambda v: predict_eff(v, eff_coef)))/np.var(hist['eff']):.3f}")

    print("\n── Regressão B: vol/90 ~ %minutos_competição ──")
    print(f"  vol_esperado = {vol_coef['g0']:.3f} + {vol_coef['g1']:.4f}·pct_min")
    pct100 = hist["%Minutos"] * 100
    pred_v = pct100.apply(lambda p: predict_vol(p, vol_coef))
    print(f"  R² = {1 - np.var(hist['vol'] - pred_v)/np.var(hist['vol']):.3f}")

    # ── 2026 ──
    target_raw = load_zagueiros(TARGET_FILE[0], TARGET_FILE[1])
    target = prepare_df(target_raw)

    # Alinhar com os 71 do site (por player_id slug)
    site_ids = {p["player_id"] for p in json.loads((ROOT / "data" / "family-zagueiros.json").read_text())["players"]}

    def slug(row: pd.Series) -> str:
        import re

        name = str(row["Jogador"])
        club = str(row.get("Equipe", row.get("Equipa", "")))
        base = re.sub(r"[^a-z0-9]+", "-", f"{name}-{club}".lower()).strip("-")
        return base  # partial match below

    target["slug_base"] = target.apply(slug, axis=1)

    # Match site players by name+club from json
    site_players = json.loads((ROOT / "data" / "family-zagueiros.json").read_text())["players"]
    site_keys = {p["player_id"]: (p["name"], p["club"]) for p in site_players}

    matched_rows = []
    for pid, (name, club) in site_keys.items():
        mask = (target["Jogador"] == name) & (target["Equipe"].astype(str).str.contains(club.split()[0], case=False, na=False))
        if not mask.any():
            # fallback: name only
            mask = target["Jogador"] == name
        if mask.any():
            row = target[mask].iloc[0].copy()
            row["player_id"] = pid
            matched_rows.append(row)
        else:
            print(f"  AVISO: não encontrado no xlsx: {name} ({club})")

    scored = pd.DataFrame(matched_rows)
    if len(scored) < len(site_players):
        print(f"\nMatched {len(scored)}/{len(site_players)} jogadores do site")

    scored = score_players(scored, eff_coef, vol_coef)
    scored = scored.sort_values("score_final", ascending=False).reset_index(drop=True)
    scored["rank"] = np.arange(1, len(scored) + 1)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    cols_out = [
        "rank",
        "player_id",
        "Jogador",
        "Equipe",
        "minutes",
        "vol",
        "eff",
        "n_duels",
        "eff_expected",
        "resid_eff",
        "conf",
        "score_A",
        "vol_expected",
        "resid_vol",
        "score_B",
        "score_final",
    ]
    scored[cols_out].to_csv(OUT_CSV, index=False, float_format="%.2f")
    print(f"\nSalvo: {OUT_CSV}")

    print("\n══ TOP 20 — Score duelos defensivos (75% eff | 25% vol) ══")
    print(f"{'#':>3}  {'Jogador':<28} {'Clube':<18} {'Vol':>4} {'Eff':>4} {'ResEff':>7} {'Conf':>5} {'ScA':>5} {'ScB':>5} {'FINAL':>6}")
    print("-" * 105)
    for _, r in scored.head(20).iterrows():
        print(
            f"{int(r['rank']):>3}  {str(r['Jogador'])[:28]:<28} {str(r['Equipe'])[:18]:<18} "
            f"{r['vol']:>4.1f} {r['eff']:>3.0f}% {r['resid_eff']:>+6.1f}pp {r['conf']:>5.2f} "
            f"{r['score_A']:>5.1f} {r['score_B']:>5.1f} {r['score_final']:>6.1f}"
        )


if __name__ == "__main__":
    main()
