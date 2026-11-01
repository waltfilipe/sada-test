#!/usr/bin/env python3
"""
Fix heatmaps matched to a same-name athlete.

Reads people-conflicts.json (build_people.py): rows whose stored SofaScore
team never appears in the athlete's own club history are wrong attachments.

Actions:
  default      quarantine — move data/heatmaps/{player_id}.json to
               data/heatmaps-quarantine/, drop public/heatmaps pngs and strip
               the embedded `heatmap` field from profiles + family files.
  --resolve    additionally re-resolve via SofaScore search: the candidate's
               team must belong to the person's club history, then refetch the
               season heatmap and re-embed it everywhere.
  --dry-run    report only.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from engine.transfermarkt import _club_match_score  # noqa: E402
from engine.sofascore_heatmap import (  # noqa: E402
    fetch_api_json,
    fetch_player_season_heatmap,
    pick_season_entry,
    save_heatmap,
)

DATA = ROOT / "data"
LEAGUES = ("serie-a", "serie-b", "serie-c", "serie-d")
TOURNAMENT_IDS = {"serie-a": 325, "serie-b": 390, "serie-c": 1281, "serie-d": 10326}
CONFLICTS = DATA / "cross-season" / "people-conflicts.json"
HEATMAPS = DATA / "heatmaps"
QUARANTINE = DATA / "heatmaps-quarantine"
PUBLIC_HEATMAPS = ROOT / "public" / "heatmaps"


def season_dirs(league_dir: Path) -> list[Path]:
    out = [league_dir]
    seasons_root = league_dir / "seasons"
    if seasons_root.is_dir():
        out.extend(c for c in seasons_root.iterdir() if (c / "players.json").exists())
    return out


def strip_embedded(player_id: str, dry: bool) -> int:
    """Remove the heatmap field everywhere the row is embedded."""
    touched = 0
    for league in LEAGUES:
        for directory in season_dirs(DATA / league):
            for family_file in directory.glob("family-*.json"):
                try:
                    payload = json.loads(family_file.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    continue
                changed = False
                for entry in payload.get("players", []):
                    if entry.get("player_id") == player_id and entry.get("heatmap"):
                        entry["heatmap"] = None
                        changed = True
                if changed and not dry:
                    family_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                touched += int(changed)
        profile_file = DATA / league / "profiles" / f"{player_id}.json"
        if profile_file.exists():
            try:
                profile = json.loads(profile_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if profile.get("heatmap"):
                profile["heatmap"] = None
                if not dry:
                    profile_file.write_text(json.dumps(profile, ensure_ascii=False), encoding="utf-8")
                touched += 1
    return touched


def embed_heatmap(player_id: str, payload: dict) -> int:
    embedded = {
        "tournament_id": payload.get("tournament_id"),
        "season_id": payload.get("season_id"),
        "scope": payload.get("scope"),
        "competition": payload.get("competition"),
        "points": payload.get("points"),
        "point_count": payload.get("point_count"),
        "image_url": f"/heatmaps/{player_id}.png",
    }
    touched = 0
    for league in LEAGUES:
        for directory in season_dirs(DATA / league):
            for family_file in directory.glob("family-*.json"):
                try:
                    data = json.loads(family_file.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    continue
                changed = False
                for entry in data.get("players", []):
                    if entry.get("player_id") == player_id:
                        entry["heatmap"] = embedded
                        changed = True
                if changed:
                    family_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                    touched += 1
        profile_file = DATA / league / "profiles" / f"{player_id}.json"
        if profile_file.exists():
            try:
                profile = json.loads(profile_file.read_text(encoding="utf-8"))
                profile["heatmap"] = embedded
                profile_file.write_text(json.dumps(profile, ensure_ascii=False), encoding="utf-8")
                touched += 1
            except json.JSONDecodeError:
                pass
    return touched


def update_index(player_id: str, *, remove: bool = False) -> None:
    index_file = HEATMAPS / "index.json"
    if not index_file.exists():
        return
    index = json.loads(index_file.read_text(encoding="utf-8"))
    entries = index.get("heatmaps", [])
    if remove:
        index["heatmaps"] = [e for e in entries if e.get("player_id") != player_id]
    else:
        if not any(e.get("player_id") == player_id for e in entries):
            entries.append({"player_id": player_id})
    index["total"] = len(index["heatmaps"])
    index_file.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def quarantine(player_id: str, dry: bool) -> bool:
    payload_file = HEATMAPS / f"{player_id}.json"
    existed = payload_file.exists()
    if existed and not dry:
        QUARANTINE.mkdir(parents=True, exist_ok=True)
        payload_file.replace(QUARANTINE / payload_file.name)
    png = PUBLIC_HEATMAPS / f"{player_id}.png"
    if png.exists() and not dry:
        png.unlink()
    strip_embedded(player_id, dry)
    if not dry:
        update_index(player_id, remove=True)
    return existed


# ── Re-resolution via SofaScore search ────────────────────────────────────────


def search_ss_players(name: str, delay: float = 0.7) -> list[dict]:
    try:
        data = fetch_api_json(f"search/all?q={name}")
    except Exception:
        return []
    time.sleep(delay)
    out = []
    for group in data.get("results", []):
        for entity in group.get("entities", []):
            player = entity.get("player") or entity.get("entity") or {}
            if not player.get("id"):
                continue
            team = (player.get("team") or {}).get("name", "")
            out.append({"id": int(player["id"]), "name": player.get("name", ""), "team": team})
    return out


def resolve_row(row: dict, clubs: list[str], delay: float) -> dict | None:
    """Find the athlete on SofaScore by name; keep only candidates whose team
    belongs to the athlete's own club history."""
    league, season, player_id, name = row["league"], row["season"], row["player_id"], row["name"]
    tournament_id = TOURNAMENT_IDS.get(league)
    if not tournament_id:
        return None
    for candidate in search_ss_players(name, delay):
        if all(_club_match_score(candidate["team"], club) < 40 for club in clubs):
            continue
        try:
            seasons_payload = fetch_api_json(f"player/{candidate['id']}/statistics/seasons")
            time.sleep(delay)
            picked = pick_season_entry(seasons_payload, tournament_id, season_hint=str(season))
            if not picked:
                continue
            payload = fetch_player_season_heatmap(
                candidate["id"], tournament_id, picked["season_id"], scope="overall"
            )
            time.sleep(delay)
            payload["player_id"] = player_id
            payload["competition"] = picked.get("tournament_name")
            payload["sofascore_name"] = candidate["name"]
            payload["sofascore_team"] = candidate["team"]
            payload["source"] = "identity_fix"
            return payload
        except Exception:
            continue
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resolve", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", default="")
    parser.add_argument("--delay", type=float, default=0.7)
    args = parser.parse_args()

    conflicts = json.loads(CONFLICTS.read_text(encoding="utf-8"))
    flagged = [c for c in conflicts if c["type"] == "heatmap_team_mismatch"]
    if args.only:
        flagged = [c for c in flagged if args.only in c["player_id"]]
    # dedupe by player_id, keep the person metadata of the first hit
    seen: dict[str, dict] = {}
    for c in flagged:
        seen.setdefault(c["player_id"], c)
    flagged = list(seen.values())
    print(f"Heatmaps suspeitos: {len(flagged)}")

    people = json.loads((DATA / "cross-season" / "people.json").read_text(encoding="utf-8"))
    removed = 0
    for c in flagged:
        if args.dry_run:
            print(f"  {c['player_id']} → ss_team={c['sofascore_team']} (clubes: {c['person_clubs'][:3]})")
        if quarantine(c["player_id"], args.dry_run):
            removed += 1
    print(f"Removidos (quarentena + strip): {removed}")

    if not args.resolve or args.dry_run:
        return 0

    resolved = 0
    for c in flagged:
        rec = people.get(c["person_key"]) or {}
        row = next((r for r in rec.get("rows", []) if r["player_id"] == c["player_id"]), None)
        if not row:
            continue
        clubs = rec.get("clubs") or c.get("person_clubs") or []
        payload = resolve_row(
            {"league": row["league"], "season": int(row["season"]), "player_id": row["player_id"], "name": rec["name"]},
            clubs,
            args.delay,
        )
        if not payload:
            print(f"  sem match validado: {rec['name']} ({row['league']} {row['season']})")
            continue
        save_heatmap(row["player_id"], payload, HEATMAPS)
        embed_heatmap(row["player_id"], payload)
        update_index(row["player_id"])
        resolved += 1
        print(f"  re-resolvido: {rec['name']} → ss {payload['sofascore_player_id']} ({payload['sofascore_team']})")
    print(f"Re-resolvidos: {resolved}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
