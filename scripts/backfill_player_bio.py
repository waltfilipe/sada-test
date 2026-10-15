#!/usr/bin/env python3
"""Fill missing dominant foot, height and photo from Transfermarkt.

Heights already stored on cached squad rows are applied by player id.
Profiles with a Transfermarkt URL are scraped for Pé, Altura and the portrait.
Players without a URL are matched inside the cached club squad when the name
is unambiguous, then scraped the same way. Nothing is guessed.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from engine.transfermarkt import (  # noqa: E402
    _format_foot_pt,
    _normalize_text,
    _scrape_profile,
    load_club_cache,
    match_player_in_squad,
)

LEAGUES = ("serie-a", "serie-b", "serie-c", "serie-d")
DATA = ROOT / "data"
DELAY = 0.7


def missing_foot(value: object) -> bool:
    text = str(value or "").strip().lower()
    return text in {"", "nan", "unknown", "none", "null", "n/a", "-", "—"}


def missing_height(value: object) -> bool:
    if value is None or value == "":
        return True
    try:
        return int(value) <= 0
    except (TypeError, ValueError):
        return True


def dump_json(path: Path, payload: object) -> None:
    raw = path.read_bytes()
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if raw.endswith(b"\n"):
        text += "\n"
    path.write_text(text, encoding="utf-8")


def squad_heights(club_cache: dict) -> dict[str, int]:
    heights: dict[str, int] = {}
    for key, entry in club_cache.items():
        if key == "__directory__" or not isinstance(entry, dict):
            continue
        for row in entry.get("squad") or []:
            player_id = str(row.get("id") or "")
            height = row.get("height")
            if player_id and isinstance(height, int) and height > 0:
                heights[player_id] = height
    return heights


def needs_bio(player: dict) -> bool:
    tm = player.get("transfermarkt") if isinstance(player.get("transfermarkt"), dict) else {}
    return missing_foot(player.get("foot")) or missing_height(player.get("height")) or not tm.get("photo")


def apply_update(player: dict, update: dict) -> bool:
    changed = False
    foot = update.get("foot")
    if foot and missing_foot(player.get("foot")):
        player["foot"] = foot
        changed = True
    elif str(player.get("foot") or "").strip().lower() == "ambos":
        player["foot"] = "Ambidestro"
        changed = True

    height = update.get("height")
    if isinstance(height, int) and height > 0 and missing_height(player.get("height")):
        player["height"] = height
        changed = True

    photo = update.get("photo")
    tm_patch = update.get("transfermarkt")
    if isinstance(tm_patch, dict) and not isinstance(player.get("transfermarkt"), dict):
        player["transfermarkt"] = {
            key: value
            for key, value in tm_patch.items()
            if key not in {"foot", "height"}
        }
        changed = True
    tm = player.get("transfermarkt")
    if photo and isinstance(tm, dict) and not tm.get("photo"):
        tm["photo"] = photo
        changed = True
    return changed


def main() -> None:
    club_cache = load_club_cache()
    heights = squad_heights(club_cache)
    players_by_league: dict[str, dict] = {}
    updates: dict[str, dict] = {}
    scrape_paths: dict[str, list[str]] = {}

    for league in LEAGUES:
        payload = json.loads((DATA / league / "players.json").read_text(encoding="utf-8"))
        players_by_league[league] = payload
        for player in payload["players"]:
            player_id = player["player_id"]
            tm = player.get("transfermarkt") if isinstance(player.get("transfermarkt"), dict) else {}
            tm_id = str(tm.get("id") or "")
            update = updates.setdefault(player_id, {})
            if missing_height(player.get("height")) and tm_id in heights:
                update["height"] = heights[tm_id]
            if str(player.get("foot") or "").strip().lower() == "ambos":
                update["foot"] = "Ambidestro"

            still_height = missing_height(player.get("height")) and "height" not in update
            still_foot = missing_foot(player.get("foot")) and update.get("foot") != "Ambidestro"
            still_photo = not tm.get("photo")
            if not (still_foot or still_height or still_photo):
                continue

            path = None
            profile_url = tm.get("profile_url") or ""
            if "/spieler/" in profile_url:
                path = profile_url.split("transfermarkt.com.br", 1)[-1]
            else:
                squad_entry = club_cache.get(_normalize_text(player.get("club")))
                squad = squad_entry.get("squad", []) if isinstance(squad_entry, dict) else []
                matched = match_player_in_squad(player, squad)
                if matched and matched.get("path"):
                    path = matched["path"]
                    update["matched_squad"] = matched
                    if isinstance(matched.get("height"), int) and matched["height"] > 0 and "height" not in update:
                        update["height"] = matched["height"]
            if path:
                scrape_paths.setdefault(path, []).append(player_id)

    print(f"Scraping {len(scrape_paths)} Transfermarkt profiles", flush=True)
    scraped = 0
    for path, player_ids in scrape_paths.items():
        scraped += 1
        try:
            profile = _scrape_profile(path)
        except Exception as exc:
            print(f"FAIL {path} {exc}", flush=True)
            time.sleep(DELAY)
            continue
        foot = _format_foot_pt(profile.get("foot")) if not isinstance(profile.get("foot"), str) or profile.get("foot") not in {"Destro", "Canhoto", "Ambidestro"} else profile.get("foot")
        height = profile.get("height") if isinstance(profile.get("height"), int) else None
        photo = profile.get("photo")
        for player_id in player_ids:
            update = updates.setdefault(player_id, {})
            if foot and "foot" not in update:
                update["foot"] = foot
            if height and "height" not in update:
                update["height"] = height
            if photo and "photo" not in update:
                update["photo"] = photo
            if "transfermarkt" not in update and profile.get("id"):
                update["transfermarkt_fill"] = profile
        if scraped % 25 == 0:
            print(f"  {scraped}/{len(scrape_paths)}", flush=True)
        time.sleep(DELAY)

    changed_players = 0
    filled = {"foot": 0, "height": 0, "photo": 0}

    def consume(player: dict) -> None:
        nonlocal changed_players
        update = dict(updates.get(player["player_id"]) or {})
        before_foot = missing_foot(player.get("foot"))
        before_height = missing_height(player.get("height"))
        tm = player.get("transfermarkt") if isinstance(player.get("transfermarkt"), dict) else {}
        before_photo = not tm.get("photo")
        fill = update.pop("transfermarkt_fill", None)
        matched = update.pop("matched_squad", None)
        if isinstance(matched, dict) and not isinstance(player.get("transfermarkt"), dict) and fill:
            player["transfermarkt"] = {
                "id": str(fill.get("id") or matched.get("id") or ""),
                "photo": fill.get("photo"),
                "market_value": fill.get("market_value"),
                "market_value_eur": fill.get("market_value_eur"),
                "contract_until": fill.get("contract_until"),
                "contract_remaining": fill.get("contract_remaining"),
                "on_loan_from": fill.get("on_loan_from"),
                "club": fill.get("club") or player.get("club"),
                "profile_url": fill.get("profile_url"),
            }
        if isinstance(fill, dict) and isinstance(player.get("transfermarkt"), dict):
            current = player["transfermarkt"]
            for key in ("photo", "market_value", "market_value_eur", "contract_until", "contract_remaining", "on_loan_from", "club", "profile_url", "id"):
                if current.get(key) in (None, "") and fill.get(key) not in (None, ""):
                    current[key] = fill[key]
            if fill.get("photo") and not update.get("photo"):
                update["photo"] = fill["photo"]
        if apply_update(player, update):
            changed_players += 1
            tm_after = player.get("transfermarkt") if isinstance(player.get("transfermarkt"), dict) else {}
            if before_foot and not missing_foot(player.get("foot")):
                filled["foot"] += 1
            if before_height and not missing_height(player.get("height")):
                filled["height"] += 1
            if before_photo and tm_after.get("photo"):
                filled["photo"] += 1

    for league, payload in players_by_league.items():
        for player in payload["players"]:
            consume(player)
        dump_json(DATA / league / "players.json", payload)

        for profile_path in (DATA / league / "profiles").glob("*.json"):
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
            before = json.dumps(profile, ensure_ascii=False, indent=2)
            consume(profile)
            after = json.dumps(profile, ensure_ascii=False, indent=2)
            if after != before:
                dump_json(profile_path, profile)

        for family_path in (DATA / league).glob("family-*.json"):
            family = json.loads(family_path.read_text(encoding="utf-8"))
            before = json.dumps(family, ensure_ascii=False, indent=2)
            for player in family.get("players") or []:
                consume(player)
            after = json.dumps(family, ensure_ascii=False, indent=2)
            if after != before:
                dump_json(family_path, family)

    print(json.dumps({"changed_rows": changed_players, "filled": filled}, ensure_ascii=False))


if __name__ == "__main__":
    main()
