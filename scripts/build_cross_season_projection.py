#!/usr/bin/env python3
"""Cross-season history index + per-metric supervised priors for projection (see projection_model.py)."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from engine.json_util import dumps_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BR_LEAGUES = ("serie-a", "serie-b", "serie-c")
SEASONS = ("2022", "2023", "2024", "2025")
CURRENT = "2026"

def norm_name(name: str) -> str:
    value = unicodedata.normalize("NFD", name)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    return value


def _tm_id(row: dict) -> str | None:
    tm = row.get("transfermarkt") or {}
    return str(tm.get("id")) if tm.get("id") else None


def _person_tm_ids(person: list[dict]) -> set[str]:
    return {tm_id for tm_id in (_tm_id(r) for r in person) if tm_id}


def _split_persons(rows: list[dict]) -> list[list[dict]]:
    """Split an ambiguous (name, birth, family) group into persons.

    Only called when some season has 2+ rows — that alone proves homonyms.
    Verified Transfermarkt ids are a hard partition: rows sharing a tm_id are
    provably the same athlete, rows with different tm_ids can never merge.
    Unpinned rows are chained by shared club; afterwards, persons whose season
    sets are disjoint are re-merged (same athlete changing clubs), unless both
    carry conflicting verified ids.
    """
    persons: list[list[dict]] = []
    for row in sorted(rows, key=lambda r: (r.get("_season") or "", r.get("_league") or "")):
        row_club = norm_name(row.get("club") or "")
        row_tm = _tm_id(row)
        candidates = []
        for person in persons:
            person_tm = _person_tm_ids(person)
            if row_tm and person_tm:
                # verified ids disagree → provably different athletes
                if row_tm not in person_tm:
                    continue
            if row_club and any(norm_name(r.get("club") or "") == row_club for r in person):
                candidates.append(person)
        if row_tm and not candidates:
            # pin to the person already holding this tm_id, if any
            pinned = next((p for p in persons if row_tm in _person_tm_ids(p)), None)
            if pinned is not None:
                candidates.append(pinned)
        if not candidates:
            persons.append([row])
        else:
            best = max(candidates, key=lambda p: (p[-1].get("_season") or ""))
            best.append(row)
    merged: list[list[dict]] = []
    for person in persons:
        seasons = {r.get("_season") for r in person}
        person_tm = _person_tm_ids(person)
        target = next(
            (
                m
                for m in merged
                if not seasons & {r.get("_season") for r in m}
                and not (person_tm and _person_tm_ids(m) and person_tm != _person_tm_ids(m))
            ),
            None,
        )
        if target is None:
            merged.append(person)
        else:
            target.extend(person)
            target.sort(key=lambda r: (r.get("_season") or "", r.get("_league") or ""))
    return merged


def assign_season_keys(
    rows: list[dict],
    prev_keys: dict[tuple[str, str, str], str] | None = None,
) -> dict[tuple[str, int], str]:
    """Link seasons by normalized name + birth-year cluster + family + club chain.

    Wyscout archives report the same athlete's birth year inconsistently across
    seasons (±1), so an exact name|birth match loses most history. Rows of the
    same normalized name are clustered by birth proximity (each member within
    ±1 year of the cluster's earliest birth), then split by position family
    and club-chain so homonyms don't merge into one career.
    """
    by_name: dict[str, list[dict]] = {}
    for row in rows:
        by_name.setdefault(norm_name(row.get("name", "")), []).append(row)
    index: dict[tuple[str, int], str] = {}
    for name, members in by_name.items():
        members.sort(key=lambda r: (r.get("birth_year") or 0))
        cluster_min: int | None = None
        prev_birth = 0
        groups: dict[int, list[dict]] = {}
        for row in members:
            birth = row.get("birth_year") or 0
            if not birth:
                groups.setdefault(0, []).append(row)
                continue
            if cluster_min is None or birth - prev_birth > 1:
                cluster_min = birth
            prev_birth = birth
            groups.setdefault(cluster_min, []).append(row)
        for cluster, group_rows in groups.items():
            season_counts: dict[str, int] = {}
            for row in group_rows:
                s = row.get("_season") or ""
                season_counts[s] = season_counts.get(s, 0) + 1
            persons = (
                [group_rows]
                if all(count == 1 for count in season_counts.values())
                else _split_persons(group_rows)
            )
            # Carry-forward: a person identical to a previous build keeps its
            # person_key, so transfers.json/people.json survive rebuilds.
            prev_keys = prev_keys or {}
            prefix = f"name:{name}|{cluster}|"
            taken: set[str] = set()
            for person in persons:
                votes: Counter[str] = Counter()
                for row in person:
                    old = prev_keys.get((row.get("_league"), row.get("_season"), row.get("player_id")))
                    if old and old.startswith(prefix):
                        votes[old] += 1
                person_key = next((key for key, _ in votes.most_common() if key not in taken), None)
                if person_key is None:
                    i = 0
                    while f"{prefix}{i}" in taken:
                        i += 1
                    person_key = f"{prefix}{i}"
                taken.add(person_key)
                for row in person:
                    row["_person_key"] = person_key
                    sig = (
                        name,
                        row.get("birth_year") or 0,
                        row.get("position_family") or "",
                        norm_name(row.get("club") or ""),
                    )
                    index.setdefault(sig, person_key)
    return index


def load_season_players(league: str, season: str) -> list[dict]:
    if season == CURRENT:
        base = DATA / league
    else:
        base = DATA / league / "seasons" / season
    out: list[dict] = []
    for path in base.glob("family-*.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for p in payload.get("players", []):
            p = dict(p)
            p["_season"] = season
            p["_league"] = league
            out.append(p)
    return out


def main() -> None:
    # Index all seasons by clustered player key (computed over every row so
    # minute thresholds don't shift the clusters)
    all_rows: list[dict] = []
    for league in BR_LEAGUES:
        for season in (*SEASONS, CURRENT):
            if season != CURRENT:
                if not (DATA / league / "seasons" / season).is_dir():
                    continue
            all_rows.extend(load_season_players(league, season))
    prev_keys: dict[tuple[str, str, str], str] = {}
    prev_path = DATA / "cross-season" / "persons.json"
    if prev_path.exists():
        try:
            prev_persons = json.loads(prev_path.read_text(encoding="utf-8"))
            for lg, seasons in prev_persons.items():
                for s, mapping in seasons.items():
                    for pid, key in mapping.items():
                        prev_keys[(lg, s, pid)] = key
        except json.JSONDecodeError:
            pass
    key_index = assign_season_keys(all_rows, prev_keys)

    timeline: dict[str, list[dict]] = {}
    persons_map: dict[str, dict[str, dict[str, str]]] = {}
    for p in all_rows:
        key = p.get("_person_key")
        if not key:
            continue
        persons_map.setdefault(p["_league"], {}).setdefault(p["_season"], {})[p["player_id"]] = key
        if (p.get("minutes") or 0) < 180:
            continue
        timeline.setdefault(key, []).append(p)

    for key in timeline:
        timeline[key].sort(key=lambda r: (r.get("_season") or "", r.get("_league") or ""))

    from projection_model import (  # noqa: E402
        backtest,
        extract_samples,
        fit_ridge,
        league_tier,
        predict,
        transitions,
        _features,
    )

    for rows in timeline.values():
        for row in rows:
            row["_samples"] = extract_samples(row)
            row["_n90"] = (row.get("minutes") or 0) / 90

    families = sorted({r.get("position_family") for rows in timeline.values() for r in rows if r.get("position_family")})
    keys_by_family: dict[str, set[str]] = {}
    for rows in timeline.values():
        for r in rows:
            keys_by_family.setdefault(r.get("position_family"), set()).update(r["_samples"].keys())

    models: dict[str, dict] = {}
    fitted = 0
    for family in families:
        for key in sorted(keys_by_family.get(family, ())):
            model = fit_ridge(transitions(timeline, family, key))
            if model:
                models[f"{family}|{key}"] = model
                fitted += 1

    bt = backtest(timeline, families, keys_by_family)
    out_models = DATA / "cross-season" / "models.json"
    out_models.parent.mkdir(parents=True, exist_ok=True)
    out_models.write_text(dumps_json(models), encoding="utf-8")
    (DATA / "cross-season" / "backtest.json").write_text(dumps_json(bt), encoding="utf-8")
    (DATA / "cross-season" / "persons.json").write_text(dumps_json(persons_map), encoding="utf-8")
    print(f"Fitted {fitted} per-metric ridge models; backtest 2025 (train<=2024):")
    for fam, rep in bt.items():
        print(f"  {fam}: {rep}")

    enriched = 0
    for league in BR_LEAGUES:
        for path in sorted((DATA / league).glob("family-*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            for player in payload.get("players", []):
                player.pop("cross_season", None)
                family = player.get("position_family") or path.stem.removeprefix("family-")
                sig = (
                    norm_name(player.get("name", "")),
                    player.get("birth_year") or 0,
                    family,
                    norm_name(player.get("club") or ""),
                )
                key = key_index.get(sig)
                hist = timeline.get(key, []) if key else []
                past = [h for h in hist if h.get("_season") != CURRENT]
                if not past:
                    continue
                ordered = sorted(past, key=lambda h: (h.get("_season") or "", h.get("_league") or ""))
                age = 2026 - (player.get("birth_year") or 1998)
                tier_cur = league_tier(league)
                cur_samples = extract_samples(player)
                low_minutes = (player.get("minutes_pct") or 100) < 50
                metrics: dict[str, dict] = {}
                for sample_key, cur_sample in cur_samples.items():
                    feats = _features(ordered, sample_key, age, tier_cur)
                    if feats is None:
                        continue
                    model = models.get(f"{family}|{sample_key}")
                    signed = cur_sample["signed"]
                    if model:
                        predicted = predict(model, feats, signed)
                        resid_sd, train_n90 = model["resid_sd"], model["train_n90"]
                    else:
                        predicted = feats[2]
                        resid_sd, train_n90 = None, None
                    vals = [h["_samples"][sample_key]["value"] for h in ordered if sample_key in h["_samples"]]
                    spread = max(vals) - min(vals) if len(vals) >= 2 else 999.0
                    consistent = spread <= max(0.35 * max(feats[2], 0.01), 0.4)
                    obs = cur_sample["value"]
                    tol = max(0.5 * max(abs(predicted), 0.5), 0.6, 2 * (resid_sd or 0))
                    flag = bool(abs(obs - predicted) > tol and low_minutes and not consistent)
                    entry = {"predicted": round(predicted, 4)}
                    if flag:
                        entry["role_change_flag"] = True
                    if resid_sd is not None:
                        entry["resid_sd"] = round(resid_sd, 4)
                        entry["train_n90"] = round(train_n90, 2)
                    metrics[sample_key] = entry
                if not metrics:
                    continue
                player["cross_season"] = {
                    "seasons": [
                        {
                            "year": h.get("_season"),
                            "league": h.get("_league"),
                            "minutes": h.get("minutes"),
                            "club": h.get("club"),
                        }
                        for h in past
                    ],
                    "metrics": metrics,
                }
                enriched += 1
            path.write_text(dumps_json(payload), encoding="utf-8")
            prof_dir = DATA / league / "profiles"
            if prof_dir.is_dir():
                for player in payload.get("players", []):
                    cid = player.get("player_id")
                    if cid and (prof_dir / f"{cid}.json").is_file():
                        (prof_dir / f"{cid}.json").write_text(dumps_json(player), encoding="utf-8")

    print(f"Wrote models -> {out_models}")
    print(f"Enriched {enriched} player rows with cross_season")


if __name__ == "__main__":
    main()
