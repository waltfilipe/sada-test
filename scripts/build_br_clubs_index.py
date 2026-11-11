"""Gera data/cross-season/br-clubs.json — indice de clubes brasileiros.

Coleta os clubes de todas as linhas players.json de todas as ligas/temporadas
e exclui nomes estrangeiros (Copinha/est-nv4 convida clubes de fora,
amistosos e Mundial de Clubes entram em temporadas nacionais, e a liga
mls-next-pro e toda estrangeira). O SADA-Elencos usa este indice para
classificar destinos de salto (exterior vs. Brasil) sem depender das
ligas que o app carrega localmente.

Rode apos rebuilds de dados que adicionem ligas/clubes novos.
"""

import glob
import json
import os
import re
import unicodedata

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Ligas totalmente estrangeiras — nenhum clube delas entra no indice.
EXCLUDED_LEAGUES = {"mls-next-pro"}

# Substrings (sobre o nome normalizado) que marcam clube estrangeiro.
# Cuidado: nao usar termos curtos que colidam com clubes BR legitimos
# (ex.: "inter" pegaria Internacional; "river" pegaria River-PI;
# "america" pegaria America-MG; "porto" pegaria Porto Velho/BA/Vitoria).
FOREIGN_HINTS = [
    "tigre", "monterrey", "miami", "galaxy", "lafc", "toronto", "vancouver",
    "montreal", "cincinnati", "columbus", "orlando", "nashville",
    "atlanta united", "charlotte", "nycfc", "dallas", "austin", "houston",
    "seattle", "portland", "minnesota", "colorado rapids", "salt lake",
    "san jose", "kansas", "chicago fire", "new england", "philadelphia union",
    "st louis", "san diego", "detroit city", "huntsville", "loudoun",
    "nomme united", "muras united", "uncg", "wake forest", "redhawks",
    "hearts of pine", "drogheda", "dc united",
    "kashima", "nagasaki", "daegu", "gimpo", "gimhae", "yokohama", "suwon",
    "johor", "pathum", "buriram", "rayong", "sisaket", "rasi salai",
    "tochigi", "jef united", "ho chi minh", "shenzhen", "henan",
    "guangdong", "shandong", "kawasaki", "urawa", "vissel", "sanfrecce",
    "gamba osaka", "cerezo", "fc tokyo", "ulsan", "jeonbuk", "pohang",
    "fc seoul", "melbourne", "bc rangers", "cong an", "jeju", "anyang",
    "seongnam", "liaoning", "chongqing", "yunnan", "kanchanaburi", "seoul",
    "al ahli", "al fayha", "al hilal", "al nassr", "al ittihad", "al shabab",
    "al ettifaq", "al taawoun", "al ahly", "shabab al", "kalba",
    "maccabi", "hapoel", "esperance", "mamelodi", "wydad",
    "boca juniors", "river plate", "racing club", "rosario", "estudiantes",
    "talleres", "belgrano", "newells", "old boys", "banfield", "huracan",
    "gimnasia", "lanus", "velez", "san lorenzo", "argentinos", "platense",
    "defensa y justicia", "instituto", "barracas", "riestra", "sarmiento",
    "union santa fe", "central cordoba", "atletico tucuman", "godoy cruz",
    "independiente", "arsenal sarandi", "cerro", "olimpia", "libertad",
    "sport boys", "universitario", "alianza lima", "sporting cristal",
    "bolivar", "strongest", "colo colo", "catolica", "universidad",
    "deportivo cali", "deportivo pasto", "deportivo tachira",
    "millonarios", "america de cali", "junior barranquilla",
    "atletico nacional", "barcelona sc", "emelec", "ldu", "caracas",
    "rayo zuliano", "alajuelense", "penarol", "defensor sporting",
    "nacional montevideo", "nacional asuncion", "pumas", "cruz azul",
    "chivas", "guadalajara", "pachuca", "necaxa", "queretaro", "tijuana",
    "juarez fc", "mazatlan", "puebla", "santos laguna", "san luis",
    "toluca", "leon", "atlas",
    # Europa (grafias vistas nos dados)
    "benfica", "porto foot", "borussia", "dortmund", "bournemouth",
    "cercle brugge", "krasnodar", "ludogorets", "lugano", "partizan",
    "septemvri", "sheriff", "riga fc", "zenit", "hamrun", "modena",
    "widzew", "crystal palace", "manchester city", "real betis",
    "coimbra sports", "dynamo kyiv", "aljustrelense",
    # Juventus so aparece nos dados como convidada italiana ou ambigua
    # (Juventus-SP de Mooca nao e destino TM) — seguro excluir.
    "juventus u20",
]

LEGAL_TOKENS = {
    "fc", "ec", "sc", "ac", "fr", "saf", "cf", "cr", "clube", "cl", "ca",
    "aa", "esporte", "sport", "futebol", "futbol", "regatas", "associacao",
    "atletico", "club", "do", "da", "de", "di", "dos", "das", "e", "se",
    "ser", "ge", "ce", "cd", "cn", "sv", "ss", "rb", "ad", "ao", "fec",
    "fbpa", "afc", "u15", "u16", "u17", "u18", "u19", "u20", "u21", "u23",
    "sub20", "sub-20", "ii", "iii", "b", "sa", "oficial", "ecfc", "fbc",
}


def norm_club(name: str) -> str:
    tokens = re.sub(
        r"[^a-z0-9]+",
        " ",
        unicodedata.normalize("NFD", name.lower())
        .encode("ascii", "ignore")
        .decode(),
    ).split()
    while len(tokens) > 1 and tokens[0] in LEGAL_TOKENS:
        tokens.pop(0)
    while len(tokens) > 1 and tokens[-1] in LEGAL_TOKENS:
        tokens.pop()
    return "".join(tokens)


def joined_name(name: str) -> str:
    """Normalizacao sem stripping — preserva 'Atletico Nacional' vs 'Nacional'."""
    return re.sub(
        r"[^a-z0-9]+",
        "",
        unicodedata.normalize("NFD", name.lower()).encode("ascii", "ignore").decode(),
    )


FOREIGN_HINTS_NORM = [joined_name(h) for h in FOREIGN_HINTS if joined_name(h)]


def main() -> None:
    clubs: set[str] = set()
    files = glob.glob(os.path.join(DATA_DIR, "*", "players.json")) + glob.glob(
        os.path.join(DATA_DIR, "*", "seasons", "*", "players.json")
    )
    skipped_foreign: set[str] = set()
    for path in files:
        league = os.path.relpath(path, DATA_DIR).split(os.sep)[0]
        if league in EXCLUDED_LEAGUES:
            continue
        try:
            data = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        for player in data.get("players", []):
            club = (player.get("club") or "").strip()
            if not club:
                continue
            # Match no nome completo unido — nao no norm com stripping,
            # senao 'atletico nacional' viraria 'nacional' e derrubaria
            # clubes BR (Nacional-AM, Nacional de Patos).
            if any(hint in joined_name(club) for hint in FOREIGN_HINTS_NORM):
                skipped_foreign.add(club)
                continue
            clubs.add(club)

    out = sorted(clubs)
    dest = os.path.join(DATA_DIR, "cross-season", "br-clubs.json")
    json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(out)} clubes BR -> {dest} ({len(skipped_foreign)} estrangeiros ignorados)")


if __name__ == "__main__":
    main()
