"""Injeta o aspecto "Cruzamentos" nos meio-campistas a partir das planilhas Wyscout.

A família meio-campistas nunca publicou cruzamentos — necessário para a
"tendência a cruzamentos" no resumo multi-temporada do PDF. Os xlsx em
data/import/wyscout são da temporada 2025 → o patch cobre apenas
data/{liga}/seasons/2025. Demais arquivos/temporadas permanecem sem o aspecto
e o resumo os ignora naturalmente. positions.py já emite o aspecto em
rebuilds futuros (quando a fonte da temporada existir).

Espelha a estrutura emitida por positions.py para laterais (kind metric_group,
subs Cruzamentos + Eficiência, percentile denso dentro do pool de MCs do arquivo).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from engine.sofascore import normalize_text  # noqa: E402

# xlsx → diretório da temporada publicada correspondente
LEAGUE_XLSX = {
    "serie-a": ("serie-a-2025.xlsx", "seasons/2025"),
    "serie-b": ("serie-b-2025.xlsx", "seasons/2025"),
    "serie-c": ("serie-c-2025.xlsx", "seasons/2025"),
}


def _grade(pct: float) -> str:
    for cut, grade in ((85, "A"), (75, "B+"), (65, "B"), (55, "B-"), (45, "C+"), (35, "C"), (25, "C-")):
        if pct >= cut:
            return grade
    return "D"


def _fmt_per90(value: float) -> str:
    return f"{value:.1f}".replace(".", ",")


def _fmt_pct(value: float) -> str:
    return f"{round(value)}%"


def _dense_pct(values: list[float]) -> list[float]:
    n = len(values)
    if n <= 1:
        return [50.0] * n
    order = sorted(range(n), key=lambda i: values[i])
    out = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg_rank = (i + j) / 2
        pct = (avg_rank / (n - 1)) * 100
        for k in range(i, j + 1):
            out[order[k]] = pct
        i = j + 1
    return [round(v, 1) for v in out]


def load_index() -> dict[tuple[str, str], dict[str, float]]:
    """{(nome_norm, clube_norm): {vol, eff}} a partir dos xlsx disponíveis."""
    index: dict[tuple[str, str], dict[str, float]] = {}
    for league, (filename, _) in LEAGUE_XLSX.items():
        path = ROOT / "data" / "import" / "wyscout" / filename
        if not path.exists():
            continue
        df = pd.read_excel(path, sheet_name=0)
        for _, row in df.iterrows():
            name = normalize_text(str(row.get("Jogador") or ""))
            club = normalize_text(str(row.get("Equipe") or row.get("Equipa") or ""))
            if not name:
                continue
            vol = pd.to_numeric(row.get("Cruzamentos/90"), errors="coerce")
            eff = pd.to_numeric(row.get("Cruzamentos certos, %"), errors="coerce")
            index[(name, club)] = {
                "vol": float(vol) if pd.notna(vol) else 0.0,
                "eff": float(eff) if pd.notna(eff) else 0.0,
            }
    return index


def lookup(index: dict, name: str, club: str) -> dict[str, float] | None:
    key = (normalize_text(name), normalize_text(club))
    hit = index.get(key)
    if hit:
        return hit
    # fallback: nome exato em qualquer clube (homônimo ambíguo fica de fora)
    hits = [v for (n, _), v in index.items() if n == key[0]]
    return hits[0] if len(hits) == 1 else None


def build_item(vol: float, eff: float, vol_pct: float, eff_pct: float) -> dict:
    pct = round(vol_pct, 1)
    return {
        "label": "Cruzamentos",
        "kind": "metric_group",
        "grade": _grade(pct),
        "percentile": pct,
        "sub_metrics": [
            {"label": "Cruzamentos", "percentile": round(vol_pct, 1), "display_value": _fmt_per90(vol)},
            {"label": "Eficiência", "percentile": round(eff_pct, 1), "display_value": _fmt_pct(eff)},
        ],
        "stats": [],
        "efficiency_pct": round(eff_pct, 1),
        "efficiency_value": _fmt_pct(eff),
    }


def process_family(path: Path, index: dict) -> dict[str, dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    players = data.get("players") or []
    hits = [lookup(index, p.get("name", ""), p.get("club", "")) for p in players]
    vols = [h["vol"] if h else 0.0 for h in hits]
    effs = [h["eff"] if h else 0.0 for h in hits]
    vol_pcts = _dense_pct(vols)
    eff_pcts = _dense_pct(effs)

    out: dict[str, dict] = {}
    patched = 0
    for (player, hit), vol_pct, eff_pct in zip(zip(players, hits), vol_pcts, eff_pcts):
        if hit is None:
            continue
        item = build_item(hit["vol"], hit["eff"], vol_pct, eff_pct)
        aspects = player.setdefault("aspects", {})
        group = aspects.setdefault("passes_finais", [])
        group[:] = [i for i in group if i.get("label") != "Cruzamentos"]
        group.insert(0, item)
        patched += 1
        pid = player.get("player_id")
        if pid:
            out[pid] = item
    if patched:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{path.relative_to(ROOT)}: {patched}/{len(players)} MCs com cruzamentos")
    return out


def patch_profiles(profiles_dir: Path, values: dict[str, dict]) -> int:
    patched = 0
    if not profiles_dir.is_dir() or not values:
        return 0
    for ppath in profiles_dir.glob("*.json"):
        profile = json.loads(ppath.read_text(encoding="utf-8"))
        item = values.get(profile.get("player_id") or ppath.stem)
        if item is None:
            continue
        group = profile.setdefault("aspects", {}).setdefault("passes_finais", [])
        group[:] = [i for i in group if i.get("label") != "Cruzamentos"]
        group.insert(0, item)
        ppath.write_text(json.dumps(profile, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        patched += 1
    return patched


def main() -> None:
    index = load_index()
    print(f"Indice Wyscout: {len(index)} atletas")
    if not index:
        return
    total = 0
    for league, (_, season_dir) in LEAGUE_XLSX.items():
        league_dir = ROOT / "data" / league / season_dir
        family = league_dir / "family-meio-campistas.json"
        if not family.exists():
            continue
        values = process_family(family, index)
        total += patch_profiles(league_dir / "profiles", values)
    print(f"Perfis atualizados: {total}")


if __name__ == "__main__":
    main()
