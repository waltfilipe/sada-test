#!/usr/bin/env python3
"""Cross-season supervised priors for projection.

One ridge model per (position family, metric key), trained on every observed
season-to-season transition (pooled across Série A/B/C, with league tier as a
feature). The penalty is chosen by exact leave-one-out CV; the LOO RMSE is the
honest out-of-sample error of the prior and feeds the projection intervals.

Metric keys and values mirror lib/minuteProjection.ts (samplesFromAspect) so the
prior is defined for exactly the metrics the UI projects.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np

SEASON_TOTALS = {"gols", "xg", "xa", "pré assistências", "pre assistências", "assistências", "assistencias", "erros totais"}
CURRENT = "2026"
LAMBDAS = (0.1, 0.3, 1.0, 3.0, 10.0, 30.0, 100.0, 300.0)
MIN_TRAIN = 40
MIN_CUR_MINUTES = 900
MIN_PREV_MINUTES = 270
FEATURES = ("y1", "y2", "hist", "age", "tier_prev", "tier_cur")
NUM_RE = re.compile(r"^\d+(\.\d+)?$")
SIGNED_RE = re.compile(r"^-?\d+(\.\d+)?$")

TIER = {"serie-a": 3.0, "serie-b": 2.0, "serie-c": 1.0}


def league_tier(league: str | None) -> float:
    return TIER.get(league or "", 1.0)


def _is_season_total(label: str) -> bool:
    return label.strip().lower() in SEASON_TOTALS


def _is_volume_label(label: str) -> bool:
    n = label.strip().lower()
    if not n or "%" in n or "/" in n:
        return False
    if re.search(r"erro|efici[eê]ncia", n):
        return False
    return not _is_season_total(label)


def _parse_rate(raw: str) -> float | None:
    s = raw.replace(" ", "").replace("\u00a0", "").replace(",", ".")
    return float(s) if NUM_RE.match(s) else None


def _parse_signed(raw: str) -> float | None:
    s = raw.replace(" ", "").replace("\u00a0", "").replace("−", "-").replace(",", ".")
    return float(s) if SIGNED_RE.match(s) else None


def _sample_from(parent: str | None, label: str, display: Any, exposure: float, z_score: bool = False) -> tuple[str, dict] | None:
    raw = ("" if display is None else str(display)).strip()
    if not raw:
        return None
    key = f"{parent}::{label}" if parent else label
    normalized = label.strip().lower()
    if not z_score and raw.startswith("+"):
        return None
    adverse = "erro" in normalized
    season_count = _is_season_total(label)
    if "%" in raw:
        v = _parse_rate(raw.replace("%", ""))
        return (key, {"value": v, "kind": "percent", "signed": False}) if v is not None else None
    parsed = _parse_signed(raw) if z_score else _parse_rate(raw)
    if parsed is None:
        return None
    if season_count or adverse:
        if exposure <= 0:
            return None
        return key, {"value": parsed / exposure, "kind": "rate", "signed": False}
    if z_score:
        return key, {"value": parsed, "kind": "rate", "signed": True}
    if not _is_volume_label(label):
        return None
    return key, {"value": parsed, "kind": "rate", "signed": False}


def extract_samples(player: dict) -> dict[str, dict]:
    exposure = (player.get("minutes") or 0) / 90
    out: dict[str, dict] = {}
    for items in (player.get("aspects") or {}).values():
        for item in items or []:
            kind = item.get("kind")
            if kind == "def_efficiency_group":
                for sub in item.get("sub_metrics") or []:
                    lab = sub.get("label") or ""
                    if re.search(r"erro", lab, re.I):
                        hit = _sample_from(item["label"], lab, sub.get("display_value"), exposure)
                    elif re.search(r"efici[eê]ncia", lab, re.I):
                        hit = _sample_from(item["label"], lab, sub.get("display_value"), exposure, z_score=True)
                    else:
                        hit = None
                    if hit:
                        out[hit[0]] = hit[1]
                continue
            if kind == "construction_share":
                continue
            subs = item.get("sub_metrics") or []
            if subs:
                for sub in subs:
                    hit = _sample_from(item["label"], sub.get("label") or "", sub.get("display_value"), exposure)
                    if hit:
                        out[hit[0]] = hit[1]
            else:
                hit = _sample_from(None, item["label"], item.get("display_value"), exposure)
                if hit:
                    out[hit[0]] = hit[1]
            if item.get("efficiency_value"):
                hit = _sample_from(item["label"], "Eficiência", item["efficiency_value"], exposure)
                if hit:
                    out[hit[0]] = hit[1]
    return out


def _features(history: list[dict], key: str, age: float, tier_cur: float) -> list[float] | None:
    """history: past rows (oldest→newest) each with _samples/_n90/_league."""
    vals = [(h["_samples"][key]["value"], h["_n90"], h) for h in history if key in h["_samples"]]
    if not vals:
        return None
    y1, _, last = vals[-1]
    y2 = vals[-2][0] if len(vals) >= 2 else y1
    w = np.array([max(1.0, n) for _, n, _ in vals])
    hist = float(np.dot([v for v, _, _ in vals], w) / w.sum())
    return [y1, y2, hist, age, league_tier(last.get("_league")), tier_cur]


def transitions(timeline: dict[str, list[dict]], family: str, key: str, max_cur_season: str | None = None) -> list[dict]:
    rows_out = []
    for rows in timeline.values():
        for i in range(1, len(rows)):
            cur, prev = rows[i], rows[i - 1]
            if cur.get("position_family") != family or key not in cur["_samples"]:
                continue
            if cur["_season"] == CURRENT or cur["_season"] == prev["_season"]:
                continue
            if max_cur_season and cur["_season"] > max_cur_season:
                continue
            if (cur.get("minutes") or 0) < MIN_CUR_MINUTES or (prev.get("minutes") or 0) < MIN_PREV_MINUTES:
                continue
            feats = _features(rows[:i], key, int(cur["_season"]) - (cur.get("birth_year") or 1998), league_tier(cur.get("_league")))
            if feats is None:
                continue
            rows_out.append({"x": feats, "y": cur["_samples"][key]["value"], "n90": cur["_n90"], "season": cur["_season"]})
    return rows_out


def fit_ridge(rows: list[dict]) -> dict | None:
    """Standardised ridge, intercept unpenalised, lambda by exact LOO."""
    if len(rows) < MIN_TRAIN:
        return None
    X = np.array([r["x"] for r in rows], dtype=float)
    y = np.array([r["y"] for r in rows], dtype=float)
    mean = X.mean(axis=0)
    sd = X.std(axis=0)
    sd[sd < 1e-9] = 1.0
    Z = (X - mean) / sd
    ybar = y.mean()
    yc = y - ybar
    n, p = Z.shape
    best: tuple[float, float, np.ndarray] | None = None
    gram = Z.T @ Z
    for lam in LAMBDAS:
        inv = np.linalg.inv(gram + lam * np.eye(p))
        beta = inv @ Z.T @ yc
        h = 1.0 / n + np.einsum("ij,jk,ik->i", Z, inv, Z)
        resid = (yc - Z @ beta) / np.clip(1.0 - h, 1e-6, None)
        mse = float(np.mean(resid**2))
        if best is None or mse < best[0]:
            best = (mse, lam, beta)
    assert best is not None
    mse, lam, beta = best
    return {
        "mean": mean.tolist(),
        "sd": sd.tolist(),
        "b0": float(ybar),
        "beta": beta.tolist(),
        "lambda": lam,
        "resid_sd": float(np.sqrt(mse)),
        "train_n90": float(np.mean([r["n90"] for r in rows])),
        "n": n,
        "y_sd": float(y.std()),
    }


def predict(model: dict, feats: list[float], signed: bool = False) -> float:
    z = (np.array(feats) - np.array(model["mean"])) / np.array(model["sd"])
    value = model["b0"] + float(np.dot(model["beta"], z))
    return value if signed else max(0.0, value)


def backtest(timeline: dict[str, list[dict]], families: list[str], keys_by_family: dict[str, set[str]]) -> dict:
    """Train on transitions ending <=2024, predict 2025. Errors normalised by the key's sd."""
    report: dict[str, dict] = {}
    for family in families:
        se_model, se_last, se_hist, covered, count = [], [], [], 0, 0
        for key in sorted(keys_by_family.get(family, ())):
            train = transitions(timeline, family, key, "2024")
            model = fit_ridge(train)
            if not model:
                continue
            test = [r for r in transitions(timeline, family, key, "2025") if r["season"] == "2025"]
            sd = model["y_sd"] or 1.0
            for r in test:
                pred = predict(model, r["x"])
                se_model.append(((pred - r["y"]) / sd) ** 2)
                se_last.append(((r["x"][0] - r["y"]) / sd) ** 2)
                se_hist.append(((r["x"][2] - r["y"]) / sd) ** 2)
                count += 1
                if abs(pred - r["y"]) <= 1.2816 * model["resid_sd"]:
                    covered += 1
        if count:
            report[family] = {
                "n": count,
                "rmse_ridge": round(float(np.sqrt(np.mean(se_model))), 4),
                "rmse_last_season": round(float(np.sqrt(np.mean(se_last))), 4),
                "rmse_history_mean": round(float(np.sqrt(np.mean(se_hist))), 4),
                "coverage_80": round(covered / count, 4),
            }
    return report
