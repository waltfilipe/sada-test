#!/usr/bin/env python3
"""
Resolve Transfermarkt links through the athlete's club history.

Identity rule: a row only receives a Transfermarkt profile when the athlete is
found inside the TM squad of a club he actually played for. The squad page is
the identity check, so same-name athletes can never collide — the exact bug
behind wrong photos for homonymous players.

Club history comes from data/cross-season/persons.json (same identity graph
the site uses) plus transfers.json stints, and each row's own season is used
as the TM saison_id, so an archive row is matched inside the squad of that
year (e.g. São Paulo 2024), not just the current one.

Also audits rows that already carry transfermarkt data: when the name is
shared by several person identities and the stored TM club never appears in
the athlete's own history, the record is a likely homonym and gets cleared
(--drop-bad) before re-resolution.

Usage:
    python scripts/backfill_tm_by_club_history.py [--dry-run] [--audit]
        [--drop-bad] [--only TEXT] [--limit N] [--delay 0.9]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from engine.transfermarkt import (  # noqa: E402
    _club_match_score,
    _load_cache,
    _normalize_text,
    _save_cache,
    _scrape_profile,
    build_club_directory,
    fetch_club_squad,
    load_club_cache,
    match_club_in_directory,
    match_player_in_squad,
    save_club_cache,
    search_club,
)

DATA = ROOT / "data"
LEAGUES = ("serie-a", "serie-b", "serie-c", "serie-d", "est-nv1", "est-nv2", "est-nv3", "est-nv4")
CURRENT_TM_SEASON = 2026
SQUADS_PATH = DATA / "transfermarkt-squads.json"


def season_dirs(league_dir: Path) -> list[tuple[int, Path]]:
    """[(season, dir)] — the league root is the current season."""
    meta_file = league_dir / "meta.json"
    current = 2026
    if meta_file.exists():
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        current = int(meta.get("season") or current)
    out = [(current, league_dir)]
    seasons_root = league_dir / "seasons"
    if seasons_root.is_dir():
        for child in sorted(seasons_root.iterdir()):
            if (child / "players.json").exists():
                out.append((int(child.name), child))
    return out


def collect_rows() -> list[dict]:
    rows = []
    for league in LEAGUES:
        for season, directory in season_dirs(DATA / league):
            payload = json.loads((directory / "players.json").read_text(encoding="utf-8"))
            for player in payload.get("players", []):
                rows.append(
                    {
                        "league": league,
                        "season": season,
                        "dir": directory,
                        "payload": payload,
                        "player": player,
                    }
                )
    return rows


def load_person_maps() -> tuple[dict, dict]:
    persons = json.loads((DATA / "cross-season" / "persons.json").read_text(encoding="utf-8"))
    row_person = {}
    name_keys: dict[str, set] = defaultdict(set)
    for league, seasons in persons.items():
        for season, mapping in seasons.items():
            for player_id, key in mapping.items():
                row_person[(league, int(season), player_id)] = key
                if key.startswith("name:"):
                    name_keys[key[5:].split("|")[0]].add(key)
    return row_person, name_keys


def load_transfers() -> dict:
    path = DATA / "cross-season" / "transfers.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def history_clubs(rows: list[dict], person_key: str | None, transfers: dict) -> list[tuple[int, str]]:
    """(season, club) pairs the athlete played for, most recent first."""
    pairs: set[tuple[int, str]] = set()
    for r in rows:
        if r["player"].get("club"):
            pairs.add((r["season"], r["player"]["club"]))
    entry = transfers.get(person_key or "") or {}
    for stint in entry.get("stints", []):
        if stint.get("club"):
            pairs.add((int(stint.get("season") or 0), stint["club"]))
    return sorted(pairs, key=lambda t: -t[0])


# ── Season-aware squad resolution ─────────────────────────────────────────────
# The engine's club cache keys squads by club name only; history needs one
# squad per club *and* season, so we keep our own cache file.


def load_squad_cache() -> dict:
    if SQUADS_PATH.exists():
        return json.loads(SQUADS_PATH.read_text(encoding="utf-8"))
    return {}


def save_squad_cache(cache: dict) -> None:
    SQUADS_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def tm_club(club: str, club_ids: dict, directory: list, delay: float) -> dict | None:
    norm = _normalize_text(club)
    if norm in club_ids:
        return club_ids[norm]
    found = match_club_in_directory(club, directory)
    if not found:
        try:
            found = search_club(club)
            time.sleep(delay)
        except Exception:
            found = None
    club_ids[norm] = found
    return found


def squad_for(
    club: str,
    season: int,
    squads: dict,
    club_ids: dict,
    directory: list,
    delay: float,
) -> list[dict]:
    key = f"{_normalize_text(club)}::{season}"
    cached = squads.get(key)
    if cached is not None:
        return cached.get("squad", [])
    found = tm_club(club, club_ids, directory, delay)
    if not found:
        squads[key] = {"id": None, "name": None, "squad": []}
        return []
    try:
        squad = fetch_club_squad(found["id"], season)
        time.sleep(delay)
    except Exception:
        squad = []
    squads[key] = {"id": found["id"], "name": found["name"], "squad": squad}
    return squad


def resolve_group(
    rows: list[dict],
    person_key: str | None,
    transfers: dict,
    squads: dict,
    club_ids: dict,
    directory: list,
    delay: float,
) -> dict | None:
    """Find the athlete inside a squad of one of his own clubs."""
    player = sorted(rows, key=lambda r: -r["season"])[0]["player"]
    for season, club in history_clubs(rows, person_key, transfers):
        for tm_season in dict.fromkeys((season, CURRENT_TM_SEASON)):
            squad = squad_for(club, tm_season, squads, club_ids, directory, delay)
            if not squad:
                continue
            match = match_player_in_squad(player, squad)
            if not match:
                continue
            try:
                profile = _scrape_profile(match["path"])
                time.sleep(delay)
            except Exception:
                continue
            profile["matched_name"] = match.get("name")
            profile["match_via"] = f"{club} {tm_season}"
            return profile
    return None


SENTINEL_CLUBS = {"sem clube", "fim de carreira", "aposentado", "career break", "without club"}


def suspect_tm(row: dict, group_rows: list[dict], person_key: str | None,
               name_keys: dict, transfers: dict) -> bool:
    """True when stored TM data is likely a same-name athlete's profile."""
    tm = row["player"].get("transfermarkt")
    if not tm or not tm.get("photo"):
        return False
    name_norm = _normalize_text(row["player"].get("name", ""))
    if len(name_keys.get(name_norm, set())) <= 1:
        return False  # unique name — a stale club is plausible, not a homonym
    tm_club = tm.get("club") or ""
    if not tm_club:
        return False
    if _normalize_text(tm_club) in SENTINEL_CLUBS:
        return False  # "no club"/"retired" cannot be cross-checked by history
    for _, club in history_clubs(group_rows, person_key, transfers):
        if _club_match_score(tm_club, club) >= 40:
            return False
    return True


# ── Writes ────────────────────────────────────────────────────────────────────


def write_row_tm(row: dict, tm: dict) -> bool:
    """Update players.json row + family files + profile file for the row."""
    player = row["player"]
    merged = {**(player.get("transfermarkt") or {}), **tm}
    player["transfermarkt"] = merged
    row["dirty"] = True

    directory: Path = row["dir"]
    player_id = player["player_id"]
    for family_file in directory.glob("family-*.json"):
        try:
            payload = json.loads(family_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        changed = False
        for entry in payload.get("players", []):
            if entry.get("player_id") == player_id:
                entry["transfermarkt"] = merged
                changed = True
        if changed:
            family_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    profile_file = DATA / row["league"] / "profiles" / f"{player_id}.json"
    if profile_file.exists():
        try:
            profile = json.loads(profile_file.read_text(encoding="utf-8"))
            profile["transfermarkt"] = merged
            profile_file.write_text(json.dumps(profile, ensure_ascii=False), encoding="utf-8")
        except json.JSONDecodeError:
            pass
    return True


def save_dirty_players(rows: list[dict]) -> None:
    by_dir: dict[Path, dict] = {}
    for r in rows:
        if r.get("dirty"):
            by_dir[r["dir"]] = r["payload"]
    for directory, payload in by_dir.items():
        (directory / "players.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--audit", action="store_true", help="only report suspect stored TM data")
    parser.add_argument("--drop-bad", action="store_true", help="clear suspect TM before resolving")
    parser.add_argument("--only", default="", help="player_id substring filter")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--delay", type=float, default=0.9)
    args = parser.parse_args()

    rows = collect_rows()
    row_person, name_keys = load_person_maps()
    transfers = load_transfers()
    for r in rows:
        r["person_key"] = row_person.get((r["league"], r["season"], r["player"]["player_id"]))

    # Suspect audit — stored TM whose club never appears in the athlete's history.
    by_person: dict[str, list] = defaultdict(list)
    for r in rows:
        key = r["person_key"] or f"row:{r['league']}/{r['season']}/{r['player']['player_id']}"
        by_person[key].append(r)

    suspects = []
    for key, group in by_person.items():
        for r in group:
            if args.only and args.only not in r["player"]["player_id"]:
                continue
            if suspect_tm(r, group, r["person_key"], name_keys, transfers):
                suspects.append(r)
    print(f"Suspeitos (TM de possível homônimo): {len(suspects)}")
    for r in suspects[:40]:
        tm = r["player"]["transfermarkt"]
        print(f"  {r['league']} {r['season']} {r['player']['name']} @ {r['player']['club']}"
              f" → tm.club={tm.get('club')} id={tm.get('id')}")
    if args.audit:
        return 0

    if args.drop_bad:
        for r in suspects:
            r["player"]["transfermarkt"] = None
            r["dirty"] = True

    # Groups needing resolution: any row without a TM photo.
    pending = []
    for key, group in by_person.items():
        targets = [r for r in group if not (r["player"].get("transfermarkt") or {}).get("photo")]
        if not targets:
            continue
        if args.only and not any(args.only in r["player"]["player_id"] for r in targets):
            continue
        pending.append((key, targets, group))
    print(f"Pessoas sem foto TM: {len(pending)}")

    club_cache = load_club_cache()
    directory = build_club_directory(club_cache, season=CURRENT_TM_SEASON, delay=args.delay)
    club_ids: dict[str, dict | None] = {}
    squads = load_squad_cache()
    tm_cache = _load_cache()

    resolved = 0
    for index, (key, targets, group) in enumerate(pending, start=1):
        if args.limit and resolved >= args.limit:
            break
        profile = resolve_group(group, group[0]["person_key"], transfers, squads,
                                club_ids, directory, args.delay)
        if not profile:
            continue
        resolved += 1
        for r in targets:
            if args.dry_run:
                continue
            write_row_tm(r, profile)
            tm_cache[f"{_normalize_text(r['player']['name'])}::{_normalize_text(r['player']['club'])}"] = profile
        print(f"  [{resolved}] {group[0]['player']['name']} @ {group[0]['player']['club']}"
              f" → TM {profile.get('id')} via {profile.get('match_via')}")
        if resolved % 15 == 0 and not args.dry_run:
            save_dirty_players(rows)
            save_squad_cache(squads)
            save_club_cache(club_cache)
            _save_cache(tm_cache)
            print(f"    …progresso salvo ({index}/{len(pending)})")

    if not args.dry_run:
        save_dirty_players(rows)
        save_squad_cache(squads)
        save_club_cache(club_cache)
        _save_cache(tm_cache)
    print(f"Resolvidos via histórico de clubes: {resolved}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
