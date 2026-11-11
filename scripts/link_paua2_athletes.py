#!/usr/bin/env python3
"""Propaga athlete_id das linhas est-nv2 -> est-paua2 (mesma temporada).

O bloco est-paua2 replica o recorte Paulista A2 do Nv2 com percentis
multi-ano. Cada linha est-paua2/{ano} corresponde a uma linha
est-nv2/{ano} do mesmo campeonato: o join e por (nome, clube, ano de
nascimento) dentro da mesma temporada + Campeonato=paulista-a2, e so grava
`row_athlete` quando o par e unico e a linha Nv2 ja tem athlete_id
verificado. Depois rode apply_athlete_ids.py para carimbar.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"
OVERRIDES = XS / "identity-overrides.json"

SEASONS = ["2022", "2023", "2024", "2025", "2026"]


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError:
        return default


def season_dir(league: str, season: str) -> Path:
    return DATA / league if season == "2026" else DATA / league / "seasons" / season


def rows_of(path: Path) -> list[dict]:
    payload = load_json(path, None)
    if payload is None:
        return []
    rows = payload.get("players") if isinstance(payload, dict) else payload
    return rows if isinstance(rows, list) else []


def norm(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def main() -> int:
    overrides = load_json(OVERRIDES, {})
    row_athlete: dict = overrides.setdefault("row_athlete", {})

    added = skipped_amb = skipped_no_athlete = already = 0
    for season in SEASONS:
        nv2_dir = season_dir("est-nv2", season)
        paua2_dir = season_dir("est-paua2", season)
        if not paua2_dir.is_dir():
            continue

        # indice Nv2: (nome, clube, nasc) -> athlete_id (so linhas A2 com id)
        index: dict[tuple[str, str, str], set[str]] = defaultdict(set)
        for row in rows_of(nv2_dir / "players.json"):
            if not row.get("athlete_id"):
                continue
            key = (norm(row.get("name")), norm(row.get("club")), str(row.get("birth_year") or ""))
            index[key].add(row["athlete_id"])

        for row in rows_of(paua2_dir / "players.json"):
            key = (norm(row.get("name")), norm(row.get("club")), str(row.get("birth_year") or ""))
            athletes = index.get(key) or set()
            override_key = f"est-paua2/{season}/{row.get('player_id')}"
            if override_key in row_athlete:
                already += 1
                continue
            if len(athletes) == 1:
                row_athlete[override_key] = next(iter(athletes))
                added += 1
            elif len(athletes) > 1:
                skipped_amb += 1
            else:
                skipped_no_athlete += 1

    OVERRIDES.write_text(json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"row_athlete: +{added} | ja existiam {already} | ambiguos {skipped_amb} | sem athlete na Nv2 {skipped_no_athlete}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
