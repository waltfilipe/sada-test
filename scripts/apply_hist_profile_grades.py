#!/usr/bin/env python3
"""Letras de perfil contra o pool multi-anual ponderado (curva normal no z do composto).

Para cada liga (default: serie-a) e cada familia (family-*.json):
  1. Recupera o z do composto shrinkado: nota = 6.5 + 1.85*tanh(z/2.5)
     => z = 2.5*atanh((nota - 6.5)/1.85)
  2. Pool = todas as temporadas (root = meta.season + seasons/<ano>), peso
     crescente por recencia (temporada mais antiga = 1 ... mais recente = N).
  3. mu/sd ponderados do z por slug -> pct = Phi((z - mu)/sd) * 100
     -> letra pelos mesmos cortes do site (PROFILE_GRADE_CUTS em scoutTheme.ts).
  4. Grava cluster.hist[slug] = {z, pct, grade} em:
     - data/<liga>/family-*.json e seasons/<ano>/family-*.json
     - data/<liga>/players.json e seasons/<ano>/players.json (join player_id)
     - data/<liga>/profiles/*.json (join player_id)
     + meta "hist_pool" no doc da familia (mu/sd/pesos de referencia).

Caveat: a nota gravada ja passa pelo specialty_floor (nota do arquetipo
>= nota_global), entao o z recuperado trunca a cauda esquerda do eixo
dominante. Para a referencia exata, o ideal e persistir m8_final_<slug>
no build (o script usa z recuperado enquanto isso nao existe).

Uso: python scripts/apply_hist_profile_grades.py [--league serie-a]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NOTA_MU = 6.5
NOTA_SCALE = 1.85
NOTA_TAU = 2.5

# Mesma tabela de lib/scoutTheme.ts (PROFILE_GRADE_CUTS)
GRADE_CUTS = [
    (98, "A+"),
    (93, "A"),
    (86, "A-"),
    (76, "B+"),
    (64, "B"),
    (52, "B-"),
    (40, "C+"),
    (28, "C"),
    (16, "C-"),
]


def grade_for_pct(pct: float) -> str:
    for cut, grade in GRADE_CUTS:
        if pct >= cut:
            return grade
    return "D"


def z_of_nota(nota: float) -> float:
    x = (float(nota) - NOTA_MU) / NOTA_SCALE
    x = max(-0.999, min(0.999, x))
    return NOTA_TAU * math.atanh(x)


def phi(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_if_changed(path: Path, doc: dict) -> bool:
    out = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    if path.exists() and path.read_text(encoding="utf-8") == out:
        return False
    path.write_text(out, encoding="utf-8")
    return True


def season_dirs(league_dir: Path) -> list[tuple[int, Path]]:
    out = []
    seasons_root = league_dir / "seasons"
    if seasons_root.is_dir():
        for d in seasons_root.iterdir():
            if d.is_dir() and d.name.isdigit():
                out.append((int(d.name), d))
    return sorted(out)


def cluster_hist(ratings: dict, ref: dict[str, tuple[float, float]]) -> dict:
    hist = {}
    for slug, nota in ratings.items():
        if slug not in ref or nota is None:
            continue
        mu, sd = ref[slug]
        z = z_of_nota(nota)
        zc = (z - mu) / sd if sd else 0.0
        pct = phi(zc) * 100.0
        hist[slug] = {
            "z": round(z, 2),
            "pct": round(pct, 1),
            "grade": grade_for_pct(pct),
        }
    return hist


def process_league(league: str) -> None:
    league_dir = ROOT / "data" / league
    if not league_dir.is_dir():
        raise SystemExit(f"liga nao encontrada: {league_dir}")

    meta_path = league_dir / "meta.json"
    root_year = int(load_json(meta_path)["season"]) if meta_path.exists() else None

    # (ano, diretorio, peso) — root conta como uma temporada
    year_dirs = season_dirs(league_dir)
    units: list[tuple[int, Path]] = list(year_dirs)
    if root_year is not None:
        units.append((root_year, league_dir))
    elif league_dir.joinpath("family-zagueiros.json").exists() or any(
        league_dir.glob("family-*.json")
    ):
        # sem meta: trata o root como a temporada mais recente
        latest = max((y for y, _ in units), default=0)
        units.append((latest + 1, league_dir))

    years = sorted({y for y, _ in units})
    weights = {y: i + 1 for i, y in enumerate(years)}

    families = sorted(p.name for p in league_dir.glob("family-*.json"))
    if not families:
        raise SystemExit(f"sem family-*.json em {league_dir}")

    total_players = 0
    for fam_file in families:
        family = fam_file.replace("family-", "").replace(".json", "")

        # 1) amostra ponderada de z por slug sobre todas as temporadas
        samples: dict[str, list[tuple[float, float]]] = {}
        per_unit: list[tuple[int, Path, dict]] = []
        for year, d in units:
            fpath = d / fam_file
            if not fpath.exists():
                continue
            doc = load_json(fpath)
            per_unit.append((year, fpath, doc))
            w = float(weights[year])
            for p in doc.get("players", []):
                ratings = ((p.get("cluster") or {}).get("ratings")) or {}
                for slug, nota in ratings.items():
                    if nota is None:
                        continue
                    samples.setdefault(slug, []).append((w, z_of_nota(nota)))

        if not per_unit:
            continue

        # 2) mu/sd ponderados
        ref: dict[str, tuple[float, float]] = {}
        ref_meta: dict[str, dict] = {}
        for slug, vals in samples.items():
            sw = sum(w for w, _ in vals)
            mu = sum(w * v for w, v in vals) / sw
            sd = math.sqrt(sum(w * (v - mu) ** 2 for w, v in vals) / sw)
            ref[slug] = (mu, sd)
            ref_meta[slug] = {"mu": round(mu, 4), "sd": round(sd, 4), "n": int(sw)}

        # 3) hist por jogador em cada arquivo da familia + mapa player_id -> hist
        hist_by_pid: dict[str, dict] = {}
        changed = 0
        for year, fpath, doc in per_unit:
            doc["hist_pool"] = {
                "weights": {str(y): weights[y] for y in years},
                "ref": ref_meta,
            }
            for p in doc.get("players", []):
                cluster = p.get("cluster")
                if not cluster or not cluster.get("ratings"):
                    continue
                hist = cluster_hist(cluster["ratings"], ref)
                if hist:
                    cluster["hist"] = hist
                    hist_by_pid[p["player_id"]] = hist
                    total_players += 1
            if write_if_changed(fpath, doc):
                changed += 1

        # 4) propaga para players.json e profiles/ do mesmo ano diretorio
        for year, d in units:
            players_path = d / "players.json"
            if players_path.exists():
                doc = load_json(players_path)
                touched = False
                for p in doc.get("players", []):
                    hist = hist_by_pid.get(p.get("player_id"))
                    if hist and isinstance(p.get("cluster"), dict):
                        p["cluster"]["hist"] = hist
                        touched = True
                if touched and write_if_changed(players_path, doc):
                    changed += 1
            # profiles/ so existe no root da liga
            profiles_dir = d / "profiles"
            if profiles_dir.is_dir():
                for ppath in profiles_dir.glob("*.json"):
                    doc = load_json(ppath)
                    hist = hist_by_pid.get(doc.get("player_id"))
                    if hist and isinstance(doc.get("cluster"), dict):
                        doc["cluster"]["hist"] = hist
                        write_if_changed(ppath, doc)

        dist: dict[str, dict[str, int]] = {}
        root_doc = next((doc for y, _, doc in per_unit if y == root_year), None)
        if root_doc:
            for p in root_doc.get("players", []):
                for slug, h in ((p.get("cluster") or {}).get("hist") or {}).items():
                    dist.setdefault(slug, {})
                    dist[slug][h["grade"]] = dist[slug].get(h["grade"], 0) + 1
        print(f"[{league}/{family}] {len(per_unit)} temps | hist em {len(hist_by_pid)} atletas | {changed} arquivos")
        for slug, counts in dist.items():
            order = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"]
            print(f"    {slug:14s} " + " ".join(f"{g}:{counts.get(g, 0)}" for g in order))

    print(f"\ntotal: {total_players} entradas hist gravadas")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default="serie-a")
    args = ap.parse_args()
    process_league(args.league)


if __name__ == "__main__":
    main()
