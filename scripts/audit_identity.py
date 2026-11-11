"""Auditoria de identidade — detecta fusões/splits suspeitos de atletas.

Roda depois de `apply_athlete_ids.py` (etapa extra da cadeia). Emite
`data/cross-season/identity-audit.json` + resumo no console; cada achado
é um candidato a `identity-overrides.json` (merge_people / pin_athlete /
row_athlete).

Regras:
  R1 ss-anchor-collision  — mesmo ss_id em 2+ pessoas/atletas
  R2 ss-anchor-club       — clube do ss_id no CSV defensivo diverge do
                            clube da linha do atleta naquela liga+temporada
  R3 same-season-family   — athlete_id com famílias diferentes na mesma
                            temporada, ou par de famílias improvável
  R4 homonym-collision    — mesmo nome com athlete_ids distintos na mesma
                            liga+temporada (watchlist de homônimos)
  R5 birth-spread         — anos de nascimento do atleta variando >2 anos
  R6 multi-club-season    — athlete_id com 3+ clubes na mesma liga+temporada
"""

from __future__ import annotations

import csv
import json
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"
OUT = XS / "identity-audit.json"

LEAGUE_PREFIX = {"BRA": "serie-a", "BRB": "serie-b", "BRC": "serie-c", "BRD": "serie-d",
                 "BR26": "serie-a", "MLSN": "mls-next-pro"}
IMPROBABLE_PAIRS = {
    frozenset(("laterais", "zagueiros")),
    frozenset(("laterais", "atacantes")),
    frozenset(("zagueiros", "atacantes")),
    frozenset(("zagueiros", "extremos")),
}


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError:
        return default


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


_CLUB_SUFFIX = ("fc", "ec", "sc", "afc", "safc")


def norm_club(s: str) -> str:
    """Normalização agressiva p/ comparar grafia Wyscout x SofaScore."""
    n = norm(s)
    n = "".join(ch for ch in n if ch.isalnum())
    for suf in _CLUB_SUFFIX:
        if n.endswith(suf) and len(n) > len(suf) + 3:
            n = n[: -len(suf)]
    return n


def same_club(a: str, b: str) -> bool:
    a, b = norm_club(a), norm_club(b)
    return bool(a and b and (a in b or b in a))


def season_of(path: Path) -> str:
    # data/<league>/family-*.json -> "2026" | data/<league>/seasons/<Y>/family-*.json -> Y
    return path.parent.name if path.parent.name.isdigit() else "2026"


def league_of(path: Path) -> str:
    parts = path.relative_to(DATA).parts
    return parts[0]


def load_rows() -> list[dict]:
    rows = []
    for path in sorted(DATA.rglob("family-*.json")):
        if "cross-season" in path.parts:
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        league, season = league_of(path), season_of(path)
        family = path.stem.removeprefix("family-")
        for p in payload.get("players", []):
            rows.append({
                "league": league,
                "season": season,
                "player_id": p.get("player_id"),
                "name": p.get("name"),
                "club": p.get("club"),
                "birth_year": p.get("birth_year"),
                "family": p.get("position_family") or family,
                "position": p.get("position"),
                "athlete_id": p.get("athlete_id"),
                "person_key": p.get("person_key"),
            })
    return rows


def defensive_csvs() -> dict[tuple[str, str], Path]:
    out = {}
    for f in ROOT.glob("*_defensive.csv"):
        stem = f.stem.split("_")[0]
        prefix = "".join(ch for ch in stem if not ch.isdigit())
        season = "".join(ch for ch in stem if ch.isdigit())
        league = LEAGUE_PREFIX.get(prefix)
        if league and len(season) == 2:
            out[(league, "20" + season)] = f
    return out


def ss_clubs(csv_path: Path) -> dict[str, set[str]]:
    """ss_player_id -> clubes observados no CSV."""
    clubs: dict[str, set[str]] = defaultdict(set)
    try:
        with csv_path.open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                pid = r.get("player_id") or ""
                club = r.get("home_team") if r.get("is_home") == "True" else r.get("away_team")
                if pid and club:
                    clubs[pid].add(club)
    except (OSError, UnicodeDecodeError):
        pass
    return clubs


def main() -> None:
    rows = load_rows()
    athletes = json.loads((XS / "athletes.json").read_text(encoding="utf-8")).get("athletes") or {}
    people = json.loads((XS / "people.json").read_text(encoding="utf-8"))

    findings: dict[str, list[dict]] = defaultdict(list)

    # ---- R1: mesmo ss_id em 2+ identidades ------------------------------------
    # dono = person_key do registro (evita contar atleta contra a própria pessoa)
    ss_owner: dict[str, set[str]] = defaultdict(set)
    for aid, rec in athletes.items():
        owner = rec.get("person_key") or aid
        for ss in (rec.get("sofascore") or {}).values():
            ss_owner[str(ss)].add(owner)
    for ss, owners in ss_owner.items():
        if len(owners) > 1:
            findings["ss-anchor-collision"].append({"ss_id": ss, "owners": sorted(owners)})

    # ---- R2: clube do ss_id no CSV x clube da linha --------------------------
    csvs = defensive_csvs()
    csv_cache: dict[Path, dict[str, set[str]]] = {}
    for aid, rec in athletes.items():
        row_club = {(r.get("league"), r.get("season")): r.get("club") or ""
                    for r in (rec.get("rows") or [])}
        for ls, ss in (rec.get("sofascore") or {}).items():
            league, _, season = ls.partition("/")
            csv_path = csvs.get((league, season))
            if not csv_path:
                continue
            if csv_path not in csv_cache:
                csv_cache[csv_path] = ss_clubs(csv_path)
            csv_club = csv_cache[csv_path].get(str(ss))
            my_club = row_club.get((league, season))
            if csv_club and my_club and not any(same_club(my_club, c) for c in csv_club):
                findings["ss-anchor-club"].append({
                    "athlete_id": aid, "name": rec.get("name"), "anchor": ls,
                    "ss_id": ss, "row_club": my_club, "csv_clubs": sorted(csv_club),
                })

    # ---- R3/R5/R6: por athlete_id sobre as linhas -----------------------------
    by_ath: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r["athlete_id"]:
            by_ath[r["athlete_id"]].append(r)

    for aid, rs in by_ath.items():
        name = rs[0]["name"]
        by_season: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for r in rs:
            by_season[(r["league"], r["season"])].append(r)

        # R3a: famílias improváveis na mesma temporada em clubes diferentes
        fams_by_year: dict[str, set] = defaultdict(set)
        for r in rs:
            fams_by_year[r["season"]].add(r["family"])
        for season, fams in fams_by_year.items():
            clubs = {r["club"] for r in rs if r["season"] == season and r["club"]}
            if len(clubs) > 1 and any(p <= fams for p in IMPROBABLE_PAIRS):
                findings["same-season-family"].append({
                    "athlete_id": aid, "name": name, "season": season,
                    "families": sorted(fams), "clubs": sorted(clubs),
                })
        # R3b: par de famílias improvável na trajetória
        fams_all = {r["family"] for r in rs}
        bad = [sorted(p) for p in IMPROBABLE_PAIRS if p <= fams_all]
        if bad:
            findings["improbable-family-pair"].append({
                "athlete_id": aid, "name": name,
                "families": sorted(fams_all), "pairs": bad,
                "rows": [f'{r["league"]}/{r["season"]}:{r["club"]}({r["family"]})' for r in rs],
            })

        # R5: dispersão de nascimento
        years = [r["birth_year"] for r in rs if r.get("birth_year")]
        if years and max(years) - min(years) > 2:
            findings["birth-spread"].append({
                "athlete_id": aid, "name": name,
                "min": min(years), "max": max(years),
                "rows": [f'{r["league"]}/{r["season"]}:{r["club"]}({r["birth_year"]})' for r in rs],
            })

        # R6: 3+ clubes na mesma liga+temporada
        for (league, season), rs2 in by_season.items():
            clubs = {r["club"] for r in rs2 if r["club"]}
            if len(clubs) >= 3:
                findings["multi-club-season"].append({
                    "athlete_id": aid, "name": name,
                    "league": league, "season": season, "clubs": sorted(clubs),
                })

    # ---- R4: homônimos na mesma liga+temporada --------------------------------
    overrides = load_json(XS / "identity-overrides.json", {})
    distinct_pairs = {tuple(sorted(p)) for p in overrides.get("distinct_pairs", [])}

    def all_pairs_allowlisted(aids: list) -> bool:
        from itertools import combinations
        return all(tuple(sorted(pair)) in distinct_pairs for pair in combinations(sorted(aids), 2))

    by_name: dict[tuple[str, str, str], set] = defaultdict(set)
    for r in rows:
        if r["athlete_id"]:
            by_name[(r["league"], r["season"], norm(r["name"]))].add(r["athlete_id"])
    for (league, season, nm), aids in sorted(by_name.items()):
        if len(aids) > 1 and not all_pairs_allowlisted(sorted(aids)):
            findings["homonym-collision"].append({
                "league": league, "season": season, "name": nm,
                "athlete_ids": sorted(aids),
            })

    report = {
        "generated_for": "identity audit",
        "counts": {k: len(v) for k, v in sorted(findings.items())},
        "findings": findings,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"audit -> {OUT.relative_to(ROOT)}")
    for k, v in sorted(findings.items()):
        print(f"  {k}: {len(v)}")
    if not findings:
        print("  nenhum achado")


if __name__ == "__main__":
    sys.exit(main() or 0)
