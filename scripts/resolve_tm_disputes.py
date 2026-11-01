#!/usr/bin/env python3
"""
Resolve tm_ids claimed by more than one person.

Two failure modes hide under one symptom:
  a) the same athlete over-split into two person_keys (same name + birth year,
     e.g. wellington rato|1992|0 and |1) — the tm_id is correct for both and
     the persons should merge back;
  b) two different athletes each carrying the same tm_id because the squad
     search matched a same/similar-name teammate — the tm_id belongs to the
     person whose name matches the TM profile slug; losers get the field
     cleared (no photo beats a wrong photo).

Disambiguation order: exact normalized name == profile slug, then
containment; ties between same-name+birth persons merge; ties between
different names fall back to the TM current club appearing in the person's
club history; unresolved disputes clear the tm_id from every claimant row.
Writes persons.json + league players.json files; rebuild people.json and
transfers afterwards.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LEAGUES = ("serie-a", "serie-b", "serie-c", "serie-d")
PERSONS = DATA / "cross-season" / "persons.json"


def norm(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))
    return " ".join(s.lower().replace("-", " ").split())


def season_dirs(league_dir: Path) -> list[tuple[str, Path]]:
    meta = league_dir / "meta.json"
    current = "2026"
    if meta.exists():
        current = str(json.loads(meta.read_text(encoding="utf-8")).get("season") or current)
    out = [(current, league_dir)]
    root = league_dir / "seasons"
    if root.is_dir():
        out.extend((c.name, c) for c in sorted(root.iterdir()) if (c / "players.json").exists())
    return out


def main() -> int:
    persons = json.loads(PERSONS.read_text(encoding="utf-8"))

    # player files indexed once; dirty files flushed at the end
    files: dict[tuple[str, str], dict] = {}
    file_path: dict[tuple[str, str], Path] = {}
    person_of: dict[tuple[str, str, str], str] = {}
    tm_of: dict[str, set[str]] = defaultdict(set)  # person_key -> tm_ids
    for league in LEAGUES:
        for season, directory in season_dirs(DATA / league):
            try:
                payload = json.loads((directory / "players.json").read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            files[(league, season)] = payload
            file_path[(league, season)] = directory / "players.json"
            for pid, key in persons.get(league, {}).get(season, {}).items():
                person_of[(league, season, pid)] = key

    def row(league: str, season: str, pid: str) -> dict:
        for p in (files.get((league, season)) or {}).get("players", []):
            if p.get("player_id") == pid:
                return p
        return {}

    # person_key -> [(league, season, pid)]
    person_rows: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for (league, season, pid), key in person_of.items():
        person_rows[key].append((league, season, pid))
        tm = (row(league, season, pid).get("transfermarkt") or {}).get("id")
        if tm:
            tm_of[key].add(str(tm))

    by_tm: dict[str, set[str]] = defaultdict(set)
    for key, ids in tm_of.items():
        for tm_id in ids:
            by_tm[tm_id].add(key)

    def slug_of(key: str, tm_id: str) -> str | None:
        for league, season, pid in person_rows.get(key, []):
            tm = row(league, season, pid).get("transfermarkt") or {}
            if str(tm.get("id")) != tm_id:
                continue
            url = tm.get("profile_url") or ""
            m = re.search(r"transfermarkt\.[^/]+/([^/]+)/profil", url)
            if m:
                return norm(m.group(1))
        return None

    def person_name(key: str) -> str:
        m = re.match(r"^name:(.*)\|\d+\|\d+$", key)
        return norm(m.group(1)) if m else ""

    def person_birth(key: str) -> int | None:
        m = re.match(r"^name:.*\|(\d+)\|\d+$", key)
        return int(m.group(1)) if m else None

    def person_clubs(key: str) -> set[str]:
        return {norm(row(l, s, p).get("club") or "") for l, s, p in person_rows.get(key, [])}

    def tm_club(key: str, tm_id: str) -> str:
        for league, season, pid in person_rows.get(key, []):
            tm = row(league, season, pid).get("transfermarkt") or {}
            if str(tm.get("id")) == tm_id and tm.get("club"):
                return norm(tm["club"])
        return ""

    cache_file = DATA / "transfermarkt-cache.json"
    tm_cache: dict[str, dict] = {}
    if cache_file.exists():
        for v in json.loads(cache_file.read_text(encoding="utf-8")).values():
            if isinstance(v, dict) and v.get("id"):
                tm_cache[str(v["id"])] = v

    def narrow_by_match_via(cands: list[str], tm_id: str) -> list[str]:
        # the backfill records which squad validated the match ("Club 2025") —
        # the person owning a row at that club in that season is the athlete
        via = norm(str((tm_cache.get(tm_id) or {}).get("match_via") or ""))
        if not via:
            return []
        m = re.match(r"^(.*)\s(\d{4})$", via)
        if not m:
            return []
        club, year = norm(m.group(1)), m.group(2)
        return [
            k
            for k in cands
            if any(
                norm(row(l, s, p).get("club") or "") == club and s == year
                for l, s, p in person_rows.get(k, [])
            )
        ]

    merges: list[tuple[str, str]] = []  # (keep_key, drop_key)
    cleared = 0
    dirty_files: set[tuple[str, str]] = set()

    for tm_id, keys in sorted(by_tm.items()):
        if len(keys) < 2:
            continue
        slugs = {k: slug_of(k, tm_id) for k in keys}
        slug = next(iter({s for s in slugs.values() if s}), None)
        names = {k: person_name(k) for k in keys}

        def matches(key: str) -> int:
            name, sl = names[key], slug or slugs.get(key) or ""
            if not name or not sl:
                return 0
            if name == sl:
                return 2
            return 1 if (name in sl or sl in name) else 0

        best = max((matches(k) for k in keys), default=0)
        winners = [k for k in keys if matches(k) == best] if best else []

        def narrow_by_club(cands: list[str]) -> list[str]:
            hits = [
                k
                for k in cands
                if (tc := tm_club(k, tm_id))
                and any(tc in c or c in tc for c in person_clubs(k) if c)
            ]
            return hits or cands

        if len(winners) > 1:
            # different birth years among winners are distinct athletes sharing
            # the name — the tm current club picks the true owner
            births = {person_birth(k) for k in winners}
            if len(births) > 1:
                winners = narrow_by_club(winners)
        if len(winners) > 1 and len({person_birth(k) for k in winners}) > 1:
            # still tied — fall back to the squad that validated the match
            winners = narrow_by_match_via(winners, tm_id) or winners
        if not winners:
            winners = narrow_by_club(list(keys)) or narrow_by_match_via(list(keys), tm_id)
            if winners == list(keys):
                winners = []

        losers = [k for k in keys if k not in winners]
        # same-name+birth winners are an over-split of one athlete — merge them
        groups: dict[tuple[str, int | None], list[str]] = defaultdict(list)
        for k in winners:
            groups[(names[k], person_birth(k))].append(k)
        for (name, birth), ks in groups.items():
            if len(ks) > 1:
                ks = sorted(ks)
                for drop in ks[1:]:
                    merges.append((ks[0], drop))
        keepers = {ks[0] for ks in groups.values()}

        # clear the tm_id from every losing person's rows
        for key in losers:
            for league, season, pid in person_rows.get(key, []):
                p = row(league, season, pid)
                tm = p.get("transfermarkt") or {}
                if str(tm.get("id")) == tm_id:
                    p["transfermarkt"] = None
                    dirty_files.add((league, season))
                    cleared += 1
        if losers:
            print(f"tm {tm_id}: mantido em {sorted(keepers) or '-'} | limpo de {sorted(set(losers))}")

    # apply merges: re-point all rows of drop_key to keep_key
    for keep, drop in merges:
        for league, seasons in persons.items():
            for season, mapping in seasons.items():
                for pid, key in mapping.items():
                    if key == drop:
                        mapping[pid] = keep
        print(f"merge {drop} -> {keep}")

    for league, season in dirty_files:
        file_path[(league, season)].write_text(
            json.dumps(files[(league, season)], ensure_ascii=False), encoding="utf-8"
        )
    if merges or cleared:
        PERSONS.write_text(json.dumps(persons, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nMerges: {len(merges)} | registros tm limpos: {cleared}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
