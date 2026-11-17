#!/usr/bin/env python3
"""Resolve achados do audit de identidade em tiers de confiança.

Roda depois de `audit_identity.py`. Dois produtos:

Tier 1 — aplicado direto em identity-overrides.json:
  linha com DUPLA contradição física vs a âncora tm da pessoa (altura >=4cm
  E nascimento >=3 anos ao mesmo tempo) é quase certamente um homônimo
  ancorado errado → entra em `row_unanchor` (bloco tm removido na próxima
  cadeia, sem re-ancoragem) e qualquer pin row_athlete conflitante é solto.
  O rebuild da projeção separa a linha pela trava física do builder.

Tier 2 — batch de revisão em identity-review-batch.json:
  atletas com sinais físicos compostos (height-spread + position-mismatch
  ou resíduos de anchor-physique) → proposta de pin_person por cluster de
  altura, com os dados necessários para aprovação humana.

Uso: python scripts/resolve_identity_flags.py [--apply]
Sem --apply, só gera o batch (dry-run).
"""
from __future__ import annotations

import json
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"
AUDIT = XS / "identity-audit.json"
OVERRIDES = XS / "identity-overrides.json"
BATCH = XS / "identity-review-batch.json"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def load_rows() -> dict[str, dict]:
    """(league, season, player_id) -> linha, sobre family-*.json."""
    out: dict[str, dict] = {}
    for path in sorted(DATA.rglob("family-*.json")):
        if "cross-season" in path.parts:
            continue
        payload = load_json(path, None)
        if not payload:
            continue
        parts = path.relative_to(DATA).parts
        league = "hub" if len(parts) == 1 else parts[0]
        season = path.parent.name if path.parent.name.isdigit() else "2026"
        for p in payload.get("players", []):
            pid = p.get("player_id")
            if pid:
                out[f"{league}/{season}/{pid}"] = p
    return out


def main() -> int:
    apply_mode = "--apply" in sys.argv
    audit = load_json(AUDIT, {})
    findings = audit.get("findings") or {}
    overrides = load_json(OVERRIDES, {})
    rows = load_rows()
    people = load_json(XS / "people.json", {})
    persons = load_json(XS / "persons.json", {})

    # ---------- Tier 1: dupla contradição física --------------------------
    def double_contradiction(f: dict) -> bool:
        h = (f.get("row_height") and f.get("tm_height")
             and abs(int(f["row_height"]) - int(f["tm_height"])) >= 4)
        b = (f.get("row_birth") and f.get("tm_birth")
             and abs(int(f["row_birth"]) - int(f["tm_birth"])) >= 3)
        return bool(h and b)

    row_unanchor = list(overrides.get("row_unanchor") or [])
    unanchor_set = set(row_unanchor)
    row_athlete: dict = overrides.get("row_athlete") or {}
    dropped_pins: list[str] = []
    tier1: list[dict] = []
    for f in findings.get("anchor-physique") or []:
        if not double_contradiction(f):
            continue
        key = f"{f['league']}/{f['season']}/{f['player_id']}"
        tier1.append({
            "key": key, "athlete_id": f["athlete_id"], "name": f["name"],
            "row": f'{f["league"]}/{f["season"]}:{f["club"]}',
            "row_physique": f'{f.get("row_height")}cm/{f.get("row_birth")}',
            "tm_physique": f'{f.get("tm_height")}cm/{f.get("tm_birth")}',
            "tm_id": f.get("tm_id"),
        })
        unanchor_set.add(key)
        if key in row_athlete:
            del row_athlete[key]
            dropped_pins.append(key)

    overrides["row_unanchor"] = sorted(unanchor_set)

    # ---------- Tier 2: propostas para atletas multi-sinal -----------------
    hs_athletes = {f["athlete_id"] for f in findings.get("height-spread") or []}
    pm_by_ath: dict[str, list] = defaultdict(list)
    for f in findings.get("position-mismatch") or []:
        pm_by_ath[f["athlete_id"]].append(f)
    ap_by_ath: dict[str, list] = defaultdict(list)
    for f in findings.get("anchor-physique") or []:
        ap_by_ath[f["athlete_id"]].append(f)

    # person_key existentes por prefixo de nome — gera chaves livres
    used_keys = set(persons.keys()) | set(people.keys())
    for keymap in persons.values():
        for rows_map in keymap.values():
            used_keys.update(rows_map.values())

    def free_key(name: str, birth: int) -> str:
        prefix = f"name:{norm(name)}|{birth}|"
        i = 0
        while f"{prefix}{i}" in used_keys:
            i += 1
        used_keys.add(f"{prefix}{i}")
        return f"{prefix}{i}"

    proposals: list[dict] = []
    multi = sorted(hs_athletes & (set(pm_by_ath) | set(ap_by_ath)))
    for aid in multi:
        ath_rows = [
            (lk, r) for lk, r in rows.items()
            if r.get("athlete_id") == aid
        ]
        if not ath_rows:
            continue
        # clusteriza por altura (proximidade <=3cm encadeia no mesmo cluster)
        known = sorted(
            ((int(r["height"]), lk, r) for lk, r in ath_rows if r.get("height")),
            key=lambda t: t[0],
        )
        if len(known) < 2:
            continue
        clusters: list[list[tuple[int, str, dict]]] = []
        for h, lk, r in known:
            if clusters and h - clusters[-1][-1][0] <= 3:
                clusters[-1].append((h, lk, r))
            else:
                clusters.append([(h, lk, r)])
        if len(clusters) < 2:
            continue
        clusters.sort(key=len, reverse=True)  # cluster 0 = dono da pessoa
        name = next((r.get("name") for _, r in ath_rows if r.get("name")), "")
        moves = []
        for cluster in clusters[1:]:
            birth = int(cluster[0][2].get("birth_year") or 0)
            key = free_key(name, birth)
            moves.append({
                "suggested_person_key": key,
                "rows": [
                    f'{lk.split("/")[0]}/{lk.split("/")[1]}/{r.get("player_id")}'
                    f'  ({r.get("club")}, {r.get("position")}, {h}cm, n.{r.get("birth_year")})'
                    for h, lk, r in cluster
                ],
            })
        signals = sorted({
            *(["height-spread"]),
            *(["position-mismatch"] if aid in pm_by_ath else []),
            *(["anchor-physique"] if aid in ap_by_ath else []),
        })
        proposals.append({
            "athlete_id": aid, "name": name, "signals": signals,
            "keep": [r.get("club") for _, _, r in [clusters[0][0]]],
            "height_range_keep": f'{clusters[0][0][0]}-{clusters[0][-1][0]}cm',
            "move_out": moves,
        })

    batch = {
        "generated_from": "identity-audit.json",
        "tier1_applied": tier1,
        "tier1_dropped_row_athlete_pins": dropped_pins,
        "tier2_proposals": proposals,
        "how_to_apply": (
            "aprove os splits copiando os pares para pin_person em "
            "identity-overrides.json (chave = 'liga/temporada/player_id' "
            "sem o comentário, valor = suggested_person_key) e rode a cadeia"
        ),
    }
    BATCH.write_text(json.dumps(batch, ensure_ascii=False, indent=1), encoding="utf-8")

    if apply_mode:
        OVERRIDES.write_text(
            json.dumps(overrides, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    print(f"tier1 (row_unanchor): {len(tier1)} linhas | pins soltos: {len(dropped_pins)}"
          f" | total unanchor: {len(unanchor_set)}")
    print(f"tier2 proposals: {len(proposals)} atletas -> {BATCH.relative_to(ROOT)}")
    if not apply_mode:
        print("dry-run — --apply grava identity-overrides.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
