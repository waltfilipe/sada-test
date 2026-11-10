#!/usr/bin/env python3
"""Resolve colisões de sofascore_player_id em data/heatmaps (homônimos).

O import por nome pode carimbar o mesmo ss_id em mais de um atleta. O payload
do heatmap guarda `sofascore_name`/`sofascore_team` (a verdade): vence quem tem
clube correspondente; empate de clube resolve por nome com margem; sem critério,
remove o mapa de todos (vai para revisão manual em vez de dado errado).

Também reverte `position` de extremos que foi inferida pelo mapa errado.

Uso: python scripts/resolve_heatmap_collisions.py [--league est-nv2]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from engine.sofascore import club_match_score, name_similarity

DATA = ROOT / "data"
HM_DIR = DATA / "heatmaps"
PUBLIC_HM = ROOT / "public" / "heatmaps"


def log(*a) -> None:
    print(*(str(x).encode("ascii", "replace").decode("ascii") for x in a), flush=True)


def league_of(site_id: str) -> str | None:
    # est-nv2-foo-bar-12 -> est-nv2 ; serie-a-foo-1 -> serie-a
    for cand in ("est-nv1", "est-nv2", "est-nv3", "est-nv4", "serie-a", "serie-b",
                 "serie-c", "serie-d", "mls-next-pro", "estaduais"):
        if site_id.startswith(cand + "-"):
            return cand
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=None, help="limita a uma liga (ex.: est-nv2)")
    args = ap.parse_args()

    by_ss: dict[str, list[str]] = defaultdict(list)
    for path in HM_DIR.glob("*.json"):
        if path.name == "index.json":
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        sid = payload.get("player_id") or path.stem
        if args.league and league_of(sid) != args.league:
            continue
        ss = payload.get("sofascore_player_id")
        if ss:
            by_ss[str(ss)].append((sid, payload))

    drop: list[str] = []
    review: list[tuple[str, list[str]]] = []
    for ss, entries in by_ss.items():
        if len(entries) < 2:
            continue
        name = entries[0][1].get("sofascore_name") or ""
        team = entries[0][1].get("sofascore_team") or ""
        scored = []
        for sid, _ in entries:
            profile_path = DATA / league_of(sid) / "profiles" / f"{sid}.json"
            if not profile_path.is_file():
                continue
            prof = json.loads(profile_path.read_text(encoding="utf-8"))
            scored.append({
                "sid": sid,
                "name": prof.get("name") or "",
                "club": prof.get("club") or "",
                "cs": club_match_score(prof.get("club") or "", team),
                "ns": name_similarity(prof.get("name") or "", name),
            })
        cand = [s for s in scored if s["cs"] >= 40]
        winner = None
        if cand:
            best_cs = max(s["cs"] for s in cand)
            top = [s for s in cand if s["cs"] == best_cs]
            if len(top) == 1:
                winner = top[0]
            else:
                top.sort(key=lambda s: -s["ns"])
                if top[0]["ns"] - top[1]["ns"] >= 15:
                    winner = top[0]
        for s in scored:
            if winner is None or s["sid"] != winner["sid"]:
                drop.append(s["sid"])
        if winner is None:
            review.append((ss, [f"{s['name']} ({s['club']})" for s in scored]))
            log(f"  ambiguo ss {ss} ({name}/{team}): {[s['name'] for s in scored]}")

    if not drop:
        log("sem colisões")
        return 0

    drop_ids = set(drop)
    log(f"removendo heatmap de {len(drop_ids)} atletas")
    removed = 0
    for sid in drop_ids:
        league = league_of(sid)
        if not league:
            continue
        profile_path = DATA / league / "profiles" / f"{sid}.json"
        fam_pos = None
        for fam_path in (DATA / league).glob("family-*.json"):
            fam = json.loads(fam_path.read_text(encoding="utf-8"))
            for row in fam.get("players", []):
                if row.get("player_id") == sid:
                    fam_pos = row.get("position")
                    row.pop("heatmap", None)
                    fam_path.write_text(json.dumps(fam, ensure_ascii=False, indent=2), encoding="utf-8")
        if profile_path.is_file():
            prof = json.loads(profile_path.read_text(encoding="utf-8"))
            touched = prof.pop("heatmap", None) is not None
            if fam_pos and prof.get("position") != fam_pos:
                prof["position"] = fam_pos
                touched = True
            if touched:
                profile_path.write_text(json.dumps(prof, ensure_ascii=False, indent=2), encoding="utf-8")
                removed += 1
        players_path = DATA / league / "players.json"
        payload = json.loads(players_path.read_text(encoding="utf-8"))
        touched = False
        for row in payload.get("players", []):
            if row.get("player_id") in drop_ids and "heatmap" in row:
                row.pop("heatmap")
                touched = True
        if touched:
            players_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        for extra in (HM_DIR / f"{sid}.json", PUBLIC_HM / f"{sid}.png"):
            if extra.is_file():
                extra.unlink()

    from engine.sofascore_heatmap import write_heatmap_index
    write_heatmap_index()

    log(f"perfis limpos: {removed} | grupos para revisão manual: {len(review)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
