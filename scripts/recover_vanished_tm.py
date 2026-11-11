"""Recupera âncoras Transfermarkt de atletas que sumiram das séries A–C.

Saltos depende de tm_club para detectar saída ao exterior; jogadores sem
match no TM ficavam invisíveis (ex.: Alisson Santos, Figueirense→Napoli).
Para cada candidato (boa temporada, ausente no ano seguinte, sem âncora),
busca o perfil no TM por nome e valida por nome normalizado + ano de
nascimento ±2. Match único e alto grau → grava âncora em people.json,
linha da temporada e transfermarkt-cache.

Uso: python scripts/recover_vanished_tm.py [--apply] [--min-rating 7.0]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from engine.transfermarkt import _name_similarity, _search_players, _scrape_profile, _name_query_variants  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LEAGUES = ["serie-a", "serie-b", "serie-c"]
ORIGINS = ["2022", "2023", "2024", "2025"]
CURRENT_YEAR = 2026


def norm(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def load_rows(league: str, season: str):
    for p in (DATA / league / "seasons" / season / "players.json", DATA / league / "players.json"):
        if p.exists() and (p.parent.name == season or season == str(CURRENT_YEAR) or "seasons" in str(p)):
            try:
                return json.loads(p.read_text(encoding="utf-8"))["players"], p
            except Exception:
                continue
    return [], None


def candidates(min_rating: float, min_minutes: int, people: dict):
    # presença por temporada seguinte
    next_idx: dict[str, set] = {}
    for lg in LEAGUES:
        for s in ("2023", "2024", "2025", "2026"):
            arr, _ = load_rows(lg, s)
            for r in arr:
                for k in (r.get("athlete_id"), r.get("person_key")):
                    if k:
                        next_idx.setdefault(f"{lg}-{s}", set()).add(k)
    out = []
    for s in ORIGINS:
        nxt = str(int(s) + 1)
        for lg in LEAGUES:
            arr, path = load_rows(lg, s)
            if not path or "seasons" not in str(path):
                continue
            for r in arr:
                if (r.get("rating") or 0) < min_rating or (r.get("minutes") or 0) < min_minutes:
                    continue
                person = people.get(r.get("person_key") or "", {})
                if person.get("tm_club") or person.get("tm_id") or (r.get("transfermarkt") or {}).get("id"):
                    continue
                keys = [k for k in (r.get("athlete_id"), r.get("person_key")) if k]
                if any(k in next_idx.get(f"{l}-{nxt}", set()) for l in LEAGUES for k in keys):
                    continue
                out.append({"season": s, "league": lg, "row": r, "path": path})
    return out


def match_player(row: dict, delay: float):
    """Melhor candidato único do TM por nome+idade; retorna (hit, motivo)."""
    name = row["name"]
    results = []
    seen = set()
    try:
        for q in _name_query_variants(name):
            for hit in _search_players(q):
                if hit["id"] not in seen:
                    seen.add(hit["id"])
                    results.append(hit)
            if results:
                break  # primeira variante com hits basta — mais específica primeiro
            time.sleep(delay)
    except Exception as e:
        return None, f"busca falhou: {e}"
    time.sleep(delay)
    if not results:
        return None, "sem resultados"

    birth = row.get("birth_year")
    scored = []
    for hit in results:
        sim = _name_similarity(name, hit["name"])
        tm_birth = CURRENT_YEAR - hit["age"] if hit.get("age") else None
        age_diff = abs(tm_birth - birth) if (tm_birth and birth) else None
        scored.append({"hit": hit, "sim": sim, "age_diff": age_diff})

    if birth:
        ok = [s for s in scored if s["sim"] >= 85 and s["age_diff"] is not None and s["age_diff"] <= 2]
    else:
        ok = [s for s in scored if s["sim"] >= 90]
    ok.sort(key=lambda s: (s["sim"], -(s["age_diff"] or 9)), reverse=True)
    if not ok:
        best = max(scored, key=lambda s: s["sim"])
        return None, f"nenhum passou nome+idade (melhor: {best['hit']['name']}@{best['hit']['club']} sim{best['sim']:.0f} diff{best['age_diff']})"
    if len(ok) > 1 and ok[0]["sim"] - ok[1]["sim"] < 5:
        return None, f"ambíguo: {', '.join(s['hit']['name'] + '@' + s['hit']['club'] for s in ok[:3])}"
    return ok[0]["hit"], None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--delay", type=float, default=0.6)
    ap.add_argument("--min-rating", type=float, default=7.0)
    ap.add_argument("--min-minutes", type=int, default=600)
    args = ap.parse_args()

    people_path = DATA / "cross-season" / "people.json"
    people = json.loads(people_path.read_text(encoding="utf-8"))
    cache_path = DATA / "transfermarkt-cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8"))
    tm_ids_taken = {p.get("tm_id") for p in people.values() if p.get("tm_id")}

    cands = candidates(args.min_rating, args.min_minutes, people)
    print(f"{len(cands)} candidatos sem âncora\n")
    resolved, skipped = [], []

    for c in cands:
        r, pk = c["row"], c["row"].get("person_key")
        hit, why = match_player(r, args.delay)
        tag = f"{c['season']} {c['league']} {r['name']} ({r['club']}, r{r['rating']}, nasc.{r.get('birth_year')})"
        if not hit:
            print(f"  - {tag} — {why}")
            skipped.append((c, why))
            continue
        if hit["id"] in tm_ids_taken:
            print(f"  - {tag} → {hit['name']}@{hit['club']} — tm_id {hit['id']} já é de outra pessoa")
            skipped.append((c, "tm_id duplicado"))
            continue
        try:
            profile = _scrape_profile(hit["path"])
        except Exception as e:
            print(f"  - {tag} → perfil falhou: {e}")
            skipped.append((c, "perfil falhou"))
            continue
        time.sleep(args.delay)
        resolved.append({"cand": c, "hit": hit, "profile": profile})
        tm_ids_taken.add(hit["id"])
        print(f"  + {tag} → {hit['name']} @ {profile['club']} ({profile['market_value'] or '-'})")

    print(f"\nResolvidos: {len(resolved)} · Pendentes: {len(skipped)}")
    if not (args.apply and resolved):
        return

    for item in resolved:
        c, prof = item["cand"], item["profile"]
        pk = c["row"].get("person_key")
        tm = dict(prof, matched_name=item["hit"]["name"])
        if pk and pk in people:
            people[pk].update(tm_id=prof["id"], tm_club=prof["club"],
                              photo=prof["photo"], profile_url=prof["profile_url"])
        c["row"]["transfermarkt"] = tm
        players_path = Path(c["path"])
        payload = json.loads(players_path.read_text(encoding="utf-8"))
        for row in payload["players"]:
            if row["player_id"] == c["row"]["player_id"]:
                row["transfermarkt"] = tm
        players_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        cache[f"{norm(c['row']['name'])}::{norm(c['row']['club'])}"] = tm

    people_path.write_text(json.dumps(people, ensure_ascii=False, indent=2), encoding="utf-8")
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Gravado em people.json, linhas de temporada e transfermarkt-cache.")


if __name__ == "__main__":
    main()
