#!/usr/bin/env python3
"""Estaduais como campeonatos individuais com pool multi-ano.

Cada campeonato vira uma liga propria (est-<slug>): percentis, notas e
classificacao de perfil ajustados no pool de TODAS as temporadas
disponiveis do campeonato (2022-2026), nao por ano nem por nivel.

Saida: data/est-<slug>/ (temporada mais recente) +
data/est-<slug>/seasons/{anos anteriores}.

Depois: link_est_championship_athletes.py + apply_athlete_ids.py.
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
HIST = ROOT / "wyscout/historical/estaduais"
CUR = ROOT / "wyscout/2026/estaduais"

# (slug, rotulo, liga-nivel p/ o loader, arquivo base, tem historico 22-25)
CHAMPIONSHIPS: list[tuple[str, str, str, str, bool]] = [
    ("paulista-a1", "Paulista A1", "est-nv1", "paulista-a1", True),
    ("carioca", "Carioca", "est-nv1", "carioca", True),
    ("gaucho", "Gaúcho", "est-nv1", "gaucho", True),
    ("mineiro", "Mineiro", "est-nv1", "mineiro", True),
    ("paranaense", "Paranaense", "est-nv2", "paranaense", True),
    ("catarinense", "Catarinense", "est-nv2", "catarinense", True),
    ("paulista-a2", "Paulista A2", "est-nv2", "paulista-a2", True),
    ("baiano", "Baiano", "est-nv2", "baiano", True),
    ("cearense", "Cearense", "est-nv3", "cearense", False),
    ("pernambucano", "Pernambucano", "est-nv3", "pernambucano", False),
    ("paulista-a3", "Paulista A3", "est-nv3", "paulista-a3", True),
    ("goiano", "Goiano", "est-nv3", "goiano", False),
    ("paraense", "Paraense", "est-nv4", "paraense", False),
    ("alagoano", "Alagoano", "est-nv4", "alagoano", False),
    ("potiguar", "Potiguar", "est-nv4", "potiguar", False),
    ("paulista-a4", "Paulista A4", "est-nv4", "paulista-a4", False),
    ("copa-paulista", "Copa Paulista", "est-nv4", "copa-paulista", True),
]

DEFENSIVE_CSV: dict[tuple[str, str], Path] = {
    ("paulista-a2", "2022"): ROOT / "PAUA222_defensive.csv",
    ("paulista-a2", "2023"): ROOT / "PAUA223_defensive.csv",
    ("paulista-a2", "2024"): ROOT / "PAUA224_defensive.csv",
    ("paulista-a2", "2025"): ROOT / "PAUA225_defensive.csv",
    ("paulista-a1", "2026"): ROOT / "BRE26NV1_defensive.csv",
    ("carioca", "2026"): ROOT / "BRE26NV1_defensive.csv",
    ("gaucho", "2026"): ROOT / "BRE26NV1_defensive.csv",
    ("mineiro", "2026"): ROOT / "BRE26NV1_defensive.csv",
    ("paranaense", "2026"): ROOT / "BRE26NV2_defensive.csv",
    ("catarinense", "2026"): ROOT / "BRE26NV2_defensive.csv",
    ("paulista-a2", "2026"): ROOT / "BRE26NV2_defensive.csv",
    ("baiano", "2026"): ROOT / "BRE26NV2_defensive.csv",
    ("cearense", "2026"): ROOT / "BRE26NV3_defensive.csv",
    ("pernambucano", "2026"): ROOT / "BRE26NV3_defensive.csv",
    ("paulista-a3", "2026"): ROOT / "BRE26NV3_defensive.csv",
    ("goiano", "2026"): ROOT / "BRE26NV3_defensive.csv",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def sources_for(slug: str, file_base: str, history: bool) -> dict[str, Path]:
    years: dict[str, Path] = {}
    if history:
        for year in ("2022", "2023", "2024", "2025"):
            path = HIST / f"{file_base}-{year}.xlsx"
            if path.exists():
                years[year] = path
    current = CUR / f"{file_base}.xlsx"
    if current.exists():
        years["2026"] = current
    return years


def write_year(
    league: str,
    out_dir: Path,
    year: str,
    label: str,
    pool_scope: str,
    players: list[dict],
    family_payloads: dict[str, list[dict]],
    year_df: pd.DataFrame,
) -> None:
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
        "league_id": league,
        "league": label,
        "season": year,
        "source": "xlsx",
        "pool_scope": pool_scope,
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
    (out_dir / "players.json").write_text(dumps_json({"players": players_index, "total": len(players_index)}), encoding="utf-8")
    (out_dir / "meta.json").write_text(dumps_json(meta), encoding="utf-8")
    for family_key, fplayers in family_payloads.items():
        (out_dir / f"family-{family_key}.json").write_text(
            dumps_json({"family": family_key, "players": fplayers}), encoding="utf-8"
        )
    log(f"    {year}: {len(players)} jogadores -> {out_dir.relative_to(DATA)}")


def build_championship(slug: str, label: str, level: str, file_base: str, history: bool) -> None:
    league = f"est-{slug}"
    years = sources_for(slug, file_base, history)
    if not years:
        log(f"== {league}: sem fontes, pulado")
        return
    latest = max(years)
    first = min(years)
    pool_scope = f"{label} · {first}–{latest}" if first != latest else f"{label} · {latest}"
    log(f"== {league} ({label}): pool {sorted(years)}")

    frames: list[pd.DataFrame] = []
    for year, xlsx in sorted(years.items()):
        df = load_players_dataframe(level, xlsx_override=[xlsx], prefer_period_club=True)
        df = attach_base_measures(df)
        csv = DEFENSIVE_CSV.get((slug, year))
        if csv and csv.exists():
            df = attach_sofascore_metrics(df, path=csv, require_club=True, championship=slug)
            ss_cols = [c for c in df.columns if str(c).startswith("ss_")]
            if ss_cols:
                df[ss_cols] = df[ss_cols].fillna(0)
        df["Temporada"] = year
        df["player_id"] = [f"{league}-{s.removeprefix(level + '-')}-{year}" for s in df["player_id"].astype(str)]
        frames.append(df[df["Posição"] != "Goleiro"].copy())

    merged = pd.concat(frames, ignore_index=True)
    # O concat de anos com esquemas diferentes (stats novas no export 2026,
    # ss_* sem CSV em 22-25) gera NaN — o payload trata ausencia como 0.
    num_cols = [c for c in merged.columns if pd.api.types.is_numeric_dtype(merged[c])]
    if num_cols:
        merged[num_cols] = merged[num_cols].fillna(0)
    log(f"  pool: {len(merged)} linhas")
    pid_year = dict(zip(merged["player_id"].astype(str), merged["Temporada"]))
    year_df = dict(zip(sorted(years), frames))

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
        log(f"  {family['label']}: {len(computed)} no pool")
        for _, row in computed.iterrows():
            player = build_player_payload(row, family_key, len(computed))
            player["competition"] = label
            year = pid_year.get(str(row.get("player_id") or row.name), "")
            if not year:
                continue
            by_year_players[year].append(player)
            by_year_family[year][family_key].append(player)

    for year, df_y in year_df.items():
        out_dir = DATA / league if year == latest else DATA / league / "seasons" / year
        write_year(league, out_dir, year, label, pool_scope, by_year_players[year], by_year_family[year], df_y)
    # Campeonatos sem edicao no ano corrente (Copa Paulista: ultimo dado
    # 2025): o site trata o dir-raiz como o slot corrente e seasons/{ano}
    # para arquivos — a temporada mais recente fica nos dois lugares.
    if latest != "2026":
        df_latest = year_df[latest]
        write_year(league, DATA / league / "seasons" / latest, latest, label, pool_scope, by_year_players[latest], by_year_family[latest], df_latest)

    # xProg + distancia por temporada (fit por ano, como nos snapshots).
    for year, xlsx in sorted(years.items()):
        dirs = [DATA / league if year == latest else DATA / league / "seasons" / year]
        if year == latest and latest != "2026":
            dirs.append(DATA / league / "seasons" / year)
        df = load_players_dataframe(level, xlsx_override=[xlsx], prefer_period_club=True)
        mapping = pass_distance_map(df)
        for season_dir in dirs:
            apply_xprog_run(f"{league}/{year}", df, season_dir, [])
            written, present = patch_league_dir(season_dir, mapping)
            log(f"  {league}/{year}: {present} com distancia ({written} gravados)")


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for slug, label, level, file_base, history in CHAMPIONSHIPS:
        if only and slug != only:
            continue
        build_championship(slug, label, level, file_base, history)


if __name__ == "__main__":
    main()
