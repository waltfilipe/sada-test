#!/usr/bin/env python3
"""Rebuild dos aspectos defensivos nos JSONs do site.

1) Recuperações/90 (SofaScore ball_recovery): casa cada atleta ao CSV
   defensivo da sua liga/temporada por identidade — sofascore_player_id do
   registro (people.json âncoras {liga}/{temporada}), fallback nome+clube.
   - zagueiros/laterais/meio-campistas: "Ações Defensivas" vira
     "Ações Defensivas e Recuperações" com a 4ª sub-métrica.
   - extremos: item próprio "Recuperações" no grupo defensivo.
   Ligas/temporadas sem CSV (estaduais, arquivos sem fonte) ficam sem a
   métrica — subs indevidas são removidas.

2) Eficiência Defensiva — modelo saldo defensivo (já aplicado):
   ação = duelos vencidos + interceptações + rebatidas + chutes bloqueados;
   custo = faltas + duelos perdidos ex-falta (sem dupla contagem).
   Subs passam a ser [Erros Totais, Ações sem Bola/90, Índice de Eficiência]
   e pair_badge = [err_pct, acoes_pct, eff_pct] — badge só com as 3 > 50.

Ações sem Bola/90 = duelos vencidos + recuperações + interceptações +
rebatidas + chutes bloqueados (percentil denso dentro do pool do arquivo).

Patches `data/{league}/family-*.json`, `data/{league}/seasons/*/family-*.json`
e os `profiles/*.json` correspondentes.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
sys.path.insert(0, str(ROOT / "scripts"))

import pandas as pd  # noqa: E402

from engine.sofascore import aggregate_sofascore, club_match_score, match_ss_row, normalize_text  # noqa: E402

WINSOR_Z = 3.0
ALPHA_MIN, ALPHA_CAP = 2.0, 90.0
DUEL_LABELS = ("Duelos Defensivos", "Duelos Vencidos")
GROUP_LABELS = ("Ações Defensivas e Recuperações", "Ações Defensivas")
RENAME_TO = "Ações Defensivas e Recuperações"


def _num(raw) -> float | None:
    if raw is None:
        return None
    text = str(raw).strip().replace("−", "-").replace(" ", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def _pct(raw) -> float | None:
    if raw is None:
        return None
    text = str(raw).strip().replace(",", ".").rstrip("%")
    try:
        return float(text) / 100.0
    except ValueError:
        return None


def _find(aspects: dict, *labels: str) -> dict | None:
    for items in (aspects or {}).values():
        for item in items:
            if item.get("label") in labels:
                return item
    return None


def _def_eff_item(aspects: dict) -> dict | None:
    for items in (aspects or {}).values():
        for item in items:
            if item.get("kind") == "def_efficiency_group" or item.get("label") == "Eficiência Defensiva":
                return item
    return None


def duel_rates(player: dict, recovery: float = 0.0) -> dict[str, float] | None:
    """Componentes defensivos vindos dos aspectos + disciplina + recuperação."""
    aspects = player.get("aspects") or {}
    item = _find(aspects, *DUEL_LABELS)
    if not item:
        return None
    dv = _num(item.get("display_value"))
    ev = _pct(item.get("efficiency_value"))
    if dv is None or ev is None:
        return None
    if item["label"] == "Duelos Vencidos":
        won, attempted = dv, (dv / ev if ev > 0 else dv)
    else:
        attempted, won = dv, dv * ev
    lost = max(0.0, attempted - won)
    fouls = _num((player.get("discipline") or {}).get("fouls_per90")) or 0.0
    actions = _find(aspects, *GROUP_LABELS)
    if actions and actions.get("sub_metrics"):
        subs = {s.get("label"): _num(s.get("display_value")) or 0.0 for s in actions["sub_metrics"]}
        inter, clear, blocks = (
            subs.get("Interceptações", 0.0),
            subs.get("Rebatidas", 0.0),
            subs.get("Chutes Bloqueados", 0.0),
        )
    else:
        # extremos: "Ações Defensivas" é métrica simples = inter + rebatidas
        total = _num(actions.get("display_value")) if actions else 0.0
        inter, clear, blocks = (total or 0.0) / 2.0, (total or 0.0) / 2.0, 0.0
    return {
        "won": won,
        "clean_lost": max(0.0, lost - fouls),
        "fouls": fouls,
        "inter": inter,
        "clear": clear,
        "blocks": blocks,
        "recovery": recovery,
    }


def _moments_alpha(rates: list[float], noventas: list[float]) -> tuple[float, float]:
    """Gamma–Poisson prior strength from method of moments (mirror of engine)."""
    n_sum = sum(noventas)
    if n_sum <= 0 or len(noventas) < 2:
        return 0.0, 0.0
    mu = sum(r * n for r, n in zip(rates, noventas)) / n_sum
    mean = sum(rates) / len(rates)
    var_obs = sum((r - mean) ** 2 for r in rates) / len(rates)
    sampling_var = sum(mu / n for n in noventas if n > 0) / len(noventas)
    var_true = var_obs - sampling_var
    if var_true <= 1e-8:
        return mu, ALPHA_CAP
    return mu, min(ALPHA_CAP, max(ALPHA_MIN, mu / var_true))


def _shrink(rate: float, n: float, mu: float, alpha: float) -> float:
    if n <= 0:
        return mu
    return (rate * n + alpha * mu) / (n + alpha)


def _z(values: list[float]) -> list[float]:
    if not values:
        return []
    mu = sum(values) / len(values)
    var = sum((v - mu) ** 2 for v in values) / len(values)
    sigma = math.sqrt(var)
    if sigma <= 1e-9:
        return [0.0] * len(values)
    return [(v - mu) / sigma for v in values]


def _dense_pct(values: list[float]) -> list[float]:
    """Dense-rank normalized percentile (mirror of _percentile_rank_raw)."""
    order = sorted(set(values))
    rank = {v: i + 1 for i, v in enumerate(order)}
    if len(order) <= 1:
        return [100.0] * len(values)
    return [(rank[v] - 1) / (len(order) - 1) * 100 for v in values]


def _grade(pct: float) -> str:
    for cut, letter in ((85, "A"), (75, "B+"), (65, "B"), (55, "B-"), (45, "C+"), (35, "C"), (25, "C-")):
        if pct >= cut:
            return letter
    return "D"


def _fmt_z(z: float) -> str:
    return f"{z:+.1f}".replace(".", ",")


def _fmt_n(v: float) -> str:
    return f"{v:.1f}".replace(".", ",")


# CSV defensivo SofaScore por (liga, temporada) — temporada corrente é 2026.
RECOVERY_SOURCES: dict[tuple[str, str], str] = {
    ("serie-a", "2026"): "BR26_defensive.csv",
    ("serie-b", "2026"): "BRB26_defensive.csv",
    ("serie-c", "2026"): "BRC26_defensive.csv",
    ("serie-d", "2026"): "BRD26_defensive.csv",
    ("mls-next-pro", "2026"): "MLS_NEXT_PRO_defensive.csv",
    ("serie-a", "2022"): "BRA22_defensive.csv",
    ("serie-a", "2023"): "BRA23_defensive.csv",
    ("serie-a", "2024"): "BRA24_defensive.csv",
    ("serie-a", "2025"): "BRA25_defensive.csv",
    ("serie-b", "2023"): "BRB23_defensive.csv",
    ("serie-b", "2024"): "BRB24_defensive.csv",
    ("serie-b", "2025"): "BRB25_defensive.csv",
    ("serie-c", "2025"): "BRC25_defensive.csv",
}


def build_recovery_ctx(league: str, season: str) -> dict:
    """Recuperações por identidade: CSV da liga/temporada × âncoras people.json.

    Retorna índice por player_id e fallback por (nome, clube) para linhas sem
    âncora — o CSV só tem clubes da própria liga, então o fuzzy é seguro.
    """
    csv_name = RECOVERY_SOURCES[(league, season)]
    ss = aggregate_sofascore(ROOT / csv_name)
    by_ssid = {str(r["player_id"]): float(r["ball_recovery_p90"]) for _, r in ss.iterrows()}
    by_token: dict[str, list[int]] = {}
    for idx, pname in enumerate(ss["player_name"]):
        for tok in set(normalize_text(pname).split()):
            by_token.setdefault(tok, []).append(idx)
    people = json.loads((DATA / "cross-season" / "people.json").read_text(encoding="utf-8"))
    anchor_key = f"{league}/{season}"
    by_pid: dict[str, float] = {}
    by_key: dict[tuple[str, str], float] = {}
    for person in people.values():
        ss_id = (person.get("sofascore") or {}).get(anchor_key)
        value = by_ssid.get(str(ss_id)) if ss_id is not None else None
        if value is None:
            continue
        for row in person.get("rows") or []:
            if row.get("league") == league and str(row.get("season")) == season:
                pid = row.get("player_id")
                if pid:
                    by_pid[pid] = value
                key = (normalize_text(person.get("name") or ""), normalize_text(row.get("club") or ""))
                by_key[key] = value
    return {"by_pid": by_pid, "by_key": by_key, "ss": ss, "by_token": by_token, "_cache": {}}


def _recovery_for(player: dict, ctx: dict) -> float | None:
    pid = _pid(player)
    if pid in ctx["by_pid"]:
        return ctx["by_pid"][pid]
    name, club = player.get("name") or "", player.get("club") or ""
    key = (normalize_text(name), normalize_text(club))
    if key in ctx["by_key"]:
        return ctx["by_key"][key]
    # fallback fuzzy — seguro porque o CSV é da mesma liga/temporada do arquivo
    # (todos os clubes do site são candidatos legítimos ao match)
    if key in ctx["_cache"]:
        return ctx["_cache"][key]
    idxs = sorted({i for tok in key[0].split() for i in ctx["by_token"].get(tok, ())})
    hit = match_ss_row(pd.Series({"Jogador": name, "Equipe": club}), ctx["ss"].iloc[idxs]) if idxs else None
    if hit is not None and club_match_score(club, str(hit.get("primary_team") or "")) < 50:
        hit = None
    value = float(hit["ball_recovery_p90"]) if hit is not None else None
    ctx["_cache"][key] = value
    return value


def _pid(player: dict) -> str:
    return player.get("player_id") or player.get("id") or ""


def _apply_group_patches(
    player: dict, family: str, recovery: float | None, recovery_pct: float | None
) -> None:
    """Renomeia/adiciona Recuperações conforme a família (recovery=None: sem fonte p/ o atleta)."""
    aspects = player.get("aspects") or {}
    if family in ("zagueiros", "laterais", "meio-campistas"):
        group = _find(aspects, *GROUP_LABELS)
        if group is None:
            return
        group["label"] = RENAME_TO
        subs = [s for s in (group.get("sub_metrics") or []) if s.get("label") != "Recuperações"]
        if recovery is not None:
            subs.append(
                {
                    "label": "Recuperações",
                    "percentile": round(recovery_pct or 0, 1),
                    "display_value": _fmt_n(recovery),
                }
            )
        group["sub_metrics"] = subs
        pcts = [s.get("percentile") for s in subs if s.get("percentile") is not None]
        if pcts:
            group["percentile"] = round(sum(pcts) / len(pcts), 1)
            group["grade"] = _grade(group["percentile"])
    elif family == "extremos":
        items = [i for i in (aspects.get("defensivos") or []) if i.get("label") != "Recuperações"]
        if recovery is not None:
            items.append(
                {
                    "label": "Recuperações",
                    "kind": "metric",
                    "grade": _grade(recovery_pct or 0),
                    "percentile": round(recovery_pct or 0, 1),
                    "display_value": _fmt_n(recovery),
                    "stats": [],
                }
            )
        aspects["defensivos"] = items


def _strip_group_patches(player: dict, family: str) -> bool:
    """Remove Recuperações/renomeação onde não há fonte (liga fora do CSV)."""
    aspects = player.get("aspects") or {}
    if family == "extremos":
        items = aspects.get("defensivos") or []
        kept = [i for i in items if i.get("label") != "Recuperações"]
        if len(kept) != len(items):
            aspects["defensivos"] = kept
            return True
        return False
    group = _find(aspects, *GROUP_LABELS)
    if group is None:
        return False
    subs = group.get("sub_metrics") or []
    kept = [s for s in subs if s.get("label") != "Recuperações"]
    changed = len(kept) != len(subs)
    if group.get("label") == RENAME_TO:
        group["label"] = "Ações Defensivas"
        changed = True
    if not changed:
        return False
    group["sub_metrics"] = kept
    pcts = [s.get("percentile") for s in kept if s.get("percentile") is not None]
    if pcts:
        group["percentile"] = round(sum(pcts) / len(pcts), 1)
        group["grade"] = _grade(group["percentile"])
    return True


def _apply_eff_patches(
    item: dict, *, pct: float, z: float, acoes: float | None, acoes_pct: float
) -> None:
    grade = _grade(pct)
    item["percentile"] = pct
    item["grade"] = grade
    subs = item.get("sub_metrics") or []
    err_sub = next((s for s in subs if s.get("label") == "Erros Totais"), None)
    err_pct = float(err_sub.get("percentile") or 0) if err_sub else 0.0
    # com recuperação: [erros, ações sem bola, índice]; sem fonte: [erros, índice]
    badge = [round(err_pct, 1)]
    if acoes is not None:
        badge.append(round(acoes_pct, 1))
    badge.append(round(pct, 1))
    item["pair_badge"] = badge
    new_subs = [s for s in subs if s.get("label") in ("Erros Totais",)]
    if acoes is not None:
        new_subs.append(
            {
                "label": "Ações sem Bola/90",
                "percentile": round(acoes_pct, 1),
                "display_value": _fmt_n(acoes),
            }
        )
    new_subs.append(
        {
            "label": "Índice de Eficiência",
            "percentile": round(pct, 1),
            "display_value": _fmt_z(z),
        }
    )
    item["sub_metrics"] = new_subs


def process_family_file(path: Path, recovery_ctx: dict | None) -> dict[str, dict]:
    """Recompute the pool, patch the file, return player_id -> patch payload."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    players = payload.get("players") if isinstance(payload, dict) else payload
    if not isinstance(players, list) or not players:
        return {}
    family = path.stem.replace("family-", "")

    # ctx None = liga/temporada sem CSV (estaduais, arquivos sem fonte);
    # atleta sem match na fonte recebe recovery=None (sub omitida, não 0,0)
    covered = recovery_ctx is not None
    recoveries: list[float | None] = (
        [_recovery_for(p, recovery_ctx) for p in players] if covered else [None] * len(players)
    )
    matched = [r for r in recoveries if r is not None]
    matched_pcts = _dense_pct(matched) if matched else []
    recovery_pcts: list[float | None] = []
    it = iter(matched_pcts)
    for r in recoveries:
        recovery_pcts.append(next(it) if r is not None else None)

    rows = [(i, p) for i, p in enumerate(players) if _def_eff_item(p.get("aspects") or {}) and duel_rates(p)]
    comps = [duel_rates(p, recovery=recoveries[i] or 0.0) for i, p in rows]
    noventas = [max(0.0, (p.get("minutes") or 0) / 90.0) for _, p in rows]

    def block_z(keys: list[str]) -> list[float]:
        cols = []
        for key in keys:
            rates = [c[key] for c in comps]
            mu, alpha = _moments_alpha(rates, noventas)
            adj = [_shrink(r, n, mu, alpha) for r, n in zip(rates, noventas)]
            cols.append([min(WINSOR_Z, max(-WINSOR_Z, z)) for z in _z(adj)])
        mean = [sum(col[i] for col in cols) / len(cols) for i in range(len(rows))]
        return _z(mean)

    z_bal: list[float] = []
    pcts: list[float] = []
    acoes_vals: list[float] = []
    acoes_pcts: list[float] = []
    if rows:
        action_z = block_z(["won", "inter", "clear", "blocks"])
        cost_z = block_z(["fouls", "clean_lost"])
        raw = [a - c for a, c in zip(action_z, cost_z)]
        z_bal = _z(raw)
        pcts = _dense_pct(z_bal)
        acoes_vals = [c["won"] + c["inter"] + c["clear"] + c["blocks"] + c.get("recovery", 0.0) for c in comps]
        acoes_pcts = _dense_pct(acoes_vals)

    out: dict[str, dict] = {}
    # payload por jogador cobre recuperação para todos + eficiência quando há grupo
    for i, player in enumerate(players):
        pid = _pid(player)
        if not pid:
            continue
        out[pid] = {"recovery": recoveries[i], "recovery_pct": recovery_pcts[i]}
    for (i, player), z, pct, acoes, acoes_pct in zip(rows, z_bal, pcts, acoes_vals, acoes_pcts):
        pct = round(pct, 1)
        item = _def_eff_item(player.get("aspects") or {})
        _apply_eff_patches(
            item,
            pct=pct,
            z=z,
            acoes=acoes if covered else None,
            acoes_pct=acoes_pct,
        )
        out[_pid(player)].update({"pct": pct, "z": z, "acoes": acoes, "acoes_pct": acoes_pct})

    # recuperações nos aspectos de todos os jogadores do arquivo;
    # liga sem fonte: limpa subs/renomeação deixados por runs anteriores
    for i, player in enumerate(players):
        if covered:
            _apply_group_patches(player, family, recoveries[i], recovery_pcts[i])
        else:
            _strip_group_patches(player, family)

    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return out


def patch_profiles(profiles_dir: Path, values: dict[str, dict], family: str, covered: bool) -> int:
    patched = 0
    if not profiles_dir.is_dir():
        return 0
    for path in profiles_dir.glob("*.json"):
        profile = json.loads(path.read_text(encoding="utf-8"))
        pid = profile.get("player_id") or path.stem
        item = _def_eff_item(profile.get("aspects") or {})
        if pid in values:
            v = values[pid]
            changed = False
            if item and "pct" in v:
                _apply_eff_patches(
                    item,
                    pct=v["pct"],
                    z=v["z"],
                    acoes=v["acoes"] if covered else None,
                    acoes_pct=v["acoes_pct"],
                )
                changed = True
            if covered:
                _apply_group_patches(profile, family, v["recovery"], v["recovery_pct"])
                changed = True
            elif _strip_group_patches(profile, family):
                changed = True
            if changed:
                path.write_text(json.dumps(profile, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
                patched += 1
    return patched


def _league_season_of(path: Path) -> tuple[str, str]:
    """data/{liga}/family-*.json → (liga, "2026"); .../seasons/{ano}/ → (liga, ano)."""
    rel = path.relative_to(DATA)
    league = rel.parts[0]
    season = rel.parts[2] if len(rel.parts) > 3 and rel.parts[1] == "seasons" else "2026"
    return league, season


def main() -> None:
    ctxs: dict[tuple[str, str], dict] = {}
    family_files = sorted(DATA.glob("*/family-*.json")) + sorted(DATA.glob("*/seasons/*/family-*.json"))
    patched_players = 0
    for path in family_files:
        family = path.stem.replace("family-", "")
        league, season = _league_season_of(path)
        key = (league, season)
        if key not in ctxs and key in RECOVERY_SOURCES and (ROOT / RECOVERY_SOURCES[key]).exists():
            ctxs[key] = build_recovery_ctx(league, season)
            print(f"[{league}/{season}] {RECOVERY_SOURCES[key]}: {len(ctxs[key]['by_pid'])} âncoras ss_id")
        recovery_ctx = ctxs.get(key)
        values = process_family_file(path, recovery_ctx)
        profiles_dir = path.parent / "profiles"
        patched_players += patch_profiles(profiles_dir, values, family, recovery_ctx is not None)
        print(f"{path.relative_to(DATA)}: {len(values)} linhas")
    print(f"Perfis atualizados: {patched_players}")


if __name__ == "__main__":
    main()
