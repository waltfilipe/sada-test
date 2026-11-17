#!/usr/bin/env python3
"""Stamp athlete_id/person_key onto every player row in data/.

Registry leagues (present in persons.json: serie-a/b/c) resolve
row → person_key → athlete_id. Leagues outside the person graph
(estaduais, serie-d, mls-next-pro) resolve by their verified
Transfermarkt id when the row carries one — provable joins only, no
name guessing outside the graph. ``row_athlete`` overrides in
identity-overrides.json force any single row (true splits).

Rows with no resolved identity get stale keys removed — an unmapped
row must not keep an old athlete_id after a rebuild.

Run after build_athlete_registry.py. Idempotent.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.json_util import dumps_json  # noqa: E402
from engine.identity_display import LOCAL_PHOTO, sync_row_presentation  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
XS = DATA / "cross-season"


def log(*args) -> None:
    print(*(str(a).encode("ascii", "replace").decode("ascii") for a in args))


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def season_of(directory: Path) -> str:
    meta = load_json(directory / "meta.json", {})
    return str(meta.get("season") or "2026")


def iter_dirs() -> list[tuple[str, str, Path]]:
    """(league, season, dir) for data root, league dirs and seasons snapshots."""
    dirs: list[tuple[str, str, Path]] = []
    if (DATA / "players.json").exists() or list(DATA.glob("family-*.json")):
        dirs.append(("hub", season_of(DATA), DATA))
    for league_dir in sorted(DATA.iterdir()):
        if not league_dir.is_dir() or league_dir.name in {"cross-season", "heatmaps", "heatmaps-quarantine", "import", "athletes"}:
            continue
        has_rows = (league_dir / "players.json").exists() or list(league_dir.glob("family-*.json"))
        if has_rows:
            dirs.append((league_dir.name, season_of(league_dir), league_dir))
        seasons_root = league_dir / "seasons"
        if seasons_root.is_dir():
            for child in sorted(seasons_root.iterdir()):
                if child.is_dir() and ((child / "players.json").exists() or list(child.glob("family-*.json"))):
                    dirs.append((league_dir.name, child.name, child))
    return dirs


def patch_row(row: dict, league: str, season: str, resolve, person_of,
              row_unanchor: set = frozenset()) -> str:
    """Stampa identidade + cartão canônico (nome de exibição/foto)."""
    if f"{league}/{season}/{row.get('player_id') or ''}" in row_unanchor:
        row.pop("transfermarkt", None)
    athlete_id, person_key = resolve(league, season, row)
    if athlete_id:
        row["athlete_id"] = athlete_id
        if person_key:
            row["person_key"] = person_key
        else:
            row.pop("person_key", None)
        sync_row_presentation(row, person_of(athlete_id, person_key))
        return "id"
    row.pop("athlete_id", None)
    row.pop("person_key", None)
    # sem identidade o cartão canônico tambem não pode ficar (era de outro)
    row.pop("name_display", None)
    return "none"


def main() -> int:
    persons: dict = load_json(XS / "persons.json", {})
    people: dict = load_json(XS / "people.json", {})
    athletes: dict = load_json(XS / "athletes.json", {}).get("athletes") or {}
    overrides = load_json(XS / "identity-overrides.json", {})
    row_athlete: dict = overrides.get("row_athlete") or {}
    # linhas cujo bloco transfermarkt é provadamente de outro atleta
    # (contradição física com o perfil TM) — bloco removido, sem re-ancoragem
    row_unanchor = set(overrides.get("row_unanchor") or [])

    key_to_athlete = {k: (v or {}).get("athlete_id") for k, v in people.items()}
    tm_to_athlete = {
        str((v or {}).get("tm_id")): (v or {}).get("athlete_id")
        for v in people.values()
        if (v or {}).get("tm_id") and (v or {}).get("athlete_id")
    }
    # pessoa por athlete_id — carrega o cartão canônico (display_name/foto)
    athlete_to_person = {
        (v or {}).get("athlete_id"): v
        for v in people.values()
        if (v or {}).get("athlete_id")
    }
    athlete_rec = {aid: (rec or {}) for aid, rec in athletes.items()}

    # tm_id reivindicado por 2+ atletas não pode ancorar apresentação —
    # foto/valor em disputa ficam fora do cartão canônico
    tm_claims: dict[str, set] = defaultdict(set)
    for v in people.values():
        if (v or {}).get("tm_id") and (v or {}).get("athlete_id"):
            tm_claims[str(v["tm_id"])].add(v["athlete_id"])
    for aid, rec in athlete_rec.items():
        if rec.get("tm_id"):
            tm_claims[str(rec["tm_id"])].add(aid)

    def athlete_card(aid: str | None) -> dict:
        """Cartão do registro de atletas — só quando a âncora é indisputa."""
        rec = athlete_rec.get(aid or "") or {}
        tm = str(rec.get("tm_id") or "")
        if not tm or tm_claims.get(tm) != {aid}:
            return {"sofascore": rec.get("sofascore") or {}}
        out = {"tm_id": tm, "sofascore": rec.get("sofascore") or {}}
        if rec.get("photo"):
            out["photo"] = rec["photo"]
        if rec.get("profile_url"):
            out["profile_url"] = rec["profile_url"]
        return out

    def base_person(aid: str | None, pkey: str | None) -> dict:
        """Pessoa (people.json) sobre o cartão do registro como fallback."""
        person = people.get(pkey or "") or athlete_to_person.get(aid or "") or {}
        merged = athlete_card(aid)
        merged.update({k: v for k, v in person.items() if v})
        return merged

    def resolve(league: str, season: str, row: dict) -> tuple[str | None, str | None]:
        player_id = row.get("player_id") or ""
        key = f"{league}/{season}/{player_id}"
        if key in row_unanchor:
            return None, None  # âncora removida por contradição física
        if key in row_athlete:
            # valor null = limpeza explícita de identidade
            return (row_athlete[key] or None), None
        person_key = (persons.get(league) or {}).get(season, {}).get(player_id)
        if person_key:
            return key_to_athlete.get(person_key), person_key
        tm_id = (row.get("transfermarkt") or {}).get("id")
        if tm_id and str(tm_id) in tm_to_athlete:
            return tm_to_athlete[str(tm_id)], None
        return None, None

    # foto derivada por atleta: linha cuja âncora a prova ser dele —
    # tm da linha == tm da pessoa, ou tm que resolveu o próprio atleta,
    # ou /photos/{ss_id} presente nas âncoras SofaScore da pessoa
    athlete_photo: dict[str, str] = {}
    for league, season, directory in iter_dirs():
        payload = load_json(directory / "players.json", None)
        if payload is None:
            continue
        for row in payload.get("players", []):
            if not isinstance(row, dict):
                continue
            aid, pkey = resolve(league, season, row)
            if not aid or aid in athlete_photo:
                continue
            person = base_person(aid, pkey)
            if person.get("photo"):
                athlete_photo[aid] = person["photo"]
                continue
            tm = row.get("transfermarkt") or {}
            ph = str(tm.get("photo") or "")
            if not ph:
                continue
            rid = str(tm.get("id") or "")
            p_tm = str(person.get("tm_id") or "")
            if (p_tm and rid == p_tm) or (rid and tm_to_athlete.get(rid) == aid):
                athlete_photo[aid] = ph
                continue
            m = LOCAL_PHOTO.match(ph)
            if m and m.group(1) in {str(v) for v in (person.get("sofascore") or {}).values()}:
                athlete_photo[aid] = ph

    def person_of(athlete_id: str | None, person_key: str | None) -> dict:
        rec = base_person(athlete_id, person_key)
        if not rec.get("photo") and athlete_photo.get(athlete_id or ""):
            rec["photo"] = athlete_photo[athlete_id]
        return rec

    touched_files = 0
    stamped = matched_person = matched_tm = forced = cleared = 0
    for league, season, directory in iter_dirs():
        files = [directory / "players.json", *sorted(directory.glob("family-*.json"))]
        prof_dir = directory / "profiles"
        if prof_dir.is_dir():
            files.extend(sorted(prof_dir.glob("*.json")))
        for path in files:
            payload = load_json(path, None)
            if payload is None:
                continue
            is_profile = path.parent.name == "profiles"
            rows = [payload] if is_profile else (payload.get("players") or [])
            dirty = False
            for row in rows:
                if not isinstance(row, dict) or not row.get("player_id"):
                    continue
                before = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
                result = patch_row(row, league, season, resolve, person_of, row_unanchor)
                after = json.dumps(row, ensure_ascii=False, sort_keys=True, default=str)
                if result == "id":
                    stamped += 1
                    if row_athlete.get(f"{league}/{season}/{row['player_id']}"):
                        forced += 1
                    elif row.get("person_key"):
                        matched_person += 1
                    else:
                        matched_tm += 1
                else:
                    cleared += 1
                if before != after:
                    dirty = True
            if dirty:
                path.write_text(dumps_json(payload), encoding="utf-8")
                touched_files += 1
    log(
        f"athlete_id em {stamped} linhas "
        f"(grafo: {matched_person}, âncora TM: {matched_tm}, override: {forced}) "
        f"— {cleared} sem identidade resolvida · {touched_files} arquivos"
    )

    # auditoria de identidade — roda sempre que a cadeia stampa (novos atletas)
    if "--no-audit" not in sys.argv:
        try:
            import audit_identity

            audit_identity.main()
        except Exception as exc:  # auditoria nunca derruba a cadeia
            log(f"audit_identity falhou (ignorado): {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
