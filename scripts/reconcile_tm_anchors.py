#!/usr/bin/env python3
"""Reconcilia âncoras Transfermarkt compartilhadas entre pessoas distintas.

Invariante: um tm_id pertence a UM atleta. Quando duas pessoas carregam o
mesmo tm_id (homônimo que recebeu a âncora por match de nome), o dono real
é decidido pelo cache de elencos TM (transfermarkt-squads.json): ano de
nascimento e clubes onde o tm_id apareceu. O perdedor:

  - recebe override `tm_unanchor` (person_key -> tm_id), honrado por
    build_people.py, que passa a ignorar essa âncora na agregação;
  - tem o bloco `transfermarkt` removido das suas linhas em
    data/{leiga}/[seasons/{ano}/]{players,family-*}.json quando o tm.id é o
    contestado (a foto errada sai junto — era a foto do outro jogador).

Homônimos legítimos (tm_ids distintos ou nascimento divergente >=2) são
registrados em `distinct_pairs` para o audit parar de listá-los.

Roda ANTES de build_people.py na cadeia 2-4. Idempotente.
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
SQUADS = DATA / "transfermarkt-squads.json"


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError:
        return default


def norm(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def season_dir(league: str, season: str) -> Path:
    return DATA / league if season == "2026" else DATA / league / "seasons" / season


def tm_career(squads: dict) -> dict[str, dict]:
    """tm_id -> {birth_year, clubs} a partir do cache de elencos."""
    career: dict[str, dict] = {}
    for key, entry in squads.items():
        club = key.split("::", 1)[0]
        for e in entry.get("squad", []):
            tm_id = str(e.get("id") or "")
            if not tm_id:
                continue
            rec = career.setdefault(tm_id, {"birth_year": None, "clubs": set()})
            rec["clubs"].add(club)
            if e.get("birth_year"):
                rec["birth_year"] = e["birth_year"]
    return career


def main() -> int:
    people = load_json(XS / "people.json", {})
    squads = load_json(SQUADS, {})
    career = tm_career(squads)
    overrides = load_json(OVERRIDES, {})
    unanchor: dict = overrides.setdefault("tm_unanchor", {})
    distinct: list = overrides.setdefault("distinct_pairs", [])
    distinct_set = {tuple(sorted(p)) for p in distinct}

    # tm_id -> pessoas que o carregam
    by_tm: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for pk, rec in people.items():
        tm_id = str(rec.get("tm_id") or "")
        if tm_id:
            by_tm[tm_id].append((pk, rec))

    stripped = resolved = ambiguous = 0
    for tm_id, holders in sorted(by_tm.items()):
        if len(holders) < 2:
            continue
        real = career.get(tm_id)
        if not real:
            ambiguous += 1
            continue
        real_birth = real.get("birth_year")
        real_clubs = real["clubs"]

        def score(holder: tuple[str, dict]) -> int:
            _, rec = holder
            s = 0
            by = rec.get("birth_year")
            if real_birth and by:
                s += 3 if abs(int(by) - int(real_birth)) <= 1 else -3
            s += 2 * len({norm(c) for c in rec.get("clubs", [])} & real_clubs)
            return s

        scored = sorted(holders, key=score, reverse=True)
        owner = scored[0]
        if score(owner) <= score(scored[1]):
            ambiguous += 1
            continue
        for pk, rec in scored[1:]:
            if score((pk, rec)) >= 1:
                ambiguous += 1
                continue
            unanchor[pk] = tm_id
            stripped += 1
            resolved += 1
        resolved += 1

    # Homônimos legítimos no audit (mesmo nome, liga, temporada, ids distintos)
    # -> allowlist quando os ids pertencem a pessoas com tm distinto ou
    # nascimento divergente >= 2 anos.
    audit = load_json(XS / "identity-audit.json", {})
    ath_to_pk = {v.get("athlete_id"): pk for pk, v in people.items() if v.get("athlete_id")}
    allow = 0
    for h in audit.get("findings", {}).get("homonym-collision", []):
        aids = h.get("athlete_ids", [])
        pks = [ath_to_pk.get(a) for a in aids]
        recs = [people[pk] for pk in pks if pk]
        if len(recs) < 2:
            continue
        tms = {str(r.get("tm_id")) for r in recs if r.get("tm_id")}
        births = [r.get("birth_year") for r in recs if r.get("birth_year")]
        legit = len(tms) == len([r for r in recs if r.get("tm_id")]) >= 2
        legit = legit or (len(births) >= 2 and max(births) - min(births) >= 2)
        if not legit:
            continue
        pair = tuple(sorted(aids))
        if pair not in distinct_set:
            distinct_set.add(pair)
            distinct.append(sorted(pair))
            allow += 1

    OVERRIDES.write_text(json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")

    # Limpa o bloco transfermarkt das linhas dos perdedores (só quando o
    # tm.id da linha é o contestado).
    rows_cleaned = 0
    if unanchor:
        # player_id -> tm_id contestado daquela pessoa
        loser_pid_tm: dict[tuple[str, str, str], str] = {}
        for pk, rec in people.items():
            tm_id = unanchor.get(pk)
            if not tm_id:
                continue
            for r in rec.get("rows", []):
                loser_pid_tm[(r["league"], r["season"], r["player_id"])] = tm_id
        dirs = {(lg, s): season_dir(lg, s) for lg, s, _ in loser_pid_tm}
        for (league, season), directory in dirs.items():
            for fp in [directory / "players.json", *sorted(directory.glob("family-*.json"))]:
                payload = load_json(fp, None)
                if payload is None:
                    continue
                changed = False
                for row in payload.get("players", []):
                    bad = loser_pid_tm.get((league, season, row.get("player_id") or ""))
                    tm = row.get("transfermarkt") or {}
                    if bad and str(tm.get("id") or "") == bad:
                        row.pop("transfermarkt", None)
                        rows_cleaned += 1
                        changed = True
                if changed:
                    fp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"tm_id contestados: {resolved} resolvidos | {stripped} âncoras removidas | {ambiguous} ambíguos")
    print(f"distinct_pairs: +{allow} (total {len(distinct)}) | linhas limpas: {rows_cleaned}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
