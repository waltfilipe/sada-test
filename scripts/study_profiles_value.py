"""Estudo: o que o mercado paga por perfil de jogo e quem tem valor de revenda.

1) Regressao log-linear ln(TM) ~ liga + rating + rating^2 + idade + ln(min)
   + dummies de perfil por familia -> coeficiente de cada perfil.
2) Evento "salto" (subiu de divisao ou foi p/ exterior no ano seguinte):
   taxa por familia/perfil/faixa etaria -> perfil de revendavel.

Rode: python -X utf8 scripts/study_profiles_value.py
"""

import glob
import json
import math
import os
import re
import unicodedata
from collections import defaultdict

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
LEAGUES = {"serie-a": 3, "serie-b": 2, "serie-c": 1}
SEASONS = ["2022", "2023", "2024", "2025"]


def load_rows(league, season):
    path = os.path.join(DATA, league, "seasons", season, "players.json")
    if not os.path.exists(path):
        return []
    try:
        return json.load(open(path, encoding="utf-8"))["players"]
    except Exception:
        return []


def load_current(league):
    path = os.path.join(DATA, league, "players.json")
    if not os.path.exists(path):
        return []
    try:
        return json.load(open(path, encoding="utf-8"))["players"]
    except Exception:
        return []


def norm(s):
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


BR = set()
try:
    BR = {norm(c) for c in json.load(open(os.path.join(DATA, "cross-season", "br-clubs.json"), encoding="utf-8"))}
except Exception:
    pass

PEOPLE = json.load(open(os.path.join(DATA, "cross-season", "people.json"), encoding="utf-8"))


def is_br(club):
    if not club:
        return True
    n = re.sub(r"[^a-z0-9]+", "", norm(club))
    if n in BR:
        return True
    return any(len(n) >= 6 and k.startswith(n) or len(k) >= 6 and n.startswith(k) for k in BR)


# ---------- 1) amostra p/ regressao de valor ----------
sample = []
for league in LEAGUES:
    for p in load_current(league):
        tm = p.get("transfermarkt") or {}
        mv = tm.get("market_value_eur")
        if not mv or mv <= 0:
            continue
        if (p.get("minutes") or 0) < 400:
            continue
        fam = p.get("position_family") or ""
        prof = p.get("profile") or ""
        if not fam or not prof:
            continue
        age = 2026 - p["birth_year"] if p.get("birth_year") else None
        sample.append({
            "league": league,
            "fam": fam,
            "prof": prof,
            "rating": p.get("rating") or 6.7,
            "minutes": p["minutes"],
            "age": age,
            "lnv": math.log(mv),
            "name": p.get("name"),
        })

print(f"amostra: {len(sample)} atletas com valor TM + >=400 min")

# Regressao OLS por familia: ln(TM) ~ liga + rating + rating^2 + idade + ln(min) + dummies perfil
import numpy as np

def regress(fam, rows):
    profiles = sorted({r["prof"] for r in rows})
    # perfil base = o mais frequente
    from collections import Counter
    base_prof = Counter(r["prof"] for r in rows).most_common(1)[0][0]
    feats = profiles[1:] if profiles[0] == base_prof else [p for p in profiles if p != base_prof]
    X, y = [], []
    for r in rows:
        rd = r["rating"] - 6.7
        row = [
            1.0,
            1.0 if r["league"] == "serie-b" else 0.0,
            1.0 if r["league"] == "serie-c" else 0.0,
            rd, rd * rd,
            (r["age"] - 26) if r["age"] else 0.0,
            math.log(max(r["minutes"], 300)),
        ]
        row += [1.0 if r["prof"] == f else 0.0 for f in feats]
        X.append(row)
        y.append(r["lnv"])
    X, y = np.array(X), np.array(y)
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    r2 = 1 - (resid @ resid) / ((y - y.mean()) @ (y - y.mean()))
    return base_prof, feats, beta[7:], r2, len(rows)

print("\n=== PREMIO POR PERFIL (coef. vs perfil-base, controlando liga/rating/idade/min) ===")
for fam in ["zagueiros", "laterais", "meio-campistas", "extremos", "atacantes"]:
    rows = [r for r in sample if r["fam"] == fam]
    if len(rows) < 40:
        continue
    base_prof, feats, betas, r2, n = regress(fam, rows)
    counts = {p: sum(1 for r in rows if r["prof"] == p) for p in feats + [base_prof]}
    med = {p: sorted(r["lnv"] for r in rows if r["prof"] == p) for p in feats + [base_prof]}
    print(f"\n{fam} (n={n}, R2={r2:.2f}) — base: {base_prof} (n={counts[base_prof]})")
    for f, b in sorted(zip(feats, betas), key=lambda t: -t[1]):
        medv = math.exp(med[f][len(med[f]) // 2]) / 1e6
        medb = math.exp(med[base_prof][len(med[base_prof]) // 2]) / 1e6
        flag = " ***" if abs(b) > 0.25 else ""
        print(f"  {f:22} n={counts[f]:3}  coef={b:+.3f} (x{math.exp(b):.2f})  mediana={medv:.2f}M vs {medb:.2f}M{flag}")

# ---------- 2) evento salto/revenda ----------
# mapa: person_key -> {season: (league, club)}
traj = defaultdict(dict)
rowinfo = {}
for league in LEAGUES:
    for season in SEASONS:
        for p in load_rows(league, season):
            pk = p.get("person_key") or p.get("athlete_id") or p.get("player_id")
            if not pk:
                continue
            traj[pk][season] = (league, p.get("club"))
            rowinfo[(pk, season)] = p

eventos = []
for pk, seasons in traj.items():
    for s in ["2022", "2023", "2024"]:
        nxt = str(int(s) + 1)
        if s not in seasons:
            continue
        league, club = seasons[s]
        lvl = LEAGUES[league]
        row = rowinfo.get((pk, s))
        if not row or (row.get("minutes") or 0) < 400:
            continue
        fam = row.get("position_family") or ""
        prof = row.get("profile") or ""
        if not fam or not prof:
            continue
        dest = None
        if nxt in seasons:
            nl, nc = seasons[nxt]
            if LEAGUES[nl] > lvl and norm(nc) != norm(club):
                dest = f"subiu:{nl}"
        if dest is None and nxt not in seasons:
            tmc = (PEOPLE.get(pk) or {}).get("tm_club")
            if tmc and not is_br(tmc):
                dest = "exterior"
        if dest is None:
            continue
        age = int(s) - row["birth_year"] if row.get("birth_year") else None
        eventos.append({
            "fam": fam, "prof": prof, "rating": row.get("rating") or 0,
            "age": age, "dest": dest, "season": s, "league": league,
            "name": row.get("name"), "club": club,
        })

# base de atletas (mesmos filtros) p/ taxa
base_total = defaultdict(int)
for league in LEAGUES:
    for season in ["2022", "2023", "2024"]:
        for p in load_rows(league, season):
            if (p.get("minutes") or 0) < 400:
                continue
            if not (p.get("position_family") and p.get("profile")):
                continue
            base_total[(p["position_family"], p["profile"])] += 1

ev_count = defaultdict(int)
ev_ext = defaultdict(int)
for e in eventos:
    ev_count[(e["fam"], e["prof"])] += 1
    if e["dest"] == "exterior":
        ev_ext[(e["fam"], e["prof"])] += 1

print("\n=== TAXA DE SALTO POR PERFIL (temporada -> divisao acima ou exterior) ===")
print(f"eventos: {len(eventos)} | exterior: {sum(1 for e in eventos if e['dest']=='exterior')}")
for fam in ["zagueiros", "laterais", "meio-campistas", "extremos", "atacantes"]:
    rows = [(k, ev_count[k], ev_ext[k]) for k in ev_count if k[0] == fam]
    if not rows:
        continue
    print(f"\n{fam}")
    for (f, p), c, cx in sorted(rows, key=lambda t: -t[1] / max(base_total[t[0]], 1)):
        b = base_total[(f, p)]
        if b < 30:
            continue
        print(f"  {p:22} base={b:3} saltos={c:2} ({c/b*100:4.1f}%) exterior={cx:2} ({cx/b*100:4.1f}%)")

print("\n=== PERFIL DO SALTO: rating e idade dos que foram p/ exterior ===")
ext = [e for e in eventos if e["dest"] == "exterior"]
sub = [e for e in eventos if e["dest"].startswith("subiu")]
for label, grp in [("exterior", ext), ("subiu divisao", sub)]:
    if not grp:
        continue
    ages = sorted(e["age"] for e in grp if e["age"])
    rats = sorted(e["rating"] for e in grp)
    print(f"{label}: n={len(grp)} idade med={ages[len(ages)//2] if ages else '?'} "
          f"rating med={rats[len(rats)//2]:.2f} "
          f"| <=23a: {sum(1 for e in grp if e['age'] and e['age']<=23)/len(grp)*100:.0f}%")

print("\n=== TOP saltos p/ exterior (rating mais alto) ===")
for e in sorted(ext, key=lambda x: -x["rating"])[:15]:
    print(f"  {e['name']:22} {e['club']:18} {e['league']} {e['season']} {e['prof']:18} r={e['rating']:.2f} {e['age']}a")
