#!/usr/bin/env python3
"""Emit stable, immutable athlete ids on top of the resolved person graph.

person_key is DERIVED (name|birth|n): a corrected birth year or name spelling
can silently split one athlete in two — or merge two — on the next rebuild.
This layer mints an athlete_id once (``ath-000123``) and re-attaches it on
every run, by (1) same person_key, (2) Transfermarkt id anchor,
(3) SofaScore id anchor. Retired persons keep their id with ``active: false``
so numbers are never reused — ids only ever move forward.

Inputs  : data/cross-season/persons.json, people.json,
          athletes.json (previous emission), identity-overrides.json
Outputs : data/cross-season/athletes.json
              {"_meta": {...}, "athletes": {athlete_id → record}}
          people.json records gain "athlete_id" in place
          data/cross-season/identity-overrides.json seeded when missing

identity-overrides.json (every key optional) — versioned, human-curated:
  {
    "merge_people": {"<person_key>": "<canonical person_key>"},   // same athlete
    "pin_athlete":  {"<person_key>": "ath-000123"},               // force id
    "row_athlete":  {"<league>/<season>/<player_id>": "ath-000123"}
  }
``row_athlete`` is a row-level force (a true split); it is consumed by
apply_athlete_ids.py, not here.

Run order: build_cross_season_projection.py → build_people.py → this →
apply_athlete_ids.py. Repair scripts that rewrite persons.json require the
same chain afterwards.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.json_util import dumps_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"
PEOPLE = XS / "people.json"
ATHLETES = XS / "athletes.json"
OVERRIDES = XS / "identity-overrides.json"

ID_RE = re.compile(r"^ath-(\d{6,})$")
ID_FMT = "ath-{n:06d}"


def log(*args) -> None:
    print(*(str(a).encode("ascii", "replace").decode("ascii") for a in args))


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def next_serial(existing: dict, floor: int) -> int:
    top = floor
    for athlete_id in existing:
        match = ID_RE.match(athlete_id)
        if match:
            top = max(top, int(match.group(1)) + 1)
    return top


def main() -> int:
    people: dict = load_json(PEOPLE, {})
    if not people:
        log("people.json vazio ou ausente — rode build_people.py antes.")
        return 1

    overrides = load_json(OVERRIDES, {})
    if not OVERRIDES.exists():
        OVERRIDES.write_text(
            dumps_json({"merge_people": {}, "pin_athlete": {}, "row_athlete": {}}),
            encoding="utf-8",
        )
    merge_people: dict = overrides.get("merge_people") or {}
    pin_athlete: dict = overrides.get("pin_athlete") or {}

    prev_payload = load_json(ATHLETES, {})
    prev: dict = (prev_payload or {}).get("athletes") or {}
    prev_meta_next = int(((prev_payload or {}).get("_meta") or {}).get("next") or 1)

    # índices do registro anterior para reanexar ids
    prev_by_key: dict[str, str] = {}
    prev_by_tm: dict[str, str] = {}
    prev_by_ss: dict[str, str] = {}
    for athlete_id, rec in prev.items():
        for key in [rec.get("person_key"), *(rec.get("person_keys") or [])]:
            if key:
                prev_by_key.setdefault(key, athlete_id)
        if rec.get("tm_id"):
            prev_by_tm.setdefault(str(rec["tm_id"]), athlete_id)
        for ss_id in (rec.get("sofascore") or {}).values():
            prev_by_ss.setdefault(str(ss_id), athlete_id)

    # agrupa person_keys pelo canônico (merge_people apelida chaves)
    groups: dict[str, list[str]] = {}
    for person_key in sorted(people):
        canonical = merge_people.get(person_key, person_key)
        groups.setdefault(canonical, []).append(person_key)

    warnings: list[str] = []
    mint = next_serial(prev, prev_meta_next)
    claimed: set[str] = set()
    out: dict[str, dict] = {}

    def anchors(keys: list[str]) -> tuple[set[str], set[str]]:
        tm_ids: set[str] = set()
        ss_ids: set[str] = set()
        for key in keys:
            rec = people.get(key) or {}
            if rec.get("tm_id"):
                tm_ids.add(str(rec["tm_id"]))
            for ss_id in (rec.get("sofascore") or {}).values():
                ss_ids.add(str(ss_id))
        return tm_ids, ss_ids

    for canonical in sorted(groups):
        keys = groups[canonical]
        tm_ids, ss_ids = anchors(keys)

        candidates: list[str] = []
        for key in keys:
            if key in pin_athlete:
                candidates.append(pin_athlete[key])
        for key in keys:
            if key in prev_by_key:
                candidates.append(prev_by_key[key])
        for tm_id in sorted(tm_ids):
            if tm_id in prev_by_tm:
                candidates.append(prev_by_tm[tm_id])
        for ss_id in sorted(ss_ids):
            if ss_id in prev_by_ss:
                candidates.append(prev_by_ss[ss_id])

        athlete_id = next((c for c in candidates if c), None)
        if len({c for c in candidates}) > 1:
            warnings.append(f"{canonical}: ids candidatos divergentes {sorted(set(candidates))}")
        if athlete_id in claimed:
            warnings.append(f"{canonical}: {athlete_id} já tomado — novo id emitido")
            athlete_id = None
        if athlete_id is None:
            athlete_id = ID_FMT.format(n=mint)
            mint += 1
        claimed.add(athlete_id)

        head = people.get(canonical) or people.get(keys[0]) or {}
        rows: list[dict] = []
        clubs: list[str] = []
        sofascore: dict[str, str] = {}
        for key in keys:
            rec = people.get(key) or {}
            rows.extend(rec.get("rows") or [])
            for club in rec.get("clubs") or []:
                if club not in clubs:
                    clubs.append(club)
            sofascore.update(rec.get("sofascore") or {})
        rows.sort(key=lambda r: (r.get("season") or "", r.get("league") or ""))

        base = prev.get(athlete_id) or {}
        out[athlete_id] = {
            "person_key": canonical,
            "person_keys": keys,
            "name": head.get("name") or base.get("name"),
            "birth_year": head.get("birth_year") or base.get("birth_year"),
            "tm_id": (sorted(tm_ids) or [base.get("tm_id")])[0] if (tm_ids or base.get("tm_id")) else None,
            "photo": head.get("photo") or base.get("photo"),
            "profile_url": head.get("profile_url") or base.get("profile_url"),
            "clubs": clubs or base.get("clubs") or [],
            "sofascore": sofascore or base.get("sofascore") or {},
            "rows": rows,
            "active": True,
        }
        for key in keys:
            if key in people:
                people[key]["athlete_id"] = athlete_id

    # registros não reivindicados aposentam — id nunca é reutilizado
    retired = 0
    for athlete_id, rec in prev.items():
        if athlete_id not in out:
            rec = dict(rec)
            rec["active"] = False
            out[athlete_id] = rec
            retired += 1

    payload = {
        "_meta": {
            "next": mint,
            "active": sum(1 for r in out.values() if r.get("active")),
            "retired": retired,
            "warnings": warnings,
        },
        "athletes": dict(sorted(out.items())),
    }
    ATHLETES.write_text(dumps_json(payload), encoding="utf-8")
    PEOPLE.write_text(dumps_json(people), encoding="utf-8")

    log(
        f"athletes.json: {payload['_meta']['active']} ativos "
        f"({mint - prev_meta_next} novos ids) + {retired} aposentados"
    )
    for warning in warnings:
        log("  !", warning)
    return 0


if __name__ == "__main__":
    sys.exit(main())
