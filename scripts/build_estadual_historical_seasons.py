#!/usr/bin/env python3
"""Build archived seasons for est-nv* leagues from Wyscout exports.

O usuário fornece um xlsx por campeonato/ano em ESTADUAIS_SRC (sem coluna
`Campeonato`). O script sincroniza cópias canônicas em
`wyscout/historical/estaduais/{campeonato}-{ano}.xlsx` já com `Campeonato`
carimbado — é o que alimenta o filtro `competition_level` no load e rotula
cada linha com o campeonato real nos JSONs da temporada.

Depois chama `build_league` por (nível, ano) escrevendo em
`data/{liga}/seasons/{ano}` e carimba `competition` ("Paulista A2"...) nos
players.json/family-*.json do snapshot.

Nota: "Paranaense 2022.xlsx" contém a elite do Paranaense 2023 (Galo
Maringá, Independente FSJ e Foz do Iguaçu estrearam em 2023); o arquivo
"... CERTO.xlsx" tem Paraná/União PR, o elenco real de 2022.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from apply_estadual_competition import CHAMP_LABEL  # noqa: E402
from build_site_data import build_league  # noqa: E402
from engine.estaduais_championship import competition_level  # noqa: E402
from engine.load_data import load_players_dataframe  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ESTADUAIS_SRC = Path(r"C:\Users\Walt\Desktop\Estaduais")
CANON_DIR = ROOT / "wyscout" / "historical" / "estaduais"

# campeonato -> { temporada: arquivo fonte }
SOURCES: dict[str, dict[str, str]] = {
    "carioca": {y: f"Carioca {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "gaucho": {y: f"Gaucho {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "mineiro": {y: f"Mineiro {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "paulista-a1": {y: f"Paulista A1 {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "baiano": {y: f"Baiano {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "catarinense": {y: f"Catarinense {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "paranaense": {
        "2022": "Paranaense 2022 CERTO.xlsx",
        "2023": "Paranaense 2022.xlsx",  # export realmente da temporada 2023
        "2024": "Paranaense 2024.xlsx",
        "2025": "Paranaense 2025.xlsx",
    },
    "paulista-a2": {y: f"Paulista A2 {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    "paulista-a3": {y: f"Paulista A3 {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
    # Copa Paulista (Nv4) — sem edicao 2026 ainda (torneio de 2o semestre).
    "copa-paulista": {y: f"Outros/Copa Paulista {y}.xlsx" for y in ("2022", "2023", "2024", "2025")},
}


def log(msg: str) -> None:
    print(msg, flush=True)


def sync_sources() -> dict[str, dict[str, Path]]:
    """Stamp `Campeonato` and store canonical xlsx under wyscout/historical."""
    out: dict[str, dict[str, Path]] = defaultdict(dict)
    CANON_DIR.mkdir(parents=True, exist_ok=True)
    for comp, years in SOURCES.items():
        for year, filename in years.items():
            src = ESTADUAIS_SRC / filename
            dst = CANON_DIR / f"{comp}-{year}.xlsx"
            if not src.is_file():
                log(f"!! fonte ausente: {src}")
                continue
            if not dst.is_file():
                df = pd.read_excel(src)
                df["Campeonato"] = comp
                # O loader (_read_wyscout_frame) exige sheet "Search results*".
                df.to_excel(dst, index=False, sheet_name="Search results")
                log(f"sync {dst.name} <- {filename} ({len(df)} linhas)")
            out[comp][year] = dst
    return out


def estadual_season_snapshots() -> list[tuple[str, str, list[Path]]]:
    """(league_id, year, [xlsx canon]) — reuso em apply_xprog/pass_distance."""
    grouped: dict[tuple[str, str], list[Path]] = defaultdict(list)
    if not CANON_DIR.is_dir():
        return []
    for path in sorted(CANON_DIR.glob("*.xlsx")):
        comp, _, year = path.stem.rpartition("-")
        level = competition_level(comp)
        if level and year.isdigit():
            grouped[(level, year)].append(path)
    return [(league, year, sorted(paths)) for (league, year), paths in sorted(grouped.items())]


def grouped_by_level(canon: dict[str, dict[str, Path]]) -> dict[tuple[str, str], list[Path]]:
    """(league_id, year) -> [xlsx canon]."""
    grouped: dict[tuple[str, str], list[Path]] = defaultdict(list)
    for comp, years in canon.items():
        level = competition_level(comp)
        if not level:
            log(f"!! {comp} sem nível — pulando")
            continue
        for year, path in years.items():
            grouped[(level, year)].append(path)
    for key in grouped:
        grouped[key].sort()
    return grouped


def stamp_competition(league_id: str, out_dir: Path, xlsx_files: list[Path]) -> None:
    df = load_players_dataframe(league_id, xlsx_override=xlsx_files, prefer_period_club=True)
    comp_by_id = {
        str(row["player_id"]): CHAMP_LABEL.get(str(row["Campeonato"]).strip(), str(row["Campeonato"]).strip())
        for _, row in df.iterrows()
        if str(row.get("Campeonato") or "").strip()
    }
    stamped = 0
    for path in [out_dir / "players.json", *sorted(out_dir.glob("family-*.json"))]:
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        touched = False
        for row in payload.get("players", []):
            comp = comp_by_id.get(row.get("player_id") or "")
            if comp and row.get("competition") != comp:
                row["competition"] = comp
                touched = True
                stamped += 1
        if touched:
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"  competition carimbado em {stamped} linhas ({len(comp_by_id)} ids)")


def main() -> None:
    only = {arg for arg in sys.argv[1:] if "/" in arg}  # ex.: est-nv3/2025
    canon = sync_sources()
    grouped = grouped_by_level(canon)
    for (league_id, year), files in sorted(grouped.items()):
        if only and f"{league_id}/{year}" not in only:
            continue
        out_dir = DATA / league_id / "seasons" / year
        log(f"\n=== {league_id} {year}: {[p.name for p in files]} ===")
        build_league(
            league_id,
            out_dir=out_dir,
            xlsx_override=files,
            season_label=year,
            skip_heatmaps=True,
            skip_physical_run=True,
            skip_transfermarkt=True,
            skip_sofascore=True,
            skip_profiles_dir=True,
            prefer_period_club=True,
        )
        stamp_competition(league_id, out_dir, files)


if __name__ == "__main__":
    main()
