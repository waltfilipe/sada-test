"""Resolve ss-anchor-collision do identity-audit.

Para cada ss_id ancorado em 2+ pessoas, decide o dono pelo clube do
ss_id nos CSVs defensivos vs os clubes das linhas do registro naquela
liga+temporada. Remove a âncora dos donos que não batem (people.json +
athletes.json). Casos ambíguos (nenhum ou vários donos plausíveis)
ficam para revisão manual — não chuta.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XS = ROOT / "data" / "cross-season"
sys.path.insert(0, str(ROOT / "scripts"))
from audit_identity import defensive_csvs, same_club, ss_clubs  # noqa: E402


def main() -> int:
    audit = json.loads((XS / "identity-audit.json").read_text(encoding="utf-8"))
    findings = (audit.get("findings") or {}).get("ss-anchor-collision") or []
    people = json.loads((XS / "people.json").read_text(encoding="utf-8"))
    ath_payload = json.loads((XS / "athletes.json").read_text(encoding="utf-8"))
    athletes = ath_payload.get("athletes") or {}

    # person_key -> athlete rec (dono do registro)
    ath_by_person: dict[str, tuple[str, dict]] = {}
    for aid, rec in athletes.items():
        for pk in [rec.get("person_key"), *(rec.get("person_keys") or [])]:
            if pk:
                ath_by_person.setdefault(pk, (aid, rec))

    csvs = defensive_csvs()
    cache: dict = {}
    fixed = skipped = 0
    for f in findings:
        ss = str(f["ss_id"])
        # onde essa âncora aparece em people.json
        anchored: dict[str, list[str]] = {}  # person_key -> [league/season]
        for owner in f["owners"]:
            pk = owner if owner.startswith("name:") else None
            if pk is None:
                # dono era athlete_id sem person_key — acha via athletes
                rec = athletes.get(owner) or {}
                pk = rec.get("person_key")
            if not pk or pk not in people:
                continue
            for ls, v in (people[pk].get("sofascore") or {}).items():
                if str(v) == ss:
                    anchored.setdefault(pk, []).append(ls)
        if len(anchored) < 2:
            skipped += 1
            continue

        for pk, anchors in anchored.items():
            aid, rec = ath_by_person.get(pk, (None, {}))
            row_clubs = {(r.get("league"), r.get("season")): r.get("club") or ""
                         for r in (rec.get("rows") or [])}
            keep, drop = [], []
            for ls in anchors:
                league, _, season = ls.partition("/")
                csv_path = csvs.get((league, season))
                my_club = row_clubs.get((league, season))
                if csv_path and my_club:
                    if csv_path not in cache:
                        cache[csv_path] = ss_clubs(csv_path)
                    csv_clubs = cache[csv_path].get(ss) or set()
                    (keep if any(same_club(my_club, c) for c in csv_clubs) else drop).append(ls)
                else:
                    keep.append(ls)  # sem evidência — não mexe
            for ls in drop:
                del people[pk]["sofascore"][ls]
                if rec and (rec.get("sofascore") or {}).get(ls) == ss:
                    del rec["sofascore"][ls]
                fixed += 1
                print(f"  {pk}: removida âncora {ls}={ss} (clube {my_club} != CSV)")

    (XS / "people.json").write_text(
        json.dumps(people, ensure_ascii=False, indent=1), encoding="utf-8")
    (XS / "athletes.json").write_text(
        json.dumps(ath_payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nâncoras removidas: {fixed} | colisões sem evidência suficiente: {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
