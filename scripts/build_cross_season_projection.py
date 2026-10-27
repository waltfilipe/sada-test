#!/usr/bin/env python3
"""Cross-season history index + supervised priors for projection (method 7 variant)."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.json_util import dumps_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BR_LEAGUES = ("serie-a", "serie-b", "serie-c")
SEASONS = ("2022", "2023", "2024", "2025")
CURRENT = "2026"

# Maps projection sample keys (minuteProjection) → aspect path
METRIC_SPECS: dict[str, list[tuple[str, str | None, str]]] = {
    "zagueiros": [
        ("Ações Defensivas::Interceptações", "Ações Defensivas", "Interceptações"),
        ("Duelos Defensivos", "Duelos Defensivos", None),
        ("Passes Progressivos", "Passes Progressivos", None),
    ],
    "laterais": [
        ("Cruzamentos::Cruzamentos", "Cruzamentos", "Cruzamentos"),
        ("Duelos Defensivos", "Duelos Defensivos", None),
        ("Conduções Progressivas", "Conduções Progressivas", None),
    ],
    "meio-campistas": [
        ("Passes Progressivos", "Passes Progressivos", None),
        ("Duelos Defensivos", "Duelos Defensivos", None),
        ("Passes Chave e Área::Passes para Área", "Passes Chave e Área", "Passes para Área"),
    ],
    "extremos": [
        ("1v1 - Ofensivo", "1v1 - Ofensivo", None),
        ("Pré Assistências e xA::Pré Assistências", "Pré Assistências e xA", "Pré Assistências"),
        ("Ações Terminais::Toques na Área", "Ações Terminais", "Toques na Área"),
    ],
    "atacantes": [
        ("Finalização::Finalizações", "Finalização", "Finalizações"),
        ("Ações Terminais::Toques na Área", "Ações Terminais", "Toques na Área"),
        ("Aéreo", "Aéreo", None),
    ],
}


def norm_name(name: str) -> str:
    value = unicodedata.normalize("NFD", name)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    return value


def read_metric(player: dict, aspect: str, sub: str | None) -> float | None:
    aspects = player.get("aspects") or {}
    flat = []
    for group in aspects.values():
        if group:
            flat.extend(group)
    item = next((a for a in flat if a.get("label") == aspect), None)
    if not item:
        return None
    if sub:
        for sm in item.get("sub_metrics") or []:
            if sm.get("label") == sub:
                raw = sm.get("display_value")
                break
        else:
            return None
    else:
        raw = item.get("display_value")
    if raw is None:
        return None
    text = str(raw).replace(",", ".").replace("%", "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def assign_season_keys(rows: list[dict]) -> dict[tuple[str, int], str]:
    """Link seasons by normalized name + birth-year cluster.

    Wyscout archives report the same athlete's birth year inconsistently across
    seasons (±1), so an exact name|birth match loses most history. Rows of the
    same normalized name are clustered by birth proximity (each member within
    ±1 year of the cluster's earliest birth) and share a key.
    """
    by_name: dict[str, list[dict]] = {}
    for row in rows:
        by_name.setdefault(norm_name(row.get("name", "")), []).append(row)
    index: dict[tuple[str, int], str] = {}
    for name, members in by_name.items():
        members.sort(key=lambda r: (r.get("birth_year") or 0))
        cluster_min: int | None = None
        for row in members:
            birth = row.get("birth_year") or 0
            if not birth:
                index[(name, 0)] = f"name:{name}|0"
                continue
            if cluster_min is None or birth - cluster_min > 1:
                cluster_min = birth
            index[(name, birth)] = f"name:{name}|{cluster_min}"
    return index


def load_season_players(league: str, season: str) -> list[dict]:
    if season == CURRENT:
        base = DATA / league
    else:
        base = DATA / league / "seasons" / season
    out: list[dict] = []
    for path in base.glob("family-*.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for p in payload.get("players", []):
            p = dict(p)
            p["_season"] = season
            p["_league"] = league
            out.append(p)
    return out


def ridge_predict(y1: float | None, y2: float | None, age: float, league_tier: float, coef: dict) -> float:
    return (
        coef["b0"]
        + coef.get("b_y1", 0) * (y1 or coef.get("fallback", 0))
        + coef.get("b_y2", 0) * (y2 or coef.get("fallback", 0))
        + coef.get("b_age", 0) * age
        + coef.get("b_tier", 0) * league_tier
    )


def fit_ridge(rows: list[dict]) -> dict:
    if len(rows) < 12:
        return {"b0": rows[0]["y"] if rows else 0, "b_y1": 0.55, "b_y2": 0.25, "b_age": 0, "b_tier": 0, "fallback": 0}
    # simple OLS on y ~ y1 + y2 + age + tier
    import numpy as np

    y = np.array([r["y"] for r in rows], dtype=float)
    x = np.array([[1, r["y1"], r["y2"], r["age"], r["tier"]] for r in rows], dtype=float)
    coef, _, _, _ = np.linalg.lstsq(x, y, rcond=None)
    return {
        "b0": float(coef[0]),
        "b_y1": float(coef[1]),
        "b_y2": float(coef[2]),
        "b_age": float(coef[3]),
        "b_tier": float(coef[4]),
        "fallback": float(np.median(y)),
    }


def league_tier(league_id: str) -> float:
    return {"serie-a": 3.0, "serie-b": 2.0, "serie-c": 1.0}.get(league_id, 1.0)


def main() -> None:
    # Index all seasons by clustered player key (computed over every row so
    # minute thresholds don't shift the clusters)
    all_rows: list[dict] = []
    for league in BR_LEAGUES:
        for season in (*SEASONS, CURRENT):
            if season != CURRENT:
                if not (DATA / league / "seasons" / season).is_dir():
                    continue
            all_rows.extend(load_season_players(league, season))
    key_index = assign_season_keys(all_rows)

    timeline: dict[str, list[dict]] = {}
    for p in all_rows:
        if (p.get("minutes") or 0) < 180:
            continue
        key = key_index.get((norm_name(p.get("name", "")), p.get("birth_year") or 0))
        if key:
            timeline.setdefault(key, []).append(p)

    for key in timeline:
        timeline[key].sort(key=lambda r: (r.get("_season") or "", r.get("_league") or ""))

    models: dict[str, dict] = {}

    for league in BR_LEAGUES:
        for family, specs in METRIC_SPECS.items():
            train_rows = []
            for key, rows in timeline.items():
                if len(rows) < 2:
                    continue
                for i in range(1, len(rows)):
                    cur = rows[i]
                    if cur.get("_league") != league or cur.get("position_family") != family:
                        continue
                    if (cur.get("minutes") or 0) < 900:
                        continue
                    prev = rows[i - 1]
                    y = read_metric(cur, specs[0][1], specs[0][2])
                    y1 = read_metric(prev, specs[0][1], specs[0][2])
                    y2 = read_metric(rows[i - 2], specs[0][1], specs[0][2]) if i >= 2 else None
                    if y is None or y1 is None:
                        continue
                    age = 2026 - (cur.get("birth_year") or 1998)
                    train_rows.append(
                        {
                            "y": y,
                            "y1": y1,
                            "y2": y2 or y1,
                            "age": age,
                            "tier": league_tier(prev.get("_league") or league),
                        }
                    )
            model_key = f"{league}:{family}"
            models[model_key] = fit_ridge(train_rows)

    out_models = DATA / "cross-season" / "models.json"
    out_models.parent.mkdir(parents=True, exist_ok=True)
    out_models.write_text(dumps_json(models), encoding="utf-8")

    enriched = 0
    for league in BR_LEAGUES:
        for family, specs in METRIC_SPECS.items():
            path = DATA / league / f"family-{family}.json"
            if not path.is_file():
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            coef = models.get(f"{league}:{family}") or {}
            for player in payload.get("players", []):
                key = key_index.get((norm_name(player.get("name", "")), player.get("birth_year") or 0))
                hist = timeline.get(key, []) if key else []
                past = [h for h in hist if h.get("_season") != CURRENT]
                if not past:
                    continue
                age = 2026 - (player.get("birth_year") or 1998)
                ordered = sorted(past, key=lambda h: h.get("_season") or "")
                y1_row = ordered[-1] if ordered else None
                y2_row = ordered[-2] if len(ordered) >= 2 else None
                metrics: dict[str, dict] = {}
                for sample_key, aspect, sub in specs:
                    hist_vals = []
                    hist_weights = []
                    for h in past:
                        v = read_metric(h, aspect, sub)
                        if v is not None:
                            hist_vals.append(v)
                            hist_weights.append(max(1.0, (h.get("minutes") or 0) / 90))
                    if not hist_vals:
                        continue
                    hist_mean = sum(v * w for v, w in zip(hist_vals, hist_weights)) / sum(hist_weights)
                    y1 = read_metric(y1_row, aspect, sub) if y1_row else None
                    y2 = read_metric(y2_row, aspect, sub) if y2_row else None
                    predicted = ridge_predict(
                        y1,
                        y2,
                        age,
                        league_tier(y1_row.get("_league") if y1_row else league),
                        coef,
                    )
                    # Blend history mean with ridge when we have 2+ seasons
                    if len(hist_vals) >= 2:
                        predicted = 0.45 * predicted + 0.55 * hist_mean
                    else:
                        predicted = hist_mean
                    obs = read_metric(player, aspect, sub)
                    spread = max(hist_vals) - min(hist_vals) if len(hist_vals) >= 2 else 999.0
                    consistent = spread <= max(0.35 * max(hist_mean, 0.01), 0.4)
                    diverges = obs is not None and abs(obs - predicted) > max(0.5 * max(abs(predicted), 0.5), 0.6)
                    flag = diverges and (player.get("minutes_pct") or 100) < 50 and not consistent
                    metrics[sample_key] = {
                        "predicted": round(predicted, 4),
                        "history_mean": round(hist_mean, 4),
                        "consistent": consistent,
                        "role_change_flag": flag,
                    }
                if not metrics:
                    continue
                player["cross_season"] = {
                    "seasons": [
                        {
                            "year": h.get("_season"),
                            "league": h.get("_league"),
                            "minutes": h.get("minutes"),
                            "club": h.get("club"),
                        }
                        for h in past
                    ],
                    "metrics": metrics,
                }
                enriched += 1
            path.write_text(dumps_json(payload), encoding="utf-8")
            # sync profiles
            prof_dir = DATA / league / "profiles"
            if prof_dir.is_dir():
                for player in payload.get("players", []):
                    cid = player.get("player_id")
                    if cid and (prof_dir / f"{cid}.json").is_file():
                        (prof_dir / f"{cid}.json").write_text(dumps_json(player), encoding="utf-8")

    print(f"Wrote models → {out_models}")
    print(f"Enriched {enriched} player rows with cross_season")


if __name__ == "__main__":
    main()
