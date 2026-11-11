#!/usr/bin/env python3
"""Paulista A2 como bloco proprio com pool multi-ano (piloto).

Percentis, notas e classificacao de perfil sao ajustados no pool
Paulista A2 2022-2026 inteiro (nao por temporada): um meio-campista de 2025
com 9 passes progressivos/90 e comparado a todos os meio-campistas do A2 de
2022 a 2026.

Saida: data/est-paua2/ (temporada 2026) + data/est-paua2/seasons/{2022..2025}.
Depois dele: link_paua2_athletes.py + apply_athlete_ids.py.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import pandas as pd  # noqa: E402

from apply_pass_distance import pass_distance_map, patch_league_dir  # noqa: E402
from apply_xprog import run_one as apply_xprog_run  # noqa: E402
from engine.json_util import dumps_json  # noqa: E402
from engine.load_data import load_players_dataframe  # noqa: E402
from engine.measures import attach_base_measures  # noqa: E402
from engine.pool_reference import reference_pool  # noqa: E402
from engine.positions import (  # noqa: E402
    POSITION_FAMILIES,
    SCATTER_METRICS,
    attach_aspect_percentiles,
    build_player_payload,
    compute_family_metrics,
)
from engine.sofascore import attach_sofascore_metrics  # noqa: E402

DATA = ROOT / "data"
LEAGUE = "est-paua2"
COMP_LABEL = "Paulista A2"

# ano -> (xlsx, csv defensivo)
YEARS: dict[str, tuple[Path, Path]] = {
    "2022": (ROOT / "wyscout/historical/estaduais/paulista-a2-2022.xlsx", ROOT / "PAUA222_defensive.csv"),
    "2023": (ROOT / "wyscout/historical/estaduais/paulista-a2-2023.xlsx", ROOT / "PAUA223_defensive.csv"),
    "2024": (ROOT / "wyscout/historical/estaduais/paulista-a2-2024.xlsx", ROOT / "PAUA224_defensive.csv"),
    "2025": (ROOT / "wyscout/historical/estaduais/paulista-a2-2025.xlsx", ROOT / "PAUA225_defensive.csv"),
    "2026": (ROOT / "wyscout/2026/estaduais/paulista-a2.xlsx", ROOT / "BRE26NV2_defensive.csv"),
}
CURRENT_YEAR = "2026"


def log(msg: str) -> None:
    print(msg, flush=True)


def load_year(year: str) -> pd.DataFrame:
    xlsx, def_csv = YEARS[year]
    df = load_players_dataframe("est-nv2", xlsx_override=[xlsx], prefer_period_club=True)
    df = attach_base_measures(df)
    df = attach_sofascore_metrics(df, path=def_csv, require_club=True, championship="paulista-a2")
    df["Temporada"] = year
    # player_id season-scoped: o mesmo slug em anos diferentes nao pode colidir
    # no drop_duplicates do compute_family_metrics (pool unico multi-ano).
    df["player_id"] = [
        f"{LEAGUE}-{slug.removeprefix('est-nv2-')}-{year}" for slug in df["player_id"].astype(str)
    ]
    return df[df["Posição"] != "Goleiro"].copy()


def write_year(out_dir: Path, year: str, players: list[dict], family_payloads: dict[str, list[dict]], year_df: pd.DataFrame) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    players_index = [
        {
            "player_id": p["player_id"],
            "name": p["name"],
            "club": p["club"],
            "label": p["label"],
            "position": p["position"],
            "position_family": p["position_family"],
            "nationality": p["nationality"],
            "birth_year": p["birth_year"],
            "height": p["height"],
            "foot": p["foot"],
            "minutes": p["minutes"],
            "minutes_pct": p.get("minutes_pct"),
            "rating": p["rating"],
            "profile": p["profile"],
            "hybrid_lean": p.get("hybrid_lean"),
            "cluster": p.get("cluster"),
            "competition": p.get("competition"),
            "transfermarkt": p.get("transfermarkt"),
            "athlete_id": p.get("athlete_id"),
            "person_key": p.get("person_key"),
        }
        for p in players
    ]
    clubs = sorted({str(c) for c in year_df["Equipe"].dropna().unique()})
    nationalities = sorted({str(n) for n in year_df["Naturalidade"].dropna().unique()})
    valid_heights = year_df["Altura"][year_df["Altura"] > 0]
    meta = {
        "league_id": LEAGUE,
        "league": COMP_LABEL,
        "season": year,
        "source": "xlsx",
        "pool_scope": "Paulista A2 · 2022–2026",
        "player_count": len(players),
        "families": [
            {
                "key": key,
                "label": POSITION_FAMILIES[key]["label"],
                "positions": POSITION_FAMILIES[key]["positions"],
                "profiles": POSITION_FAMILIES[key]["profiles"],
                "count": len(family_payloads.get(key, [])),
            }
            for key in POSITION_FAMILIES
        ],
        "clubs": clubs,
        "nationalities": nationalities,
        "filters": {
            "height": [int(valid_heights.min()), int(valid_heights.max())] if len(valid_heights) else [160, 200],
            "minutes": [0, int(year_df["Minutos jogados:"].max())],
            "birth_year": [int(year_df["Nascimento"].min()), int(year_df["Nascimento"].max())],
            "rating": [
                round(float(min(p["rating"] for p in players)), 1) if players else 0.0,
                round(float(max(p["rating"] for p in players)), 1) if players else 0.0,
            ],
        },
        "scatter_metrics": SCATTER_METRICS,
        "heatmaps_enabled": False,
        "physical_run_enabled": False,
    }
    (out_dir / "players.json").write_text(
        dumps_json({"players": players_index, "total": len(players_index)}), encoding="utf-8"
    )
    (out_dir / "meta.json").write_text(dumps_json(meta), encoding="utf-8")
    for family_key, fplayers in family_payloads.items():
        (out_dir / f"family-{family_key}.json").write_text(
            dumps_json({"family": family_key, "players": fplayers}), encoding="utf-8"
        )
    log(f"  {out_dir.name if out_dir.name != LEAGUE else year}: {len(players)} jogadores")


def _norm(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def backfill_tm_blocks() -> int:
    fixed = 0
    for year in YEARS:
        nv2_dir = DATA / "est-nv2" if year == CURRENT_YEAR else DATA / "est-nv2" / "seasons" / year
        p2_dir = DATA / LEAGUE if year == CURRENT_YEAR else DATA / LEAGUE / "seasons" / year
        try:
            nv2_players = json.loads((nv2_dir / "players.json").read_text(encoding="utf-8")).get("players", [])
        except OSError:
            continue
        idx = {
            (_norm(r.get("name")), _norm(r.get("club")), str(r.get("birth_year") or "")): r["transfermarkt"]
            for r in nv2_players
            if (r.get("transfermarkt") or {}).get("id")
        }
        for fp in [p2_dir / "players.json", *sorted(p2_dir.glob("family-*.json"))]:
            try:
                payload = json.loads(fp.read_text(encoding="utf-8"))
            except OSError:
                continue
            changed = False
            for r in payload.get("players", []):
                if r.get("transfermarkt"):
                    continue
                tm = idx.get((_norm(r.get("name")), _norm(r.get("club")), str(r.get("birth_year") or "")))
                if tm:
                    r["transfermarkt"] = tm
                    fixed += 1
                    changed = True
            if changed:
                fp.write_text(dumps_json(payload), encoding="utf-8")
    log(f"bloco TM replicado do Nv2 em {fixed} linhas")
    return fixed


def main() -> None:
    log("=== est-paua2: pool multi-ano 2022-2026 ===")
    frames = [load_year(year) for year in YEARS]
    merged = pd.concat(frames, ignore_index=True)
    log(f"pool: {len(merged)} linhas")

    pid_year: dict[str, str] = dict(zip(merged["player_id"].astype(str), merged["Temporada"]))
    year_df: dict[str, pd.DataFrame] = dict(zip(YEARS, frames))

    by_year_players: dict[str, list[dict]] = defaultdict(list)
    by_year_family: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))

    for family_key, family in POSITION_FAMILIES.items():
        computed = compute_family_metrics(merged, family_key, publish_all=True)
        reference_index = computed.attrs.get("reference_index")
        if reference_index is not None:
            with reference_pool(reference_index):
                computed = attach_aspect_percentiles(computed)
        else:
            computed = attach_aspect_percentiles(computed)
        pool_size = len(computed)
        log(f"  {family['label']}: {pool_size} no pool multi-ano")
        for _, row in computed.iterrows():
            player = build_player_payload(row, family_key, pool_size)
            player["competition"] = COMP_LABEL
            year = pid_year.get(str(row.get("player_id") or row.name), "")
            if not year:
                continue
            by_year_players[year].append(player)
            by_year_family[year][family_key].append(player)

    for year, df_y in year_df.items():
        out_dir = DATA / LEAGUE if year == CURRENT_YEAR else DATA / LEAGUE / "seasons" / year
        write_year(out_dir, year, by_year_players[year], by_year_family[year], df_y)

    # Bloco transfermarkt (foto, valor de mercado, url) nao e reenriquecido
    # aqui — replica da linha est-nv2 equivalente (nome+clube+nasc na mesma
    # temporada), sem chamada de rede.
    backfill_tm_blocks()

    # xProg + distancia de passe por temporada (modelo fit por ano, como nos
    # snapshots de nivel).
    for year, (xlsx, _csv) in YEARS.items():
        season_dir = DATA / LEAGUE if year == CURRENT_YEAR else DATA / LEAGUE / "seasons" / year
        df = load_players_dataframe("est-nv2", xlsx_override=[xlsx], prefer_period_club=True)
        apply_xprog_run(f"{LEAGUE}/{year}", df, season_dir, [])
        mapping = pass_distance_map(df)
        written, present = patch_league_dir(season_dir, mapping)
        log(f"{LEAGUE}/{year}: {present} com distancia ({written} gravados)")


if __name__ == "__main__":
    main()
