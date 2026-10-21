#!/usr/bin/env python3
"""Build JSON archives from Wyscout competition exports (2025)."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
IMPORT_DIR = ROOT / "data" / "import" / "wyscout"
OUT_DIR = ROOT / "data" / "athletes"

LEAGUE_FILES = {
    "serie-a": "serie-a-2025.xlsx",
    "serie-b": "serie-b-2025.xlsx",
    "serie-c": "serie-c-2025.xlsx",
}

CLUB_COL = "Equipa dentro de um período de tempo seleccionado"
FALLBACK_CLUB_COL = "Equipa"


def norm(text: str) -> str:
    if not text or (isinstance(text, float) and pd.isna(text)):
        return ""
    s = unicodedata.normalize("NFKD", str(text))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
    return s


def num(value) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def int_num(value) -> int | None:
    n = num(value)
    if n is None:
        return None
    return int(round(n))


def club_name(row: pd.Series) -> str:
    for col in (CLUB_COL, FALLBACK_CLUB_COL):
        if col in row and pd.notna(row[col]) and str(row[col]).strip():
            return str(row[col]).strip()
    return "—"


def row_to_record(row: pd.Series, league: str) -> dict:
    wy_id = str(row.get("ID Jogador", "")).strip()
    name = str(row.get("Jogador", "")).strip()
    club = club_name(row)
    return {
        "archive_id": f"archive-{league}-2025-{norm(name).replace(' ', '-')[:48]}-{wy_id or 'na'}",
        "wyscout_id": wy_id or None,
        "season": "2025",
        "league": league,
        "name": name,
        "club": club,
        "position": str(row.get("Posição", "")).strip() or None,
        "age": int_num(row.get("Idade")),
        "nationality": str(row.get("País de nacionalidade", "")).strip() or None,
        "foot": str(row.get("Pé", "")).strip() or None,
        "height": int_num(row.get("Altura")) if int_num(row.get("Altura")) else None,
        "minutes": int_num(row.get("Minutos jogados:")) or 0,
        "matches": int_num(row.get("Partidas jogadas")) or 0,
        "goals": int_num(row.get("Golos")) or 0,
        "assists": int_num(row.get("Assistências")) or 0,
        "xg": num(row.get("Golos esperados")),
        "xa": num(row.get("Assistências esperadas")),
        "market_value_eur": int_num(row.get("Valor de mercado")),
        "match_key": f"{norm(name)}|{norm(club)}",
        "highlights": {
            "gols_90": num(row.get("Golos/90")),
            "assistencias_90": num(row.get("Assistências/90")),
            "duelos_90": num(row.get("Duelos/90")),
            "duelos_ganhos_pct": num(row.get("Duelos ganhos, %")),
            "passes_90": num(row.get("Passes/90")),
            "passes_certos_pct": num(row.get("Passes certos, %")),
            "passes_progressivos_90": num(row.get("Passes progressivos/90")),
            "acoes_def_90": num(row.get("Ações defensivas com êxito/90")),
            "remates_90": num(row.get("Remates/90")),
        },
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, list[dict]] = {}

    for league, filename in LEAGUE_FILES.items():
        path = IMPORT_DIR / filename
        if not path.exists():
            print(f"skip missing {path}")
            continue
        df = pd.read_excel(path, sheet_name=0)
        records = [row_to_record(row, league) for _, row in df.iterrows()]
        out_path = OUT_DIR / f"archive-{league}-2025.json"
        payload = {"league": league, "season": "2025", "total": len(records), "players": records}
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest[league] = [{"archive_id": r["archive_id"], "match_key": r["match_key"]} for r in records]
        print(f"wrote {out_path} ({len(records)} players)")

    (OUT_DIR / "archive-index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
