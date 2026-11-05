#!/usr/bin/env python3
"""Apply downloaded SofaScore heatmaps (per-player JSONs) to an ARCHIVED season.

Unlike apply_heatmaps_to_site.py (current season, CSV-driven), this resolves
identity through the athlete registry:

  1. sofascore_player_id → person_key (registry already captured ss ids from
     other seasons — SofaScore ids are stable across years);
  2. sofascore_name → unique normalized-name / initial+surname match among
     persons present in that league+season.

Writes:
  - `heatmap` field into the season's players.json + family-*.json rows
    (that's what getPlayerProfile serves; meta.heatmaps_enabled gates display);
  - storage copies in data/heatmaps/seasons/{league}-{season}/{player_id}.json
    (build_people.py glob picks them up to enrich sofascore anchors);
  - sofascore["{league}/{season}"] back into people.json + athletes.json.

Usage:
  python scripts/apply_heatmaps_season.py --league serie-a --season 2023 \
      --source "C:/.../heatmapsA23" [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.json_util import dumps_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"


def log(*args) -> None:
    print(*(str(a).encode("ascii", "replace").decode("ascii") for a in args), flush=True)


def norm_name(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def name_tokens(value: str) -> list[str]:
    return norm_name(value).split()


def name_score(person_name: str, ss_name: str) -> int:
    """0 = no match. 3 exact. 2 = same tokens but first initial expanded
    ('g cano' vs 'german cano'). 1 = same surname + compatible initial."""
    pt, st = name_tokens(person_name), name_tokens(ss_name)
    if not pt or not st:
        return 0
    if pt == st:
        return 3
    # mesmo último sobrenome
    if pt[-1] != st[-1]:
        return 0
    # iniciais: todo token de 1 letra de um lado deve ser prefixo do outro
    score = 2
    for a, b in zip(pt[:-1], st[:-1]):
        if a == b:
            continue
        if (len(a) == 1 and b.startswith(a)) or (len(b) == 1 and a.startswith(b)):
            continue
        score = 0
        break
    if score and len(pt) != len(st):
        score = 1
    return score


def heatmap_field(payload: dict) -> dict:
    return {
        "tournament_id": payload.get("tournament_id"),
        "season_id": payload.get("season_id"),
        "scope": payload.get("scope", "overall"),
        "competition": payload.get("competition"),
        "points": payload.get("points"),
        "point_count": payload.get("point_count", len(payload.get("points") or [])),
        "image_url": None,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", required=True)
    ap.add_argument("--season", required=True)
    ap.add_argument("--source", required=True, type=Path)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    season_dir = DATA / args.league / "seasons" / args.season
    if not season_dir.is_dir():
        raise SystemExit(f"Temporada não encontrada: {season_dir}")
    if not args.source.is_dir():
        raise SystemExit(f"Fonte não encontrada: {args.source}")

    persons = json.loads((XS / "persons.json").read_text(encoding="utf-8"))
    people = json.loads((XS / "people.json").read_text(encoding="utf-8"))
    athletes_payload = json.loads((XS / "athletes.json").read_text(encoding="utf-8"))
    athletes = athletes_payload.get("athletes") or {}

    mapping = (persons.get(args.league) or {}).get(args.season) or {}
    if not mapping:
        raise SystemExit(f"Sem persons para {args.league}/{args.season}")
    # player_id → person_key; e person_key → [player_id]
    pid_to_key: dict[str, str] = mapping

    ss_to_key: dict[str, str] = {}
    for key, rec in people.items():
        for ss_id in (rec.get("sofascore") or {}).values():
            ss_to_key.setdefault(str(ss_id), key)

    # índice de nomes entre as pessoas desta liga+temporada
    keys_in_season = {pid_to_key[pid] for pid in mapping}
    files = sorted(args.source.glob("*.json"))
    files = [f for f in files if f.stem.isdigit()]

    updates: dict[str, dict] = {}          # player_id → heatmap field
    storage: dict[str, dict] = {}          # player_id → payload completo
    matched_ss = matched_name = skipped_dup = unmatched = 0
    misses: list[str] = []

    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        ss_id = str(payload.get("sofascore_player_id") or path.stem)
        if not payload.get("points"):
            continue

        person_key = ss_to_key.get(ss_id)
        if person_key is None:
            # fallback: nome único dentro da temporada
            candidates = [
                (name_score((people.get(k) or {}).get("name") or "", payload.get("sofascore_name") or ""), k)
                for k in keys_in_season
            ]
            candidates = [c for c in candidates if c[0] > 0]
            candidates.sort(reverse=True)
            if candidates and candidates[0][0] >= 2 and (len(candidates) == 1 or candidates[1][0] < candidates[0][0]):
                person_key = candidates[0][1]
                matched_name += 1
            else:
                unmatched += 1
                misses.append(f"{ss_id} {payload.get('sofascore_name')}")
                continue
        else:
            matched_ss += 1

        # player_id desta pessoa nesta temporada
        pids = [pid for pid, k in pid_to_key.items() if k == person_key]
        if not pids:
            # a pessoa existe mas não tem linha nesta temporada (ex.: outra liga)
            unmatched += 1
            continue
        for pid in pids:
            if pid in updates:
                skipped_dup += 1
                continue
            payload = dict(payload)
            payload["player_id"] = pid
            payload["person_key"] = person_key
            payload["source"] = f"heatmaps_{args.league.replace('-', '')}{args.season[2:]}"
            updates[pid] = heatmap_field(payload)
            storage[pid] = payload
            rec = people.get(person_key)
            if rec is not None:
                rec.setdefault("sofascore", {})[f"{args.league}/{args.season}"] = ss_id
                aid = rec.get("athlete_id")
                arec = athletes.get(aid)
                if arec is not None:
                    arec.setdefault("sofascore", {})[f"{args.league}/{args.season}"] = ss_id

    log(f"arquivos com pontos: {len(files)} | match ss_id: {matched_ss} | match nome: {matched_name} | sem match: {unmatched} | dup: {skipped_dup}")
    log(f"linhas a gravar heatmap: {len(updates)}")
    if misses:
        log("sem match (amostra):", ", ".join(misses[:15]))

    if args.dry_run:
        return 0

    # players.json + family-*.json
    players_path = season_dir / "players.json"
    players_blob = json.loads(players_path.read_text(encoding="utf-8"))
    touched = 0
    for row in players_blob.get("players", []):
        hm = updates.get(row.get("player_id"))
        if hm:
            row["heatmap"] = hm
            touched += 1
    players_path.write_text(dumps_json(players_blob), encoding="utf-8")

    fam_touched = 0
    for fam_path in season_dir.glob("family-*.json"):
        fam = json.loads(fam_path.read_text(encoding="utf-8"))
        dirty = False
        for row in fam.get("players", []):
            hm = updates.get(row.get("player_id"))
            if hm:
                row["heatmap"] = hm
                dirty = True
                fam_touched += 1
        if dirty:
            fam_path.write_text(dumps_json(fam), encoding="utf-8")

    # storage por temporada — não colide com os arquivos da temporada corrente
    out_dir = DATA / "heatmaps" / "seasons" / f"{args.league}-{args.season}"
    out_dir.mkdir(parents=True, exist_ok=True)
    for pid, payload in storage.items():
        (out_dir / f"{pid}.json").write_text(dumps_json(payload), encoding="utf-8")

    (XS / "people.json").write_text(dumps_json(people), encoding="utf-8")
    (XS / "athletes.json").write_text(dumps_json(athletes_payload), encoding="utf-8")

    log(f"players.json: {touched} | family rows: {fam_touched} | storage: {len(storage)} arquivos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
