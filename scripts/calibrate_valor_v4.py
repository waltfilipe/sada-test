"""Calibracao unificada do Valor SADA v4 (espelho-TM).

OLS de ln(TM) sobre TODOS os fatores juntos — coeficientes consistentes
entre si, prontos para copiar em lib/valores.ts:

ln(V) = base + liga + rating(d quad) + idade(faixas) + ln(min) + posicao
        + perfil(por familia) + contrato + carreira(A) + reputacao
        + clube(G12 vitrine) + perfil

Saida: R2, tabela de coeficientes e dict pronto p/ TypeScript.
"""

import glob
import json
import math
import os
import re
import unicodedata
from collections import Counter

import numpy as np

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
REF_MS = 1767225600000.0 / 1000  # ~2026-01-01 UTC em segundos


def norm(s: str) -> str:
    return re.sub(
        r"[^a-z0-9]+", "",
        unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode(),
    )


G12 = {
    "flamengo", "palmeiras", "corinthians", "saopaulo", "santos", "gremio",
    "internacional", "atleticomg", "fluminense", "botafogofr", "vasco", "cruzeiro",
}

geo = json.load(open(os.path.join(DATA, "..", "..", "SADA-Elencos", "data", "cross-season", "geo-lists.json"), encoding="utf-8"))
EU = {norm(c) for c in geo["eu"]}
FO = {norm(c) for c in geo["foreign"]}
BR = {norm(c) for c in json.load(open(os.path.join(DATA, "cross-season", "br-clubs.json"), encoding="utf-8"))}
PEOPLE = json.load(open(os.path.join(DATA, "cross-season", "people.json"), encoding="utf-8"))
TMCACHE = json.load(open(os.path.join(DATA, "cross-season", "tm-profile-cache.json"), encoding="utf-8"))


def region(club):
    n = norm(club or "")
    if not n:
        return "brasil"
    if n in FO:
        return "exterior"
    if n in EU or any(len(n) >= 6 and k.startswith(n) or len(k) >= 6 and n.startswith(k) for k in EU):
        return "europa"
    if n in BR or any(len(n) >= 6 and k.startswith(n) or len(k) >= 6 and n.startswith(k) for k in BR):
        return "brasil"
    return "exterior"


def contract_years(raw):
    if not raw:
        return None
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw) or re.match(r"(\d{2})/(\d{2})/(\d{4})", raw)
    if not m:
        return None
    if "-" in m.group(0) and len(m.group(1)) == 4:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    import datetime
    dt = datetime.datetime(y, mo, d).timestamp()
    return max(0.0, (dt - REF_MS) / (365.25 * 86400))


def played_a(pk):
    return any(r.get("league") == "serie-a" and r.get("season") != "2026"
               for r in (PEOPLE.get(pk) or {}).get("rows", []))


FAMS = ["zagueiros", "laterais", "meio-campistas", "extremos", "atacantes"]
AGE_BANDS = ["<21", "21-22", "23-25", "29+"]  # base = 26-28

sample = []
for league in ["serie-a", "serie-b", "serie-c"]:
    for p in json.load(open(os.path.join(DATA, league, "players.json"), encoding="utf-8"))["players"]:
        tm = p.get("transfermarkt") or {}
        mv = tm.get("market_value_eur")
        fam, prof = p.get("position_family") or "", p.get("profile") or ""
        if not mv or mv <= 0 or (p.get("minutes") or 0) < 400 or fam not in FAMS or not prof:
            continue
        tm_id = str(tm.get("id") or "")
        profile = TMCACHE.get(tm_id) or {}
        move = profile.get("move") or {}
        frm = move.get("from_club")
        sample.append({
            "league": league, "fam": fam, "prof": prof,
            "rd": max(-0.8, min(1.8, (p.get("rating") or 6.7) - 6.7)),
            "minutes": p["minutes"],
            "age": 2026 - p["birth_year"] if p.get("birth_year") else None,
            "cy": contract_years(tm.get("contract_until")),
            "caps": profile.get("caps") or 0,
            "abroad": region(frm) if frm else None,
            "playedA": league != "serie-a" and played_a(p.get("person_key")),
            "g12": norm(p.get("club") or "") in G12,
            "lnv": math.log(mv),
        })

print(f"amostra: {len(sample)}")

# perfis: dummy por (fam,prof) menos o mais frequente da familia
prof_list = []
base_prof = {}
for fam in FAMS:
    counts = Counter(r["prof"] for r in sample if r["fam"] == fam)
    base_prof[fam] = counts.most_common(1)[0][0]
    prof_list += [(fam, prof) for prof in counts if prof != base_prof[fam]]

names = (
    ["intercepto", "serie-b", "serie-c", "rd", "rd^2", "ln_min"]
    + [f"idade:{b}" for b in AGE_BANDS]
    + [f"fam:{f}" for f in FAMS[1:]]
    + [f"prof:{f}/{p}" for f, p in prof_list]
    + ["contrato:1-2", "contrato:2-3.5", "contrato:>3.5", "contrato:sem_reg",
       "jogouA", "caps", "exterior:eu", "exterior:outro", "clube_g12"]
)

X, y = [], []
for r in sample:
    a = r["age"]
    band = ("<21" if a < 21 else "21-22" if a < 23 else "23-25" if a < 26 else "29+" if a >= 29 else None) if a else None
    cy = r["cy"]
    row = [
        1.0, r["league"] == "serie-b", r["league"] == "serie-c",
        r["rd"], r["rd"] ** 2, math.log(max(r["minutes"], 300)),
    ]
    row += [band == b for b in AGE_BANDS]
    row += [r["fam"] == f for f in FAMS[1:]]
    row += [(r["fam"], r["prof"]) == key for key in prof_list]
    row += [
        cy is not None and 1 <= cy < 2,
        cy is not None and 2 <= cy < 3.5,
        cy is not None and cy >= 3.5,
        cy is None,
        r["playedA"],
        math.log1p(r["caps"]),
        r["abroad"] == "europa",
        r["abroad"] == "exterior",
        r["g12"],
    ]
    X.append(row)
    y.append(r["lnv"])

X = np.array(X, float)
y = np.array(y)
beta, *_ = np.linalg.lstsq(X, y, rcond=None)
res = y - X @ beta
r2 = 1 - (res @ res) / ((y - y.mean()) @ (y - y.mean()))
print(f"\nR2 = {r2:.4f}  (v3: 0.694)")

# erro tipico
import statistics
ratio = [math.exp(v) for v in res]
print(f"erro tipico x{statistics.median(ratio):.2f} (mediana da razao |pred/real|)")

print("\n=== COEFICIENTES ===")
for n, b in zip(names, beta):
    print(f"{n:28} {b:+.4f}")
