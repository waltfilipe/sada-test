#!/usr/bin/env python3
"""Propaga `athlete_id` verificado para linhas históricas de estaduais.

Join determinístico, sem rede: uma linha sem `athlete_id` recebe o id quando
(nome normalizado + birth_year) aponta para **um único** atleta já carimbado
em qualquer liga/temporada E a linha divide clube ou família de posição com
alguma linha daquele atleta — o mesmo critério conservador do restante do
pipeline (âncora verificada, nunca chute por nome).

Os pares entram em `identity-overrides.json` → `row_athlete` (respeitado por
`apply_athlete_ids.py`). Rode depois do backfill/apply_athlete_ids.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OVERRIDES = DATA / "cross-season" / "identity-overrides.json"


def norm(text: str) -> str:
    s = unicodedata.normalize("NFKD", str(text or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def norm_club(text: str) -> str:
    return norm(text)


def iter_player_files():
    for league_dir in sorted(DATA.iterdir()):
        if not league_dir.is_dir() or league_dir.name in {
            "cross-season", "heatmaps", "heatmaps-quarantine", "import", "athletes",
        }:
            continue
        players = league_dir / "players.json"
        if players.is_file():
            meta = {}
            meta_path = league_dir / "meta.json"
            if meta_path.is_file():
                try:
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    pass
            yield league_dir.name, str(meta.get("season") or "2026"), players
        seasons = league_dir / "seasons"
        if seasons.is_dir():
            for child in sorted(seasons.iterdir()):
                if (child / "players.json").is_file():
                    yield league_dir.name, child.name, child / "players.json"


def main() -> None:
    # (nome, ano) -> {athlete_id, clubs, families}
    anchors: dict[tuple[str, int], dict] = defaultdict(
        lambda: {"ids": set(), "clubs": set(), "families": set()}
    )
    files = list(iter_player_files())
    for _league, _season, path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for row in payload.get("players", []):
            ath = row.get("athlete_id")
            if not ath:
                continue
            key = (norm(row.get("name", "")), int(row.get("birth_year") or 0))
            if not key[0] or not key[1]:
                continue
            entry = anchors[key]
            entry["ids"].add(ath)
            entry["clubs"].add(norm_club(row.get("club", "")))
            fam = row.get("position_family")
            if fam:
                entry["families"].add(fam)

    unique = {k: v for k, v in anchors.items() if len(v["ids"]) == 1}

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    row_athlete = overrides.setdefault("row_athlete", {})
    added = skipped_amb = 0
    for league, season, path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for row in payload.get("players", []):
            if row.get("athlete_id"):
                continue
            key = (norm(row.get("name", "")), int(row.get("birth_year") or 0))
            anchor = unique.get(key)
            if not anchor:
                continue
            club = norm_club(row.get("club", ""))
            fam = row.get("position_family")
            if club not in anchor["clubs"] and fam not in anchor["families"]:
                skipped_amb += 1
                continue
            ref = f"{league}/{season}/{row['player_id']}"
            ath = next(iter(anchor["ids"]))
            if row_athlete.get(ref) != ath:
                row_athlete[ref] = ath
                added += 1

    OVERRIDES.write_text(
        json.dumps(overrides, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"âncoras únicas: {len(unique)} | row_athlete adicionados: {added} | ambíguos pulados: {skipped_amb}")


if __name__ == "__main__":
    main()
