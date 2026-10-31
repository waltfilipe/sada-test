"""Detects club transfers per person_key and dates them via Transfermarkt.

Stints come from persons.json + each league/season players.json. A "leg" is a
club change between consecutive stints (same-club rows across leagues collapse).
For persons whose 2026 row carries a Transfermarkt id we fetch the profile page
once and parse the header ribbon ("Reforço contratado do: X; Data: ...; Quantia
paga: ...") plus the "No time desde" line, matching them to the latest leg.

Outputs:
  data/cross-season/transfers.json       person_key -> {current_club, legs[]}
  data/cross-season/tm-profile-cache.json tm_id -> parsed header (resumable)

Run:  python scripts/build_transfer_history.py            # offline legs only
      python scripts/build_transfer_history.py --fetch    # + Transfermarkt
      python scripts/build_transfer_history.py --fetch --limit 50
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DATA = Path(__file__).resolve().parent.parent / "data"
LEAGUES = ["serie-a", "serie-b", "serie-c", "serie-d"]
SEASONS = ["2022", "2023", "2024", "2025", "2026"]
CURRENT = "2026"
TIER = {"serie-a": 0, "serie-b": 1, "serie-c": 2, "serie-d": 3}

NO_CLUB = {
    "sem clube",
    "sem equipa",
    "fim de carreira",
    "aposentado",
    "retired",
    "career break",
    "free agent",
    "jogador livre",
    "youth",
    "unknown",
}


CACHE_FILE = DATA / "cross-season" / "tm-profile-cache.json"
OUT_FILE = DATA / "cross-season" / "transfers.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
DELAY = 0.55


def norm(text: str | None) -> str:
    import unicodedata

    raw = unicodedata.normalize("NFD", text or "")
    raw = "".join(c for c in raw if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", raw.lower()).strip()


def clubs_match(a: str | None, b: str | None) -> bool:
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    ta, tb = set(na.split()), set(nb.split())
    stop = {"de", "da", "do", "e", "fc", "sc", "ec", "ac", "ca", "se", "sp", "clube", "futebol"}
    ta -= stop
    tb -= stop
    return bool(ta & tb)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_stints():
    """person_key -> [(season, league, club, minutes)] and person_key -> tm info."""
    persons = load_json(DATA / "cross-season" / "persons.json")
    stints: dict[str, list] = {}
    tm: dict[str, dict] = {}
    for league in LEAGUES:
        for season in SEASONS:
            path = DATA / league / "players.json" if season == CURRENT else DATA / league / "seasons" / season / "players.json"
            if not path.is_file():
                continue
            payload = load_json(path)
            rows = payload.get("players", payload if isinstance(payload, list) else [])
            pmap = (persons.get(league) or {}).get(season) or {}
            for p in rows:
                key = pmap.get(p.get("player_id"))
                if not key:
                    continue
                stints.setdefault(key, []).append(
                    {
                        "season": season,
                        "league": league,
                        "club": p.get("club") or "",
                        "minutes": p.get("minutes") or 0,
                    }
                )
                info = p.get("transfermarkt") or {}
                if info.get("id") and info.get("profile_url"):
                    prev = tm.get(key)
                    if not prev or season == CURRENT:
                        tm[key] = {"id": str(info["id"]), "profile_url": info["profile_url"], "club": info.get("club")}
                elif season == CURRENT and info.get("club"):
                    cur = tm.setdefault(key, {})
                    cur.setdefault("club", info["club"])
    return stints, tm


def legs_for(stint_list: list) -> list[dict]:
    """Consecutive distinct-club stints -> transfer legs, chronological order."""
    ordered = sorted(stint_list, key=lambda s: (s["season"], TIER.get(s["league"], 9)))
    distinct: list[dict] = []
    for s in ordered:
        if not distinct or not clubs_match(distinct[-1]["club"], s["club"]):
            distinct.append(dict(s))
    legs = []
    for prev, nxt in zip(distinct, distinct[1:]):
        legs.append(
            {
                "from_club": prev["club"],
                "from_league": prev["league"],
                "from_season": prev["season"],
                "to_club": nxt["club"],
                "to_league": nxt["league"],
                "to_season": nxt["season"],
                "date": None,
                "fee": None,
                "kind": "permanent",
            }
        )
    return legs


RIBBON_RE = re.compile(r'<div class="data-header__ribbon">.*?title="([^"]+)"', re.S)
JOINED_RE = re.compile(r'No time desde:\s*<span[^>]*>(\d{2}/\d{2}/\d{4})')
RIBBON_DATE = re.compile(r"Data:\s*(\d{2})/(\d{2})/(\d{4})")
RIBBON_FEE = re.compile(r"Quantia paga:\s*([^;]+?)\s*$")
RIBBON_FROM = re.compile(r"(?:contratado|emprestado|trazido)\s+(?:do|de|da|d[oe]s?)\s*:?\s*([^;]+?)\s*;", re.I)


def br_to_iso(d: str, m: str, y: str) -> str:
    return f"{y}-{m}-{d}"


def parse_tm_page(html: str) -> dict:
    out: dict = {"joined": None, "move": None}
    jm = JOINED_RE.search(html)
    if jm:
        d, mo, y = jm.group(1).split("/")
        out["joined"] = br_to_iso(d, mo, y)
    rm = RIBBON_RE.search(html)
    if rm:
        title = rm.group(1)
        move: dict = {"from_club": None, "date": None, "fee": None, "kind": "permanent"}
        fm = RIBBON_FROM.search(title)
        if fm:
            move["from_club"] = fm.group(1).strip()
        dm = RIBBON_DATE.search(title)
        if dm:
            move["date"] = br_to_iso(dm.group(1), dm.group(2), dm.group(3))
        fe = RIBBON_FEE.search(title)
        if fe:
            move["fee"] = fe.group(1).strip()
        low = title.lower()
        if "mpréstim" in low or "mprestim" in low or "emprestado" in low:
            move["kind"] = "loan"
        elif "livre" in low or "gratuito" in low or "fim de contrato" in low:
            move["kind"] = "free"
        elif "retorno" in low or "fim do empr" in low:
            move["kind"] = "return"
        out["move"] = move
    return out


def fetch_profile(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        return urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
    except Exception:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch", action="store_true", help="Query Transfermarkt for transfer dates")
    parser.add_argument("--limit", type=int, default=0, help="Cap TM fetches this run")
    args = parser.parse_args()

    stints, tm = build_stints()
    entries: dict[str, dict] = {}
    for key, rows in stints.items():
        ordered = sorted(rows, key=lambda s: (s["season"], TIER.get(s["league"], 9)))
        last = ordered[-1]
        legs = legs_for(rows)
        tm_club = (tm.get(key) or {}).get("club")
        if tm_club and norm(tm_club) in NO_CLUB:
            tm_club = None
        current = tm_club or last["club"]
        # keep people who changed clubs (legs) or whose last stint no longer
        # matches the club shown by Transfermarkt (left for abroad/untracked)
        if not legs and clubs_match(current, last["club"]):
            continue
        entries[key] = {
            "current_club": current,
            "last": {"club": last["club"], "season": last["season"], "league": last["league"]},
            "legs": legs,
        }
    print(f"pessoas com saida detectada: {len(entries)}")

    cache: dict[str, dict] = load_json(CACHE_FILE) if CACHE_FILE.is_file() else {}
    targets = [(k, t) for k, t in tm.items() if k in entries]
    todo = [(k, t) for k, t in targets if t["id"] not in cache]
    print(f"com TM id: {len(targets)} | ja em cache: {len(targets) - len(todo)} | a buscar: {len(todo)}")

    fetched = 0
    if args.fetch:
        for key, t in todo:
            if args.limit and fetched >= args.limit:
                break
            html = fetch_profile(t["profile_url"])
            if html:
                cache[t["id"]] = parse_tm_page(html)
                cache[t["id"]]["profile_url"] = t["profile_url"]
                fetched += 1
            else:
                cache[t["id"]] = {"joined": None, "move": None, "error": True}
            if fetched % 25 == 0 and fetched:
                CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"  ...{fetched} perfis")
            time.sleep(DELAY)
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"buscados nesta rodada: {fetched}")

    dated = undated = 0
    for key, entry in entries.items():
        info = tm.get(key)
        parsed = cache.get(info["id"]) if info else None
        if not parsed:
            undated += 1
            continue
        move = parsed.get("move")
        joined = parsed.get("joined")
        legs = entry["legs"]

        # Trust check: the move's origin club must be one of the person's own
        # stints — otherwise the fetched TM profile belongs to a homonym and
        # its date/club would corrupt this athlete's record.
        trusted = True
        if move and move.get("from_club"):
            own_clubs = [s["club"] for s in stints.get(key, [])]
            trusted = any(clubs_match(move["from_club"], c) for c in own_clubs)
        if not trusted:
            move = None
            joined = None
            last_club = (entry.get("last") or {}).get("club")
            if last_club:
                entry["current_club"] = last_club

        if joined:
            entry["joined"] = joined
        applied = False
        if move and move.get("date") and legs:
            # find the leg whose origin club matches the TM "from" club
            hits = [i for i, leg in enumerate(legs) if clubs_match(leg["from_club"], move.get("from_club"))]
            if hits:
                leg = legs[hits[-1]]
                leg["date"] = move["date"]
                leg["fee"] = move.get("fee")
                leg["kind"] = move.get("kind") or "permanent"
                applied = True
        if not applied and joined and legs:
            # "No time desde" dates the arrival at the CURRENT club: accept it
            # when it lands on/after the window before the arrival season; an
            # older date means the TM record is stale.
            to_year = int(legs[-1]["to_season"] or 0)
            if to_year and int(joined[:4]) >= to_year - 1:
                legs[-1]["date"] = joined
                applied = True
        dated += 1 if applied else 0
        undated += 0 if applied else 1
    print(f"pernas datadas via TM: {dated} | sem data (label temporada): {undated}")

    # stale TM check: a "No time desde" older than the last stint means the TM
    # club predates our data — distrust both the date and the foreign club.
    stale = 0
    for key, entry in entries.items():
        joined = entry.get("joined")
        last = entry.get("last")
        if joined and last and joined[:4] < last["season"]:
            entry.pop("joined", None)
            if not clubs_match(entry["current_club"], last["club"]):
                entry["current_club"] = last["club"]
                stale += 1
    print(f"registros TM desatualizados ignorados: {stale}")

    OUT_FILE.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"ok -> {OUT_FILE.relative_to(DATA.parent)}")
    wallace = entries.get("name:wallace|2005|0")
    if wallace:
        print("wallace:", json.dumps(wallace, ensure_ascii=False))


if __name__ == "__main__":
    main()
