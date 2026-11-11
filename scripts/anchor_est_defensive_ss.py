#!/usr/bin/env python3
"""Âncoras SofaScore de CSVs defensivos de arquivos estaduais.

Para cada (liga, temporada) em SOFASCORE_CSV de
``build_estadual_historical_seasons.py``: casa linhas Wyscout ↔ CSV com
``match_ss_row`` (require_club + filtro por campeonato, idêntico ao attach do
build). Quando o ss_id casado já pertence a **um único** atleta do registro
(âncora ss de séries nacionais), grava ``row_athlete`` no
``identity-overrides.json``. Ambíguos (ss_id com 2+ donos) são pulados.

Rode após rebuilds dos snapshots e antes de ``apply_athlete_ids.py``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_estadual_historical_seasons import SOFASCORE_CSV  # noqa: E402
from engine.load_data import load_players_dataframe  # noqa: E402
from engine.sofascore import aggregate_sofascore, match_ss_row  # noqa: E402

OVERRIDES = ROOT / "data" / "cross-season" / "identity-overrides.json"


def log(msg: str) -> None:
    print(msg, flush=True)


def canon_files(league: str, year: str) -> list[Path]:
    level = {"est-nv1", "est-nv2", "est-nv3", "est-nv4"}
    if league not in level:
        return []
    prefix = league.split("-")[1]
    out = []
    for path in sorted((ROOT / "wyscout" / "historical" / "estaduais").glob(f"*-{year}.xlsx")):
        comp = path.stem.rpartition("-")[0]
        from engine.estaduais_championship import competition_level

        if competition_level(comp) == league:
            out.append(path)
    return out


def main() -> int:
    athletes = json.loads((ROOT / "data" / "cross-season" / "athletes.json").read_text(encoding="utf-8"))
    owner: dict[str, set[str]] = {}
    for aid, rec in (athletes.get("athletes") or {}).items():
        for ss in (rec.get("sofascore") or {}).values():
            owner.setdefault(str(ss), set()).add(aid)
    unique_owner = {ss: next(iter(ids)) for ss, ids in owner.items() if len(ids) == 1}

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.is_file() else {}
    row_athlete = overrides.setdefault("row_athlete", {})

    added = skipped_amb = already = 0
    for (league, year), (csv_path, champ) in sorted(SOFASCORE_CSV.items()):
        files = canon_files(league, year)
        if not files or not csv_path.is_file():
            log(f"!! {league}/{year}: sem fonte canon ou csv — pulando")
            continue
        df = load_players_dataframe(league, xlsx_override=files, prefer_period_club=True)
        df = df[df["Campeonato"].astype(str).str.strip() == champ]
        ss = aggregate_sofascore(csv_path)
        for _, row in df.iterrows():
            hit = match_ss_row(row, ss, require_club=True)
            if hit is None:
                continue
            ss_id = str(hit["player_id"])
            aid = unique_owner.get(ss_id)
            if not aid:
                skipped_amb += 1
                continue
            key = f"{league}/{year}/{row['player_id']}"
            if row_athlete.get(key) == aid:
                already += 1
                continue
            row_athlete[key] = aid
            added += 1
        log(f"{league}/{year}: processado ({champ})")

    OVERRIDES.write_text(json.dumps(overrides, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"row_athlete via ss: +{added} | já existentes: {already} | sem dono único: {skipped_amb}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
