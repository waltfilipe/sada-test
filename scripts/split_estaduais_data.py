#!/usr/bin/env python3
"""Legacy split of the global estaduais ratings into per-championship folders.

The published site no longer uses these folders. Levels est-nv1..4 are rebuilt
by scripts/build_estaduais_levels.py so percentiles stay inside the level.
"""

from __future__ import annotations

import json
import shutil
from collections import defaultdict
from pathlib import Path

from engine.estaduais_championship import CHAMPIONSHIP_IDS, classify_estadual_club
from engine.json_util import dumps_json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "estaduais"


def main() -> None:
    if not SOURCE.is_dir():
        raise SystemExit(f"Missing {SOURCE}. Run build for estaduais first.")

    players_payload = json.loads((SOURCE / "players.json").read_text(encoding="utf-8"))
    profiles_dir = SOURCE / "profiles"
    by_champ: dict[str, list[dict]] = defaultdict(list)

    for entry in players_payload.get("players", []):
        champ = classify_estadual_club(str(entry.get("club") or ""))
        by_champ[champ].append(entry)

    source_meta = json.loads((SOURCE / "meta.json").read_text(encoding="utf-8"))

    for champ_id in CHAMPIONSHIP_IDS:
        out_dir = ROOT / "data" / champ_id
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.mkdir(parents=True)
        profiles_out = out_dir / "profiles"
        profiles_out.mkdir()

        roster = by_champ.get(champ_id, [])
        player_ids = {p["player_id"] for p in roster}

        for pid in player_ids:
            src = profiles_dir / f"{pid}.json"
            if src.is_file():
                shutil.copy2(src, profiles_out / src.name)

        for family_file in SOURCE.glob("family-*.json"):
            family_key = family_file.stem.replace("family-", "")
            family_payload = json.loads(family_file.read_text(encoding="utf-8"))
            filtered = [p for p in family_payload.get("players", []) if p.get("player_id") in player_ids]
            (out_dir / family_file.name).write_text(
                dumps_json({"family": family_key, "players": filtered}),
                encoding="utf-8",
            )

        clubs = sorted({str(p.get("club") or "") for p in roster if p.get("club")})
        nationalities = sorted({str(p.get("nationality") or "") for p in roster if p.get("nationality")})
        ratings = [float(p["rating"]) for p in roster if p.get("rating") is not None]
        minutes = [int(p.get("minutes") or 0) for p in roster]

        family_counts = {}
        for family_file in SOURCE.glob("family-*.json"):
            family_key = family_file.stem.replace("family-", "")
            family_counts[family_key] = len(
                [p for p in json.loads(family_file.read_text())["players"] if p.get("player_id") in player_ids]
            )

        meta = {
            **{k: v for k, v in source_meta.items() if k not in ("league_id", "league", "player_count", "families", "clubs", "nationalities", "filters")},
            "league_id": champ_id,
            "league": champ_id.replace("est-", "").replace("-", " ").title(),
            "player_count": len(roster),
            "clubs": clubs,
            "nationalities": nationalities,
            "families": [
                {**f, "count": family_counts.get(f["key"], 0)}
                for f in source_meta.get("families", [])
            ],
            "filters": {
                **source_meta.get("filters", {}),
                "minutes": [0, max(minutes) if minutes else 0],
                "rating": [
                    round(min(ratings), 1) if ratings else 0,
                    round(max(ratings), 1) if ratings else 10,
                ],
            },
        }

        (out_dir / "meta.json").write_text(dumps_json(meta), encoding="utf-8")
        (out_dir / "players.json").write_text(
            dumps_json({"players": roster, "total": len(roster)}),
            encoding="utf-8",
        )
        print(f"{champ_id}: {len(roster)} jogadores")


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(ROOT / "scripts"))
    main()
