"""Map Wyscout club names to estadual championship league ids."""

from __future__ import annotations

import re
import unicodedata
from typing import Final

CHAMPIONSHIP_IDS: Final[tuple[str, ...]] = (
    "est-nv1-paulista",
    "est-nv1-gaucho",
    "est-nv1-mineiro",
    "est-nv1-carioca",
    "est-nv2-paranaense",
    "est-nv2-catarinense",
    "est-nv2-paulista-a2",
    "est-nv2-baiano",
    "est-nv3-cearense",
    "est-nv3-pernambucano",
    "est-nv3-paulista-a3",
    "est-nv3-goiano",
    "est-nv4-outros",
)


def _norm(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _contains(norm_club: str, *needles: str) -> bool:
    return any(needle in norm_club for needle in needles)


# Exact normalized club names (Wyscout labels) per championship.
_EXACT: dict[str, set[str]] = {
    "est-nv1-paulista": {
        _norm(x)
        for x in [
            "Palmeiras",
            "Corinthians",
            "São Paulo",
            "Santos",
            "Red Bull Bragantino",
            "Ponte Preta",
            "Guarani",
            "Portuguesa",
            "Mirassol",
            "Grêmio Novorizontino",
            "Velo Clube",
            "Botafogo SP",
            "São Bernardo",
            "Ferroviária",
            "Primavera",
            "Rio Claro",
            "Taubaté",
            "Linense",
            "Noroeste",
            "São José EC",
            "Inter de Limeira",
            "Capivariano",
            "Santo André",
            "Juventus SP",
            "Oeste",
            "São Bento",
            "Comercial SP",
            "Marília",
            "Ituano",
            "São Caetano",
            "Guaratinguetá",
            "Bandeirante SP",
            "Barretos",
            "Desportivo Brasil",
            "Grêmio Prudente",
            "Monte Azul",
            "Rio Branco SP",
            "São José EC U20",
        ]
    },
    "est-nv1-gaucho": {
        _norm(x)
        for x in [
            "Grêmio",
            "Internacional",
            "Juventude",
            "Caxias",
            "São José RS",
            "Avenida",
            "Ypiranga Erechim",
            "Novo Hamburgo",
            "Aimoré",
            "Lajeadense",
            "Glória",
            "Pelotas",
            "Monsoon",
            "Santa Cruz RS",
            "São Luiz",
            "Brasil Pelotas",
            "SER Caxias",
            "Esportivo",
            "Veranópolis",
            "São Gabriel",
            "Internacional U20",
            "Grêmio U20",
        ]
    },
    "est-nv1-mineiro": {
        _norm(x)
        for x in [
            "Atlético Mineiro",
            "Cruzeiro",
            "América Mineiro",
            "Athletic Club",
            "Tombense",
            "Pouso Alegre",
            "Uberlândia",
            "Democrata GV",
            "North FC",
            "Patrocinense",
            "Itabirito",
            "Villa Nova",
            "URT",
            "Democrata SL",
            "Betim",
            "Caldense",
            "Mamoré",
            "Tupi",
            "Coimbra",
        ]
    },
    "est-nv1-carioca": {
        _norm(x)
        for x in [
            "Flamengo",
            "Fluminense",
            "Vasco da Gama",
            "Botafogo",
            "Volta Redonda",
            "Nova Iguaçu",
            "Portuguesa RJ",
            "Boavista",
            "Madureira",
            "Bangu",
            "Resende",
            "Audax Rio",
            "Maricá",
            "América RJ",
            "Campo Grande",
            "Tijuca",
            "Fluminense de Feira",
            "Olaria",
            "Cabofriense",
            "Petropolitano",
            "Sampaio Corrêa RJ",
        ]
    },
    "est-nv2-paranaense": {
        _norm(x)
        for x in [
            "Athletico Paranaense",
            "Coritiba",
            "Operário Ferroviário",
            "Cascavel",
            "Londrina",
            "Maringá",
            "Cianorte",
            "Azuriz",
            "Rio Branco PR",
            "Prudentópolis",
            "São Joseense",
            "Andraus Brasil",
            "Apucarana",
            "FC Cascavel",
            "Paraná",
            "Toledo",
            "Foz do Iguaçu",
        ]
    },
    "est-nv2-catarinense": {
        _norm(x)
        for x in [
            "Avaí",
            "Criciúma",
            "Figueirense",
            "Chapecoense",
            "Joinville",
            "Brusque",
            "Tubarão",
            "Atlético Tubarão",
            "Marcílio Dias",
            "Hermann",
            "Concórdia",
            "Metropolitano",
            "Barra SC",
            "Carlos Renaux",
            "Camboriú",
            "Portimonense",
            "Santa Cruz",
        ]
    },
    "est-nv2-paulista-a2": {
        _norm(x)
        for x in [
            "XV de Jaú",
            "XV de Piracicaba",
            "Botafogo PB",
            "Ferroviário SP",
            "Francana",
            "Grêmio Catanduva",
            "Grêmio Osasco",
            "Grêmio Prudente",
            "Inter de Bebedouro",
            "Itapirense",
            "Mauá",
            "Mogi Mirim",
            "Penapolense",
            "Rio Preto",
            "São José EC",
            "Taquaritinga",
            "União São João",
            "Votuporanguense",
            "EC São Bernardo",
            "Sertãozinho",
            "Comercial SP",
            "Catanduva",
            "AEC Taubaté",
        ]
    },
    "est-nv2-baiano": {
        _norm(x)
        for x in [
            "Bahia",
            "Vitória",
            "Juazeirense",
            "Jacobina",
            "Galícia",
            "Fluminense de Feira",
            "Atlético Alagoinhas",
            "Barcelona BA",
            "Jequié",
            "Porto BA",
            "União FC",
            "Doce Mel",
            "Atlético BA",
            "Jacuipense",
            "Bahia de Feira",
            "Alagoinhas",
        ]
    },
    "est-nv3-cearense": {
        _norm(x)
        for x in [
            "Fortaleza",
            "Ceará",
            "Ferroviário",
            "Floresta",
            "Horizonte",
            "Icasa",
            "Quixadá",
            "Maracanã",
            "Atlético Cearense",
            "Caucaia",
            "Barbalha",
            "Maranguape",
            "Iguatu",
            "São Gonçalo CE",
            "Tirol",
        ]
    },
    "est-nv3-pernambucano": {
        _norm(x)
        for x in [
            "Sport Recife",
            "Náutico",
            "Santa Cruz",
            "Retrô",
            "Salguero",
            "Central PE",
            "Afogados",
            "Maguary",
            "Salgueiro",
            "Timbaúba",
            "Petrolina",
            "Cabense",
            "América PE",
            "Paysandu",
            "Decisão",
        ]
    },
    "est-nv3-paulista-a3": {
        _norm(x)
        for x in [
            "Batatais",
            "Catanduva",
            "Comercial SP",
            "Desportivo Brasil",
            "EC São Bernardo",
            "Grêmio Catanduva",
            "Grêmio Osasco",
            "Inter de Bebedouro",
            "Itapirense",
            "Mauá",
            "Mogi Mirim",
            "Penapolense",
            "Rio Preto",
            "Taquaritinga",
            "União São João",
            "Votuporanguense",
            "Sertãozinho",
            "AEC Taubaté",
            "Francana",
            "Aguai U20",
        ]
    },
    "est-nv3-goiano": {
        _norm(x)
        for x in [
            "Atlético GO",
            "Goiás",
            "Vila Nova",
            "Aparecidense",
            "Anápolis",
            "Goiânia",
            "Goianésia",
            "Itumbiara",
            "Morrinhos",
            "Rio Verde",
            "Aparecida GO",
            "Atlético Goianiense",
            "CRAC",
            "Iporá",
            "Jataiense",
            "Luverdense",
        ]
    },
}

# Priority order: first exact match wins; A3/A2 overlap resolved by checking A2 before A3 in rules below.
_PRIORITY: tuple[str, ...] = (
    "est-nv1-paulista",
    "est-nv1-gaucho",
    "est-nv1-mineiro",
    "est-nv1-carioca",
    "est-nv2-paranaense",
    "est-nv2-catarinense",
    "est-nv2-baiano",
    "est-nv3-cearense",
    "est-nv3-pernambucano",
    "est-nv3-goiano",
    "est-nv2-paulista-a2",
    "est-nv3-paulista-a3",
)


def _pattern_championship(norm_club: str) -> str | None:
    if _contains(norm_club, " u20", " u23", " u17", " u15", " u18"):
        base = re.sub(r"\s+u\d+$", "", norm_club)
        exact = classify_estadual_club(base)
        if exact != "est-nv4-outros":
            return exact

    if _contains(norm_club, "al ahli", "al wasl", "benfica", "porto", "barcelona", "real madrid", "manchester"):
        return "est-nv4-outros"

    if norm_club.endswith(" sp") or _contains(norm_club, "comercial sp", "bandeirante sp"):
        if _contains(norm_club, "botafogo sp", "sao bernardo", "santo andre", "oeste", "sao caetano"):
            return "est-nv2-paulista-a2"
        return "est-nv3-paulista-a3"

    if _contains(norm_club, " ba ", " ba") or norm_club.endswith(" ba"):
        return "est-nv2-baiano"
    if _contains(norm_club, " ce ", " ce") or norm_club.endswith(" ce"):
        return "est-nv3-cearense"
    if _contains(norm_club, " pe ", " pe") or norm_club.endswith(" pe"):
        return "est-nv3-pernambucano"
    if _contains(norm_club, " go ", " go") or norm_club.endswith(" go"):
        return "est-nv3-goiano"
    if _contains(norm_club, " pr ", " pr") or norm_club.endswith(" pr"):
        return "est-nv2-paranaense"
    if _contains(norm_club, " sc ", " sc") or norm_club.endswith(" sc"):
        return "est-nv2-catarinense"
    if _contains(norm_club, " rs ", " rs") or norm_club.endswith(" rs"):
        return "est-nv1-gaucho"
    if _contains(norm_club, " rj ", " rj") or norm_club.endswith(" rj"):
        return "est-nv1-carioca"
    if _contains(norm_club, " mg ", " mg") or norm_club.endswith(" mg"):
        return "est-nv1-mineiro"

    return None


def classify_estadual_club(club: str) -> str:
    norm_club = _norm(club)
    if not norm_club:
        return "est-nv4-outros"

    for champ in _PRIORITY:
        if norm_club in _EXACT.get(champ, set()):
            return champ

    patterned = _pattern_championship(norm_club)
    if patterned:
        return patterned

    return "est-nv4-outros"
