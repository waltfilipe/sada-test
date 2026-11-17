#!/usr/bin/env python3
"""Split do cluster ath-002047 (tm 1093924 = Joao Scapin, GOLEIRO do
Novorizontino, sem linha nos dados) em pessoas reais:

- Dantas (Joao Vitor Silva Dantas de Oliveira, tm 1093926, zagueiro,
  base do Novorizontino -> Athletico-PR jul/2026):
  serie-b/2025 Novorizontino, serie-a/2026 Athletico, serie-b/2026 Athletico
  + linhas est-paulista-a1 2024/2025/2026 (pins na fase 2)
- Meia Londrina->Tombense 2025 (sem tm conhecido):
  serie-c/2025 Londrina + Tombense (+ est-mineiro/2025 Tombense, pin fase 2)
- Ponta Coritiba->Atletico-CE 2022 (sem tm conhecido):
  fica em name:joao vitor|2001|0
- Lateral Coritiba (name:joao vitor|2007|0): so desancora o GK.

Roda ANTES de build_people/registry. Depois: link_est + apply_athlete_ids.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"

P_DANTAS = "name:joao vitor|2004|0"
P_MEIA = "name:joao vitor|2005|0"
P_PONTA = "name:joao vitor|2001|0"
P_LATERAL = "name:joao vitor|2007|0"
GK_TM = "1093924"

DANTAS_ROWS = {
    ("serie-b", "2025", "serie-b-jo-o-vitor-gr-mio-novorizontino-88"): "Grêmio Novorizontino",
    ("serie-a", "2026", "jo-o-vitor-athletico-paranaense-421"): "Athletico Paranaense",
    ("serie-b", "2026", "serie-b-jo-o-vitor-athletico-paranaense-386"): "Athletico Paranaense",
    ("hub", "2026", "jo-o-vitor-athletico-paranaense-421"): "Athletico Paranaense",
}
MEIA_ROWS = {
    ("serie-c", "2025", "serie-c-jo-o-vitor-londrina-306"),
    ("serie-c", "2025", "serie-c-jo-o-vitor-tombense-427"),
}
CLEAR_TM_ROWS = {
    ("serie-a", "2022", "jo-o-vitor-coritiba-721"),
    ("serie-c", "2022", "serie-c-jo-o-vitor-atl-tico-cearense-622"),
    ("serie-c", "2025", "serie-c-jo-o-vitor-londrina-306"),
    ("serie-c", "2025", "serie-c-jo-o-vitor-tombense-427"),
    ("serie-b", "2025", "serie-b-jo-o-vitor-coritiba-398"),
}


def tm_block_dantas(club: str) -> dict:
    return {
        "id": "1093926",
        "club": club,
        "profile_url": "https://www.transfermarkt.com.br/dantas/profil/spieler/1093926",
        "market_value": "€ 700 mil",
        "market_value_eur": 700000,
        "contract_until": "2026-12-31",
        "on_loan_from": "Grêmio Novorizontino" if club == "Athletico Paranaense" else None,
        "foot": "Destro",
        "height": 189,
        "matched_name": "Dantas",
        "match_via": "manual",
    }


def dirs_for(league: str, season: str) -> list[Path]:
    if league == "hub":
        return [DATA] if season == "2026" else []
    base = DATA / league
    if season == "2026":
        return [base]
    return [base / "seasons" / season]


def patch_files(row_keys: set[tuple[str, str, str]], block_of) -> int:
    touched = 0
    for league, season, pid in row_keys:
        for d in dirs_for(league, season):
            files = [d / "players.json", *sorted(d.glob("family-*.json"))]
            prof = d / "profiles" / f"{pid}.json"
            if prof.exists():
                files.append(prof)
            for path in files:
                if not path.exists():
                    continue
                payload = json.loads(path.read_text(encoding="utf-8"))
                rows = [payload] if path.parent.name == "profiles" else payload.get("players") or []
                dirty = False
                for row in rows:
                    if row.get("player_id") != pid:
                        continue
                    row["transfermarkt"] = block_of(league, season, pid)
                    dirty = True
                if dirty:
                    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                    touched += 1
    return touched


def main() -> int:
    persons = json.loads((XS / "persons.json").read_text(encoding="utf-8"))
    moved = 0
    for (league, season, pid), club in DANTAS_ROWS.items():
        if league == "hub":
            continue
        if persons.get(league, {}).get(season, {}).get(pid):
            persons[league][season][pid] = P_DANTAS
            moved += 1
    for league, season, pid in MEIA_ROWS:
        if persons.get(league, {}).get(season, {}).get(pid):
            persons[league][season][pid] = P_MEIA
            moved += 1
    (XS / "persons.json").write_text(json.dumps(persons, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"persons.json: {moved} linhas reparticionadas")

    n1 = patch_files(set(DANTAS_ROWS), lambda lg, s, pid: tm_block_dantas(DANTAS_ROWS[(lg, s, pid)]))
    n2 = patch_files(CLEAR_TM_ROWS, lambda *_: None)
    print(f"blocos tm: {n1} arquivos com tm 1093926 | {n2} com tm limpo")

    ov_path = XS / "identity-overrides.json"
    ov = json.loads(ov_path.read_text(encoding="utf-8"))
    un = ov.setdefault("tm_unanchor", {})
    for key in (P_DANTAS, P_MEIA, P_PONTA, P_LATERAL):
        un[key] = GK_TM
    ra = ov.setdefault("row_athlete", {})
    for stale in (
        "est-paranaense/2025/est-paranaense-jo-o-vitor-londrina-322-2025",
        "est-nv2/2025/est-nv2-jo-o-vitor-londrina-322",
    ):
        ra[stale] = "ath-002044"  # João Vitor de Souza, LD Londrina n.2003
    ra.pop("est-paulista-a1/2026/est-paulista-a1-jo-o-vitor-gr-mio-novorizontino-106-2026", None)
    ov_path.write_text(json.dumps(ov, ensure_ascii=False, indent=1), encoding="utf-8")
    print("overrides: tm_unanchor x4 | londrina-322 -> ath-002044 | pin -106 stale removido")
    return 0


if __name__ == "__main__":
    sys.exit(main())
