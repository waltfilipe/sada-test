"""Backfills Transfermarkt profile metadata for every athlete with a tm_id.

The profile page (already fetched by build_transfer_history for leavers) also
carries signals the valuation model needs:

  - "Seleção/Gols" — national team caps (reputation factor)
  - "Contrato até" — contract end (contract factor; also kept by the
    transfermarkt cache, captured here as fallback)
  - the header ribbon — last move's origin club (abroad flag)

Entries are merged into data/cross-season/tm-profile-cache.json keyed by tm_id,
so the file stays a resumable single cache shared with build_transfer_history.

Targets are ordered current-season-first (league tier A -> estaduais) so a
partial --limit run already covers the leagues the valuation page serves.

Run:  python scripts/backfill_tm_profiles.py            # dry: só conta alvos
      python scripts/backfill_tm_profiles.py --fetch --limit 200
      python scripts/backfill_tm_profiles.py --fetch    # rodada completa
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

# build_transfer_history reassegura sys.stdout ao importar — não reassegurar
# aqui: o wrapper descartado fecharia o buffer compartilhado.
from build_transfer_history import DELAY, fetch_profile, parse_tm_page

DATA = Path(__file__).resolve().parent.parent / "data"
LEAGUES = ["serie-a", "serie-b", "serie-c", "serie-d", "est-nv1", "est-nv2", "est-nv3", "est-nv4"]
SEASONS = ["2026", "2025", "2024", "2023", "2022"]  # prioridade: temporada atual
CURRENT = "2026"

CACHE_FILE = DATA / "cross-season" / "tm-profile-cache.json"

CAPS_RE = re.compile(r'nationalmannschaft/spieler/\d+[^>]*>\s*(\d+)')
CAPS_TEAM_RE = re.compile(r'Sele\w*o:[^<]*<span[^>]*>\s*<img[^>]*alt="([^"]+)"', re.S)
CONTRACT_RE = re.compile(r'Contrato at[^<]*:</span>\s*<span[^>]*>\s*(\d{2}/\d{2}/\d{4})')


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def collect_targets() -> dict[str, str]:
    """tm_id -> profile_url, ordered current-season-first within each league."""
    ordered: dict[str, str] = {}
    for season in SEASONS:
        for league in LEAGUES:
            path = DATA / league / "players.json" if season == CURRENT else DATA / league / "seasons" / season / "players.json"
            if not path.is_file():
                continue
            payload = load_json(path)
            rows = payload.get("players", payload if isinstance(payload, list) else [])
            for p in rows:
                info = p.get("transfermarkt") or {}
                tid, url = info.get("id"), info.get("profile_url")
                if tid and url and str(tid) not in ordered:
                    ordered[str(tid)] = url
    return ordered


def parse_extra(html: str) -> dict:
    """caps/caps_team/contract_until — fields parse_tm_page doesn't return."""
    caps = CAPS_RE.findall(html)
    team = CAPS_TEAM_RE.search(html)
    contract = CONTRACT_RE.search(html)
    out: dict = {}
    if caps:
        out["caps"] = int(caps[0])
        out["caps_goals"] = int(caps[1]) if len(caps) > 1 else 0
    if team:
        out["caps_team"] = team.group(1)
    if contract:
        d, m, y = contract.group(1).split("/")
        out["contract_until"] = f"{y}-{m}-{d}"
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true", help="Fetch Transfermarkt profile pages")
    parser.add_argument("--limit", type=int, default=0, help="Cap fetches this run")
    parser.add_argument("--delay", type=float, default=DELAY)
    args = parser.parse_args()

    targets = collect_targets()
    cache: dict[str, dict] = load_json(CACHE_FILE) if CACHE_FILE.is_file() else {}

    def needs(entry: dict | None) -> bool:
        if not entry or entry.get("error"):
            return True
        # done when the caps probe ran (caps or explicit zero recorded)
        return "caps" not in entry and "caps_checked" not in entry

    todo = [(tid, url) for tid, url in targets.items() if needs(cache.get(tid))]
    print(f"tm_ids com perfil: {len(targets)} | em cache completo: {len(targets) - len(todo)} | a buscar: {len(todo)}")

    fetched = 0
    if args.fetch:
        for tid, url in todo:
            if args.limit and fetched >= args.limit:
                break
            html = fetch_profile(url)
            entry = dict(cache.get(tid) or {})
            if html:
                entry.update(parse_tm_page(html))
                entry.update(parse_extra(html))
                entry["caps_checked"] = True
                entry.setdefault("profile_url", url)
                entry.pop("error", None)
            else:
                entry["error"] = True
            cache[tid] = entry
            fetched += 1
            if fetched % 25 == 0:
                CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"  ...{fetched} perfis")
            time.sleep(args.delay)
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"buscados nesta rodada: {fetched}")

    with_caps = sum(1 for e in cache.values() if e.get("caps"))
    print(f"cache: {len(cache)} perfis | com caps>0: {with_caps}")


if __name__ == "__main__":
    main()
