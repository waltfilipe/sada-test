#!/usr/bin/env python3
"""Linka linhas dos campeonatos est-* ao athlete_id via people.json.

Cada linha est-{slug}/{ano} corresponde a uma linha ja resolvida de outra
liga (est-nv*, series nacionais) do mesmo atleta: join por (temporada,
nome normalizado, clube normalizado, nascimento +-1) contra person.rows.
So grava `row_athlete` quando o par e unico.

Sem par por clube, um segundo passe aceita o atleta cujo nome+nascimento
e UNICO em todo o people.json E cuja ancora tm e fisicamente compativel
com a linha (altura <=4cm e nascimento <=1 ano do perfil TM no cache de
elencos) — cobre quem jogou o estadual por um clube e a liga nacional por
outro (Santos x Remo, Capivariano x Maringa). Homonimos com o mesmo nome
mas fisico/nascimento divergentes nao passam.

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
    tm_unanchor: dict = overrides.get("tm_unanchor") or {}

    # fisico verificado por tm_id (cache de elencos): altura+nascimento do
    # perfil — base do segundo passe de linkagem
    tm_physique: dict[str, dict] = {}
    for entry in load_json(DATA / "transfermarkt-squads.json", {}).values():
        for e in entry.get("squad", []):
            tid = str(e.get("id") or "")
            if tid and tid not in tm_physique:
                tm_physique[tid] = {
                    "height": e.get("height"), "birth_year": e.get("birth_year")
                }

    # indice: (temporada, nome, clube) -> athlete_ids; e person por athlete
    index: dict[tuple[str, str, str], set] = defaultdict(set)
    name_index: dict[str, set] = defaultdict(set)
    person_by_athlete: dict[str, dict] = {}
    person_key_by_athlete: dict[str, str] = {}
    for pkey, rec in people.items():
        aid = (rec or {}).get("athlete_id")
        if not aid:
            continue
        person_by_athlete[aid] = rec
        person_key_by_athlete[aid] = pkey
        name_index[norm(rec.get("name"))].add(aid)
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
            rid = str(tm.get("id") or "")
            pkey = person_key_by_athlete.get(aid)
            # nao enriquece a pessoa a partir de bloco de outro atleta:
            # id desancorado da pessoa, ou id que diverge da ancora dela
            bad = bool(rid) and (
                rid == str(tm_unanchor.get(pkey or "") or "")
                or (
                    bool((person_by_athlete.get(aid) or {}).get("tm_id"))
                    and rid != str(person_by_athlete[aid]["tm_id"])
                )
            )
            if (tm.get("id") or tm.get("photo")) and not bad:
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
                    # foto/url de perfil so valem se carregam o proprio tm_id —
                    # bloco com id certo + foto de outro atleta (propagacao
                    # velha) nao pode enriquecer a pessoa
                    if fkey in ("photo", "profile_url") and rid and rid not in str(fval or ""):
                        continue
                    if fval and not person.get(fkey):
                        person[fkey] = fval

    def person_tm_block(aid: str, row: dict) -> dict | None:
        """Bloco transfermarkt da pessoa para a linha, quando ha o que replicar.

        Cobre tanto âncoras TM reais (id) quanto blocos de foto vindos do
        manifest SofaScore (id=None, photo=/photos/{ss_id}). Sem a foto, um
        atleta com linha nacional fotografada ficava sem foto nos estaduais.
        """
        person = person_by_athlete.get(aid) or {}
        p_tm = person.get("tm_id")
        if not (p_tm or person.get("photo")):
            return None
        row_tm = dict(row.get("transfermarkt") or {})
        rid = str(row_tm.get("id") or "")
        if p_tm and rid and rid != str(p_tm):
            # bloco da linha era de outro atleta (propagacao antiga/errada) —
            # a âncora verificada da pessoa substitui tudo, sem carregar a
            # foto/url/market do estranho
            return {
                k: v
                for k, v in {
                    "id": p_tm,
                    "photo": person.get("photo"),
                    "club": person.get("tm_club"),
                    "profile_url": person.get("profile_url"),
                    "market_value": person.get("market_value"),
                    "market_value_eur": person.get("market_value_eur"),
                    "sofascore_player_id": person.get("sofascore_player_id"),
                }.items()
                if v is not None
            } or None
        if p_tm and rid == str(p_tm):
            # mesmo atleta: descarta campos da linha que apontam para outro
            # tm_id (foto/url herdadas de propagacao antiga)
            row_tm = {
                k: v
                for k, v in row_tm.items()
                if k not in ("photo", "profile_url") or not v or str(p_tm) in str(v)
            }
        if not p_tm and row_tm.get("photo"):
            return None
        block = {
            "id": p_tm,
            "photo": person.get("photo"),
            "club": person.get("tm_club"),
            "profile_url": person.get("profile_url"),
            "market_value": person.get("market_value"),
            "market_value_eur": person.get("market_value_eur"),
            "sofascore_player_id": person.get("sofascore_player_id"),
        }
        merged = {**row_tm, **{k: v for k, v in block.items() if v is not None}}
        return merged or None

    def stale_unanchored(row: dict, aid: str) -> bool:
        """Bloco da linha e um tm_id que o override desancorou da pessoa."""
        bad = tm_unanchor.get(person_key_by_athlete.get(aid) or "")
        return bool(bad) and str((row.get("transfermarkt") or {}).get("id") or "") == str(bad)

    added = already = ambiguous = no_match = tm_filled = 0
    for league, season, directory in iter_dirs():
        players_file = directory / "players.json"
        payload = load_json(players_file, None)
        if payload is None:
            continue
        resolved_tm: dict[str, dict | None] = {}
        for row in payload.get("players", []):
            key = f"{league}/{season}/{row.get('player_id')}"
            if key in row_athlete:
                already += 1
                aid = row_athlete[key]
                if stale_unanchored(row, aid):
                    row["transfermarkt"] = None
                block = person_tm_block(aid, row)
                if block:
                    row["transfermarkt"] = block
                    tm_filled += 1
                resolved_tm[row["player_id"]] = row.get("transfermarkt")
                continue
            aids: set = set()
            for by in {row.get("birth_year"), (row.get("birth_year") or 0) - 1, (row.get("birth_year") or 0) + 1}:
                aids |= index.get((season, norm(row.get("name")), norm(row.get("club")), str(by)), set())
            if not aids:
                # segundo passe: nome unico no grafo inteiro + fisico da
                # linha compativel com a ancora tm do atleta
                row_h = row.get("height") or 0
                row_b = row.get("birth_year") or 0
                for cand in name_index.get(norm(row.get("name")), set()):
                    p_tm = (person_by_athlete.get(cand) or {}).get("tm_id")
                    phys = tm_physique.get(str(p_tm)) if p_tm else None
                    if not phys or not row_h or not row_b:
                        continue
                    tm_h, tm_b = phys.get("height"), phys.get("birth_year")
                    if (tm_h and abs(int(row_h) - int(tm_h)) <= 4
                            and tm_b and abs(int(row_b) - int(tm_b)) <= 1):
                        aids.add(cand)
            if len(aids) == 1:
                aid = next(iter(aids))
                row_athlete[key] = aid
                added += 1
                if stale_unanchored(row, aid):
                    row["transfermarkt"] = None
                block = person_tm_block(aid, row)
                if block:
                    row["transfermarkt"] = block
                    tm_filled += 1
                resolved_tm[row["player_id"]] = row.get("transfermarkt")
            elif len(aids) > 1:
                ambiguous += 1
            else:
                no_match += 1
        players_file.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        # espelha nas familias o bloco resolvido na linha irma (display vem
        # delas) — inclusive None quando o bloco velho era de outro atleta
        if resolved_tm:
            for fp in sorted(directory.glob("family-*.json")):
                fam = load_json(fp, None)
                if fam is None:
                    continue
                changed = False
                for row in fam.get("players", []):
                    pid = row.get("player_id") or ""
                    if pid in resolved_tm and row.get("transfermarkt") != resolved_tm[pid]:
                        row["transfermarkt"] = resolved_tm[pid]
                        changed = True
                if changed:
                    fp.write_text(json.dumps(fam, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    OVERRIDES.write_text(json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"row_athlete: +{added} | ja existiam {already} | ambiguos {ambiguous} | sem par {no_match} | tm preenchido {tm_filled}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
