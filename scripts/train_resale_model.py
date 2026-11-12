"""Modelo de potencial de revenda (V5-substituto).

Como fees reais de transferencia nao sao acessiveis (TM /transfers e
SofaScore API bloqueados), o alvo e o resultado observado nos nossos dados:
atleta de A/B/C 2022-2024 que, na temporada seguinte, apareceu em divisao
superior (clube diferente) ou saiu para o exterior — o mesmo evento
"salto" do estudo.

Regressao logistica (numpy, gradiente): P(salto) ~ idade + rating +
ln(min) + liga + familia + perfil-destaque.

Saida: data/cross-season/resale-model.json — lido por
lib/valores.server.ts para o score de revenda.
"""

import json
import math
import os
import re
import unicodedata
from collections import defaultdict

import numpy as np

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


def norm(s):
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


BR = {norm(c) for c in json.load(open(os.path.join(DATA, "cross-season", "br-clubs.json"), encoding="utf-8"))}
PEOPLE = json.load(open(os.path.join(DATA, "cross-season", "people.json"), encoding="utf-8"))


def is_br(club):
    if not club:
        return True
    n = re.sub(r"[^a-z0-9]+", "", norm(club))
    if n in BR:
        return True
    return any(len(n) >= 6 and k.startswith(n) or len(k) >= 6 and n.startswith(k) for k in BR)


FAMS = ["zagueiros", "laterais", "meio-campistas", "extremos", "atacantes"]

# perfis com taxa de salto acima da media da familia (estudo)
UPSIDERS = {
    ("zagueiros", "Combativo"), ("zagueiros", "Construtor"),
    ("laterais", "Construtor"), ("laterais", "Híbrido"),
    ("meio-campistas", "Híbrido"), ("meio-campistas", "Contenção"),
    ("extremos", "Híbrido"), ("extremos", "Driblador"),
    ("atacantes", "Móvel"), ("atacantes", "Finalizador"),
}

FEAT_NAMES = ["intercepto", "idade-26", "sub25", "mais28", "rating", "ln_min",
              "serie-b", "serie-c", "laterais", "meio-campistas", "extremos",
              "atacantes", "perfil_upside"]


def features(row, league):
    age = row["season_year"] - row["birth_year"] if row.get("birth_year") else None
    fam = row.get("position_family") or ""
    prof = row.get("profile") or ""
    rd = max(-0.8, min(1.8, (row.get("rating") or 6.7) - 6.7))
    return [
        1.0,
        (age if age is not None else 26) - 26,
        max(0, 25 - (age if age is not None else 26)),
        max(0, (age if age is not None else 26) - 28),
        rd,
        math.log(max(row.get("minutes") or 0, 300)),
        league == "serie-b",
        league == "serie-c",
        fam == "laterais", fam == "meio-campistas", fam == "extremos", fam == "atacantes",
        (fam, prof) in UPSIDERS,
    ]


def main():
    # trajetoria: person_key -> {season: (league, club)}
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

    X, y = [], []
    for pk, seasons in traj.items():
        for s in ["2022", "2023", "2024"]:
            nxt = str(int(s) + 1)
            if s not in seasons:
                continue
            league, club = seasons[s]
            lvl = LEAGUES[league]
            row = dict(rowinfo.get((pk, s)) or {})
            if not row or (row.get("minutes") or 0) < 400 or (row.get("rating") or 0) < 6.3:
                continue
            if (row.get("position_family") or "") not in FAMS:
                continue
            row["season_year"] = int(s)
            jumped = False
            if nxt in seasons:
                nl, nc = seasons[nxt]
                if LEAGUES[nl] > lvl and norm(nc or "") != norm(club or ""):
                    jumped = True
            else:
                tmc = (PEOPLE.get(pk) or {}).get("tm_club")
                if tmc and not is_br(tmc):
                    jumped = True
            X.append(features(row, league))
            y.append(1.0 if jumped else 0.0)

    X = np.array(X, float)
    y = np.array(y)
    print(f"amostra: {len(y)}  positivos: {int(y.sum())} ({y.mean():.1%})")

    w = np.zeros(X.shape[1])
    lr, lam = 0.05, 0.02
    for _ in range(4000):
        p = 1 / (1 + np.exp(-X @ w))
        grad = X.T @ (p - y) / len(y) + lam * w
        grad[0] = X[:, 0] @ (p - y) / len(y)
        w -= lr * grad
    p = 1 / (1 + np.exp(-X @ w))
    ll = -(y * np.log(p + 1e-9) + (1 - y) * np.log(1 - p + 1e-9)).mean()
    order = np.argsort(p)
    ranks = np.empty(len(order))
    ranks[order] = np.arange(1, len(y) + 1)
    n_pos = y.sum()
    n_neg = len(y) - n_pos
    auc = (ranks[y == 1].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)
    print(f"logloss {ll:.4f}  AUC {auc:.3f}")

    coef = dict(zip(FEAT_NAMES, [round(float(v), 4) for v in w]))
    for n, v in coef.items():
        print(f"  {n:18} {v:+.4f}")

    out = {
        "version": "v5-resale-1",
        "trained_on": "A/B/C 2022-2024 -> salto divisao/exterior no ano seguinte",
        "n": int(len(y)),
        "positives": int(y.sum()),
        "base_rate": round(float(y.mean()), 4),
        "auc": round(float(auc), 3),
        "minutes_floor": 400,
        "coef": coef,
        "upsider_profiles": [f"{f}/{p}" for f, p in sorted(UPSIDERS)],
    }
    dest = os.path.join(DATA, "cross-season", "resale-model.json")
    json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\ngravado: {dest}")


if __name__ == "__main__":
    main()
