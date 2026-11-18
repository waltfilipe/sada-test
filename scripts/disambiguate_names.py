#!/usr/bin/env python3
"""Desambigua nomes de exibicao para homonimos confirmados.

Le identity-audit.json (homonym-collision) e, para cada atleta da colisao,
propoe um display_name que o diferencie:

1. nome curto do Transfermarkt quando difere do nome da linha
   (ex.: tm 544469 = "Charles Raphael" — o cache de elencos ja traz);
2. senao, "Nome (posicao)" — "Ze Vitor (zagueiro)" vs "Ze Vitor (meia)";
3. se a posicao tambem colide, "Nome (posicao, n.AAAA)".

So escreve display_name quando a ancora tm do atleta e indisputa ou quando
o qualificador vem da familia da linha — nunca inventa sobrenome.
Com --apply grava em identity-overrides.json (display_name); sem flag, dry-run.
Depois rode build_people + apply_athlete_ids.
"""
from __future__ import annotations

import json
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"
OVERRIDES = XS / "identity-overrides.json"

FAMILY_LABEL = {
    "laterais": "lateral", "zagueiros": "zagueiro",
    "meio-campistas": "meia", "extremos": "extremo",
    "atacantes": "atacante", "goleiros": "goleiro",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def main() -> int:
    apply_mode = "--apply" in sys.argv
    audit = load_json(XS / "identity-audit.json", {})
    people = load_json(XS / "people.json", {})
    athletes = load_json(XS / "athletes.json", {}).get("athletes") or {}
    overrides = load_json(OVERRIDES, {})
    display_name: dict = overrides.setdefault("display_name", {})

    # ancora disputada por 2+ pessoas nao pode nomear ninguem
    tm_claims: dict[str, int] = defaultdict(int)
    for rec in people.values():
        if (rec or {}).get("tm_id") and (rec or {}).get("athlete_id"):
            tm_claims[str(rec["tm_id"])] += 1

    # tm_id -> nome curto registrado no cache de elencos
    tm_name: dict[str, str] = {}
    for entry in load_json(DATA / "transfermarkt-squads.json", {}).values():
        for e in entry.get("squad", []):
            tid = str(e.get("id") or "")
            if tid and tid not in tm_name:
                tm_name[tid] = e.get("name") or ""

    person_by_ath = {(v or {}).get("athlete_id"): k for k, v in people.items() if (v or {}).get("athlete_id")}
    # familia dominante + clube por atleta — varre family-*.json
    family_by_ath: dict[str, str] = {}
    club_by_ath: dict[str, str] = {}
    for path in sorted(DATA.rglob("family-*.json")):
        if "cross-season" in path.parts:
            continue
        payload = load_json(path, None)
        if not payload:
            continue
        fam = path.stem.removeprefix("family-")
        for p in payload.get("players", []):
            aid = p.get("athlete_id")
            if aid:
                family_by_ath.setdefault(aid, p.get("position_family") or fam)
                club_by_ath.setdefault(aid, p.get("club") or "")

    suggestions: list[dict] = []
    for f in (audit.get("findings") or {}).get("homonym-collision") or []:
        aids = f.get("athlete_ids") or []
        fams_in_group = {family_by_ath.get(a) for a in aids}
        # posicao + nascimento iguais no mesmo grupo: desempata por clube
        births_in_group = {(family_by_ath.get(a), (people.get(person_by_ath.get(a) or "") or {}).get("birth_year")) for a in aids}
        for aid in aids:
            pkey = person_by_ath.get(aid) or (athletes.get(aid) or {}).get("person_key")
            if not pkey or pkey in display_name:
                continue
            person = people.get(pkey) or {}
            tm = str(person.get("tm_id") or "")
            base = person.get("name") or f.get("name") or ""
            suggestion = None
            via = None
            if tm and tm_claims.get(tm) == 1:
                cand = tm_name.get(tm) or ""
                if cand and norm(cand) != norm(base):
                    suggestion, via = cand, "tm-name"
            if not suggestion:
                label = FAMILY_LABEL.get(family_by_ath.get(aid) or "")
                if label:
                    birth = person.get("birth_year")
                    same_fam = sum(1 for a in aids if family_by_ath.get(a) == family_by_ath.get(aid))
                    parts = [label]
                    if same_fam > 1 and birth:
                        parts.append(f"n.{birth}")
                    dup = same_fam > 1 and len(births_in_group) < same_fam
                    club = club_by_ath.get(aid) or ""
                    if dup and club:
                        parts = [club]
                    suggestion = f"{base} ({', '.join(parts)})"
                    via = "family" + ("+birth" if same_fam > 1 and birth else "") + ("+club" if dup and club else "")
            if suggestion:
                display_name[pkey] = suggestion
                suggestions.append({
                    "athlete_id": aid, "person_key": pkey,
                    "was": base, "now": suggestion, "via": via,
                    "collision": f'{f.get("league")}/{f.get("season")}',
                })

    if apply_mode:
        OVERRIDES.write_text(
            json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(f"sugestoes: {len(suggestions)}{' (aplicadas)' if apply_mode else ' (dry-run)'}")
    for s in suggestions[:40]:
        print(f"  {s['athlete_id']} {s['was']} -> {s['now']} [{s['via']}] {s['collision']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
