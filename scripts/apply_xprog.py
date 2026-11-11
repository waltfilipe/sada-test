#!/usr/bin/env python3
"""Anexa `xprog` (progressao esperada) aos JSONs de zagueiros, laterais,
meio-campistas e extremos (inclui meias ofensivos).

Modelo (por liga + temporada + familia, OLS):
    E[passes progressivos/90] = a + b*passes/90 + c*%passe + d*passes/90 do time
    E[% acerto progressivo]   = a + b*%passe + c*progressivos/90

`passes/90 do time` e a media (ponderada por minutos, sem goleiros) de passes/90
do elenco na mesma liga+temporada — proxy de posse/estilo de jogo. O residuo
(real - esperado) e o sinal: quanto o atleta progride alem do que o seu volume,
precisao e contexto de time prevem.

Escreve em profiles/*.json + family-*.json (liga corrente e seasons/<ano>).
Casamento por (nome, clube) normalizado, como apply_pass_distance.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.leagues import LEAGUES  # noqa: E402
from engine.load_data import load_players_dataframe  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
HIST = ROOT / "wyscout" / "historical"
FAMILIES = ("zagueiros", "laterais", "meio-campistas", "extremos")
TEAM_COLS = ("Equipa dentro de um período de tempo seleccionado", "Equipe")
MIN_FIT_PRIMARY = 600
MIN_FIT_FALLBACK = 300
MIN_PREDICT = 270
MIN_FIT_N = 25
MIN_TEAM_PLAYERS = 5

SNAPSHOTS: list[tuple[str, str, Path]] = [
    (league, year, HIST / f"{league}-{year}.xlsx")
    for league in ("serie-a", "serie-b", "serie-c")
    for year in ("2022", "2023", "2024", "2025")
]


def norm(value: object) -> str:
    return str(value or "").strip().casefold()


def col_of(df: pd.DataFrame, *needles: str, exclude: tuple[str, ...] = ()) -> str | None:
    for c in df.columns:
        name = str(c)
        if all(n in name for n in needles) and not any(x in name for x in exclude):
            return c
    return None


def num(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def build_frame(df: pd.DataFrame) -> pd.DataFrame | None:
    c_name = "Jogador" if "Jogador" in df.columns else None
    c_club = "Equipe" if "Equipe" in df.columns else None
    c_min = col_of(df, "Minutos jogados")
    c_p90 = "Passes/90" if "Passes/90" in df.columns else None
    c_pct = "Passes certos, %" if "Passes certos, %" in df.columns else None
    c_prog = "Passes progressivos/90" if "Passes progressivos/90" in df.columns else None
    c_acc = "Passes progressivos certos, %" if "Passes progressivos certos, %" in df.columns else None
    c_pos = "Posição" if "Posição" in df.columns else None
    if not all((c_name, c_club, c_min, c_p90, c_pct, c_prog)):
        return None
    team_col = next((c for c in TEAM_COLS if c in df.columns), c_club)
    out = pd.DataFrame(
        {
            "name": df[c_name].map(norm),
            "club": df[c_club].map(norm),
            "team": df[team_col].fillna(df[c_club]).map(norm),
            "min": num(df[c_min]),
            "p90": num(df[c_p90]),
            "pct": num(df[c_pct]),
            "prog": num(df[c_prog]),
            "acc": num(df[c_acc]) if c_acc else np.nan,
            "gk": df[c_pos].astype(str).str.upper().str.startswith("GK") if c_pos else False,
        }
    )
    return out


def team_volume(frame: pd.DataFrame) -> pd.Series:
    field = frame[(~frame["gk"]) & frame["p90"].notna() & (frame["min"] > 0)]
    league_mean = float(np.average(field["p90"], weights=field["min"])) if len(field) else 0.0
    vols: dict[str, float] = {}
    for team, g in field.groupby("team"):
        vols[team] = (
            float(np.average(g["p90"], weights=g["min"])) if len(g) >= MIN_TEAM_PLAYERS else league_mean
        )
    return frame["team"].map(vols).fillna(league_mean)


def ols(X: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, float, float]:
    A = np.column_stack([np.ones(len(X)), X])
    beta, *_ = np.linalg.lstsq(A, y, rcond=None)
    resid = y - A @ beta
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - float((resid**2).sum()) / ss_tot if ss_tot > 0 else 0.0
    dof = max(len(y) - A.shape[1], 1)
    sd = float(np.sqrt((resid**2).sum() / dof))
    return beta, r2, sd


def family_rows(league_dir: Path, family: str) -> list[tuple[str, str]]:
    path = league_dir / f"family-{family}.json"
    if not path.is_file():
        return []
    blob = json.loads(path.read_text(encoding="utf-8"))
    players = blob.get("players") if isinstance(blob, dict) else blob
    return [(norm(p.get("name")), norm(p.get("club"))) for p in players or [] if isinstance(p, dict)]


def compute(frame: pd.DataFrame, league_dir: Path) -> dict[tuple[str, str, str], dict]:
    frame = frame.copy()
    frame["team_p"] = team_volume(frame)
    frame = frame.reset_index(drop=True)
    lookup: dict[tuple[str, str], int] = {}
    for col in ("club", "team"):
        for i, (n, c) in enumerate(zip(frame["name"], frame[col])):
            lookup.setdefault((n, c), i)
    result: dict[tuple[str, str, str], dict] = {}
    for family in FAMILIES:
        pairs = {k: lookup[k] for k in family_rows(league_dir, family) if k in lookup}
        if not pairs:
            continue
        g = frame.loc[sorted(set(pairs.values()))].copy()
        row_keys: dict[int, list[tuple[str, str]]] = {}
        for k, i in pairs.items():
            row_keys.setdefault(i, []).append(k)
        valid = g[g[["p90", "pct", "prog", "team_p"]].notna().all(axis=1) & (g["p90"] > 0)]
        fit = valid[valid["min"] >= MIN_FIT_PRIMARY]
        if len(fit) < MIN_FIT_N:
            fit = valid[valid["min"] >= MIN_FIT_FALLBACK]
        if len(fit) < MIN_FIT_N:
            continue
        X = fit[["p90", "pct", "team_p"]].to_numpy(float)
        beta, r2, sd = ols(X, fit["prog"].to_numpy(float))
        fit_pred = np.column_stack([np.ones(len(X)), X]) @ beta
        fit_delta = np.sort(fit["prog"].to_numpy(float) - fit_pred)

        fit_acc = fit[fit["acc"].notna()]
        acc_model = None
        if len(fit_acc) >= MIN_FIT_N:
            acc_beta, acc_r2, acc_sd = ols(fit_acc[["pct", "prog"]].to_numpy(float), fit_acc["acc"].to_numpy(float))
            acc_model = (acc_beta, acc_r2, acc_sd)

        for ridx, r in valid[valid["min"] >= MIN_PREDICT].iterrows():
            exp = float(beta[0] + beta[1] * r["p90"] + beta[2] * r["pct"] + beta[3] * r["team_p"])
            delta = float(r["prog"] - exp)
            pct_rank = float(np.searchsorted(fit_delta, delta, side="right") / len(fit_delta) * 100)
            entry = {
                "actual": round(float(r["prog"]), 2),
                "expected": round(exp, 2),
                "delta": round(delta, 2),
                "delta_pct": round(pct_rank, 1),
                "passes90": round(float(r["p90"]), 1),
                "pass_pct": round(float(r["pct"]), 1),
                "team_p90": round(float(r["team_p"]), 1),
                "sd": round(sd, 2),
                "r2": round(float(r2), 3),
                "n": int(len(fit)),
                "low_sample": bool(r["min"] < MIN_FIT_PRIMARY),
            }
            if acc_model is not None and pd.notna(r["acc"]):
                a_beta, a_r2, _ = acc_model
                a_exp = float(a_beta[0] + a_beta[1] * r["pct"] + a_beta[2] * r["prog"])
                entry["acc_actual"] = round(float(r["acc"]), 1)
                entry["acc_expected"] = round(a_exp, 1)
                entry["acc_delta"] = round(float(r["acc"]) - a_exp, 1)
                entry["acc_r2"] = round(float(a_r2), 3)
            for name, club in row_keys.get(ridx, []):
                result[(family, name, club)] = entry
    return result


def patch_players(players: list, family: str, mapping: dict) -> tuple[int, bool]:
    written = 0
    dirty = False
    for player in players:
        if not isinstance(player, dict):
            continue
        key = (family, norm(player.get("name")), norm(player.get("club")))
        value = mapping.get(key)
        if value is None:
            if "xprog" in player:
                player.pop("xprog")
                dirty = True
            continue
        if player.get("xprog") != value:
            player["xprog"] = value
            written += 1
            dirty = True
    return written, dirty


def patch_dir(target_dir: Path, mapping: dict) -> int:
    written = 0
    for family in FAMILIES:
        path = target_dir / f"family-{family}.json"
        if not path.is_file():
            continue
        blob = json.loads(path.read_text(encoding="utf-8"))
        players = blob.get("players") if isinstance(blob, dict) else blob
        if not isinstance(players, list):
            continue
        w, dirty = patch_players(players, family, mapping)
        if dirty:
            path.write_text(json.dumps(blob, ensure_ascii=False), encoding="utf-8")
        written += w
        profiles = target_dir / "profiles"
        if profiles.is_dir():
            for player in players:
                pid = player.get("player_id") if isinstance(player, dict) else None
                pp = profiles / f"{pid}.json" if pid else None
                if pp and pp.is_file():
                    prof = json.loads(pp.read_text(encoding="utf-8"))
                    _, pd_dirty = patch_players([prof], family, mapping)
                    if pd_dirty:
                        pp.write_text(json.dumps(prof, ensure_ascii=False), encoding="utf-8")
    return written


def child_dirs(league_id: str) -> list[Path]:
    """Sub-ligas (est-nv1-paulista etc.) compartilham o modelo da liga-base."""
    return [
        d
        for d in sorted(DATA_DIR.iterdir())
        if d.is_dir() and d.name.startswith(f"{league_id}-") and d.name not in LEAGUES
    ]


def run_one(label: str, df: pd.DataFrame, base_dir: Path, extra_dirs: list[Path]) -> None:
    frame = build_frame(df)
    if frame is None:
        print(f"{label}: colunas de passe ausentes")
        return
    mapping = compute(frame, base_dir)
    total = patch_dir(base_dir, mapping)
    for d in extra_dirs:
        total += patch_dir(d, mapping)
    print(f"{label}: {len(mapping)} atletas com xProg ({total} gravados)")


def main() -> None:
    for league_id in LEAGUES:
        league_dir = DATA_DIR / league_id
        if not league_dir.is_dir():
            continue
        try:
            df = load_players_dataframe(league_id)
        except Exception as exc:  # noqa: BLE001
            print(f"{league_id}: falha ao ler xlsx ({exc})")
            continue
        run_one(league_id, df, league_dir, child_dirs(league_id))

    for league_id, year, xlsx in SNAPSHOTS:
        season_dir = DATA_DIR / league_id / "seasons" / year
        if not xlsx.is_file() or not season_dir.is_dir():
            continue
        try:
            df = load_players_dataframe(league_id, xlsx_override=[xlsx])
        except Exception as exc:  # noqa: BLE001
            print(f"{league_id}/{year}: falha ao ler xlsx ({exc})")
            continue
        run_one(f"{league_id}/{year}", df, season_dir, [])

    from build_estadual_historical_seasons import estadual_season_snapshots

    for league_id, year, xlsx_files in estadual_season_snapshots():
        season_dir = DATA_DIR / league_id / "seasons" / year
        if not season_dir.is_dir():
            continue
        try:
            df = load_players_dataframe(league_id, xlsx_override=xlsx_files)
        except Exception as exc:  # noqa: BLE001
            print(f"{league_id}/{year}: falha ao ler xlsx ({exc})")
            continue
        run_one(f"{league_id}/{year}", df, season_dir, [])

    # Campeonatos estaduais individuais (est-<slug>): cada ano tem xlsx proprio.
    from build_est_championships import CHAMPIONSHIPS, sources_for

    for slug, _label, level, file_base, history in CHAMPIONSHIPS:
        league_id = f"est-{slug}"
        years = sources_for(slug, file_base, history)
        latest = max(years) if years else ""
        for year, xlsx in sorted(years.items()):
            dirs = [DATA_DIR / league_id if year == latest else DATA_DIR / league_id / "seasons" / year]
            if year == latest and latest != "2026":
                dirs.append(DATA_DIR / league_id / "seasons" / year)
            dirs = [d for d in dirs if d.is_dir()]
            if not dirs or not xlsx.is_file():
                continue
            try:
                df = load_players_dataframe(level, xlsx_override=[xlsx], prefer_period_club=True)
            except Exception as exc:  # noqa: BLE001
                print(f"{league_id}/{year}: falha ao ler xlsx ({exc})")
                continue
            for season_dir in dirs:
                run_one(f"{league_id}/{year}", df, season_dir, [])


if __name__ == "__main__":
    main()
