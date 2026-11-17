#!/usr/bin/env python3
"""Linka linhas dos campeonatos est-* ao athlete_id via people.json.

Cada linha est-{slug}/{ano} corresponde a uma linha ja resolvida de outra
liga (est-nv*, series nacionais) do mesmo atleta: join por (temporada,
nome normalizado, clube normalizado, nascimento +-1) contra person.rows.
So grava `row_athlete` quando o par e unico.

Alem disso, replica o bloco `transfermarkt` da pessoa (foto/valor/url)
nas linhas linkadas — sem chamada de rede.

Depois rode apply_athlete_ids.py. Idempotente.
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


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError:
        return default


def norm(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def iter_dirs() -> list[tuple[str, str, Path]]:
    dirs: list[tuple[str, str, Path]] = []
    for league_dir in sorted(DATA.glob("est-*")):
        if not league_dir.is_dir():
            continue
        meta = load_json(league_dir / "meta.json", {})
        if (league_dir / "players.json").exists():
            dirs.append((league_dir.name, str(meta.get("season") or "2026"), league_dir))
        seasons = league_dir / "seasons"
        if seasons.is_dir():
            for child in sorted(seasons.iterdir()):
                if (child / "players.json").exists():
                    dirs.append((league_dir.name, child.name, child))
    return dirs


def main() -> int:
    people = load_json(XS / "people.json", {})
    overrides = load_json(OVERRIDES, {})
    row_athlete: dict = overrides.setdefault("row_athlete", {})

    # indice: (temporada, nome, clube) -> athlete_ids; e person por athlete
    index: dict[tuple[str, str, str], set] = defaultdict(set)
    person_by_athlete: dict[str, dict] = {}
    for rec in people.values():
        aid = rec.get("athlete_id")
        if not aid:
            continue
        person_by_athlete[aid] = rec
        birth = rec.get("birth_year")
        if not birth:
            continue
        for r in rec.get("rows", []):
            for by in {birth, birth - 1, birth + 1}:
                index[(r["season"], norm(rec.get("name")), norm(r.get("club")), str(by))].add(aid)

    # Linhas ja carimbadas de qualquer data/* (est-nv*, series, mls) entram
    # no indice — cobertura estadual vem delas, nao do grafo de pessoas.
    for players_file in sorted(DATA.glob("*/players.json")) + sorted(DATA.glob("*/seasons/*/players.json")):
        src = players_file.parent
        season = src.name if src.parent.name == "seasons" else load_json(src / "meta.json", {}).get("season", "")
        for row in load_json(players_file, {}).get("players", []):
            aid = row.get("athlete_id")
            birth = row.get("birth_year")
            if not aid or not birth or not season:
                continue
            for by in {birth, birth - 1, birth + 1}:
                index[(str(season), norm(row.get("name")), norm(row.get("club")), str(by))].add(aid)
            tm = row.get("transfermarkt") or {}
            if tm.get("id") or tm.get("photo"):
                person = person_by_athlete.setdefault(aid, {})
                for fkey, fval in (
                    ("tm_id", tm.get("id")),
                    ("photo", tm.get("photo")),
                    ("tm_club", tm.get("club")),
                    ("profile_url", tm.get("profile_url")),
                    ("market_value", tm.get("market_value")),
                    ("market_value_eur", tm.get("market_value_eur")),
                    ("sofascore_player_id", tm.get("sofascore_player_id")),
                ):
                    if fval and not person.get(fkey):
                        person[fkey] = fval

    def person_tm_block(aid: str, row: dict) -> dict | None:
        """Bloco transfermarkt da pessoa para a linha, quando ha o que replicar.

        Cobre tanto âncoras TM reais (id) quanto blocos de foto vindos do
        manifest SofaScore (id=None, photo=/photos/{ss_id}). Sem a foto, um
        atleta com linha nacional fotografada ficava sem foto nos estaduais.
        """
        person = person_by_athlete.get(aid) or {}
        if not (person.get("tm_id") or person.get("photo")):
            return None
        row_tm = row.get("transfermarkt") or {}
        if row_tm.get("photo"):
            return None
        block = {
            "id": person.get("tm_id"),
            "photo": person.get("photo"),
            "club": person.get("tm_club"),
            "profile_url": person.get("profile_url"),
            "market_value": person.get("market_value"),
            "market_value_eur": person.get("market_value_eur"),
            "sofascore_player_id": person.get("sofascore_player_id"),
        }
        merged = {**row_tm, **{k: v for k, v in block.items() if v is not None}}
        return merged or None

    added = already = ambiguous = no_match = tm_filled = 0
    for league, season, directory in iter_dirs():
        players_file = directory / "players.json"
        payload = load_json(players_file, None)
        if payload is None:
            continue
        tm_by_pid: dict[str, dict] = {}
        for row in payload.get("players", []):
            key = f"{league}/{season}/{row.get('player_id')}"
            if key in row_athlete:
                already += 1
                block = person_tm_block(row_athlete[key], row)
                if block:
                    row["transfermarkt"] = block
                    tm_by_pid[row["player_id"]] = block
                    tm_filled += 1
                continue
            aids: set = set()
            for by in {row.get("birth_year"), (row.get("birth_year") or 0) - 1, (row.get("birth_year") or 0) + 1}:
                aids |= index.get((season, norm(row.get("name")), norm(row.get("club")), str(by)), set())
            if len(aids) == 1:
                aid = next(iter(aids))
                row_athlete[key] = aid
                added += 1
                block = person_tm_block(aid, row)
                if block:
                    row["transfermarkt"] = block
                    tm_by_pid[row["player_id"]] = block
                    tm_filled += 1
            elif len(aids) > 1:
                ambiguous += 1
            else:
                no_match += 1
        players_file.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        # propaga o bloco TM para as familias (display vem delas)
        if tm_by_pid:
            for fp in sorted(directory.glob("family-*.json")):
                fam = load_json(fp, None)
                if fam is None:
                    continue
                changed = False
                for row in fam.get("players", []):
                    block = tm_by_pid.get(row.get("player_id") or "")
                    if block and not (row.get("transfermarkt") or {}).get("photo"):
                        row["transfermarkt"] = {**(row.get("transfermarkt") or {}), **block}
                        changed = True
                if changed:
                    fp.write_text(json.dumps(fam, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    OVERRIDES.write_text(json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"row_athlete: +{added} | ja existiam {already} | ambiguos {ambiguous} | sem par {no_match} | tm preenchido {tm_filled}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
