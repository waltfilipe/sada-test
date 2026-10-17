#!/usr/bin/env python3
"""Download club crests into public/clubs/ for the scout UI."""

from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "clubs"
META = ROOT / "data" / "meta.json"

# Preferred Wikipedia page titles (pt/en) per club name in our dataset.
WIKI_TITLES: dict[str, list[str]] = {
    "Athletico Paranaense": ["Club Athletico Paranaense", "Athletico Paranaense"],
    "Atlético Mineiro": ["Clube Atlético Mineiro", "Atlético Mineiro"],
    "Bahia": ["Esporte Clube Bahia"],
    "Botafogo": ["Botafogo de Futebol e Regatas"],
    "Ceará": ["Ceará Sporting Club"],
    "Chapecoense": ["Associação Chapecoense de Futebol"],
    "Corinthians": ["Sport Club Corinthians Paulista"],
    "Coritiba": ["Coritiba Foot Ball Club"],
    "Cruzeiro": ["Cruzeiro Esporte Clube"],
    "Flamengo": ["Clube de Regatas do Flamengo"],
    "Fluminense": ["Fluminense Football Club"],
    "Fortaleza": ["Fortaleza Esporte Clube"],
    "Grêmio": ["Grêmio Foot-Ball Porto Alegrense"],
    "Grêmio U20": ["Grêmio Foot-Ball Porto Alegrense"],
    "Internacional": ["Sport Club Internacional"],
    "Juventus": ["Juventus FC"],
    "Londrina": ["Londrina Esporte Clube"],
    "Mirassol": ["Mirassol Futebol Clube"],
    "Náutico": ["Clube Náutico Capibaribe"],
    "Palmeiras": ["Sociedade Esportiva Palmeiras"],
    "Red Bull Bragantino": ["Red Bull Bragantino"],
    "Red Bull Bragantino U20": ["Red Bull Bragantino"],
    "Remo": ["Clube do Remo"],
    "River Plate": ["Club Atlético River Plate"],
    "Santos": ["Santos FC"],
    "Santos U20": ["Santos FC"],
    "Sport Recife": ["Sport Club do Recife"],
    "São Paulo": ["São Paulo FC"],
    "São Paulo U20": ["São Paulo FC"],
    "Vasco da Gama": ["Club de Regatas Vasco da Gama"],
    "Vila Nova": ["Vila Nova Futebol Clube"],
    "Vitória": ["Esporte Clube Vitória"],
    "Fiorentina": ["ACF Fiorentina"],
    "Real Betis": ["Real Betis Balompié"],
    "Como": ["Como 1907"],
    "Atlanta United": ["Atlanta United FC"],
    "New York City": ["New York City FC"],
    "Tigres UANL": ["Club de Fútbol Tigres de la UANL"],
    "Krasnodar": ["FC Krasnodar"],
    "River Plate": ["Club Atlético River Plate"],
    "Al Feiha": ["Al-Fayha FC"],
    "Al Sharjah": ["Sharjah FC"],
    "Atlante": ["Atlante F.C."],
    "Batman Petrolspor": ["Batman Petrolspor"],
    "Júbilo Iwata": ["Júbilo Iwata"],
    "Qatar SC": ["Qatar SC"],
    "Shenzhen Peng City": ["Shenzhen FC"],
    "ABC": ["ABC Futebol Clube", "ABC FC"],
    "ASA": ["Agremiação Sportiva Arapiraquense", "ASA"],
    "América": ["América Futebol Clube (Belo Horizonte)", "América-MG"],
    "América RN": ["América Futebol Clube (Natal)", "América de Natal"],
    "Athletic Club": ["Athletic Club (MG)", "Athletic Club (Minas Gerais)"],
    "Atlético GO": ["Atlético Clube Goianiense", "Atlético Goianiense"],
    "Botafogo SP": ["Botafogo Futebol Clube (Ribeirão Preto)", "Botafogo-SP"],
    "CSA": ["Centro Sportivo Alagoano", "CSA"],
    "Camboriú": ["Camboriú Futebol Clube"],
    "Capital Brasilia": ["Capital CF", "Capital Clube de Futebol"],
    "Cianorte": ["Cianorte Futebol Clube"],
    "Criciúma": ["Criciúma Esporte Clube"],
    "Cuiabá": ["Cuiabá Esporte Clube"],
    "EC São José": ["Esporte Clube São José", "São José-RS"],
    "Ferroviário": ["Ferroviário Atlético Clube", "Ferroviário AC"],
    "Gama": ["Sociedade Esportiva do Gama"],
    "Goiatuba EC": ["Goiatuba Esporte Clube"],
    "Goiás": ["Goiás Esporte Clube"],
    "Grêmio Novorizontino": ["Grêmio Novorizontino"],
    "Iguatu": ["Associação Desportiva Iguatu"],
    "Imperatriz": ["Sociedade Imperatriz de Desportos"],
    "Juventude": ["Esporte Clube Juventude"],
    "Luverdense": ["Luverdense Esporte Clube"],
    "Maguary PE": ["Maguary"],
    "Manauara": ["Manauara Esporte Clube"],
    "Marcílio Dias": ["Clube Náutico Marcílio Dias"],
    "Nacional": ["Nacional Futebol Clube", "Nacional-AM"],
    "Nacional AM": ["Nacional Futebol Clube", "Nacional-AM"],
    "Operário PR": ["Operário Ferroviário Esporte Clube"],
    "Ponte Preta": ["Associação Atlética Ponte Preta"],
    "Portuguesa": ["Associação Portuguesa de Desportos"],
    "Primavera SP": ["Primavera"],
    "São Bernardo FC": ["São Bernardo Futebol Clube"],
    "São José EC": ["São José Esporte Clube"],
    "São Luiz": ["Sport Club São Luiz"],
    "Trem": ["Trem Desportivo Clube"],
    "Treze": ["Treze Futebol Clube"],
    "Uberlândia": ["Uberlândia Esporte Clube"],
    "XV de Piracicaba": ["Esporte Clube XV de Novembro (Piracicaba)"],
    "Águia de Marabá": ["Águia de Marabá Futebol Clube"],
    "Al Ettifaq": ["Al-Ettifaq FC", "Ettifaq FC"],
    "Al Jabalain": ["Al-Jabalain FC"],
    "Alverca": ["F.C. Alverca"],
    "Atlas": ["Atlas FC", "Club Atlas"],
    "Birkirkara": ["Birkirkara F.C."],
    "Buriram United": ["Buriram United F.C."],
    "Cercle Brugge": ["Cercle Brugge K.S.V."],
    "Columbus Crew": ["Columbus Crew"],
    "FLC Thanh Hoa": ["Thanh Hoa FC", "Dong A Thanh Hoa"],
    "Hapoel Ramat Gan": ["Hapoel Ramat Gan Givatayim F.C."],
    "Hatta": ["Hatta Club"],
    "Houston Dynamo II": ["Houston Dynamo FC"],
    "Imigresen": ["Imigresen FC"],
    "Jeonbuk Motors": ["Jeonbuk Hyundai Motors"],
    "Los Angeles FC": ["Los Angeles FC"],
    "Manchester City": ["Manchester City F.C."],
    "Porto": ["FC Porto"],
    "Racing Club": ["Racing Club de Avellaneda"],
    "Rayong": ["Rayong F.C."],
    "San Antonio Bulo Bulo": ["Club San Antonio Bulo Bulo"],
    "Seoul E-Land": ["Seoul E-Land FC"],
    "Sumqayıt": ["Sumgayit FK", "Sumqayıt FK"],
    "Uthai Thani": ["Uthai Thani F.C."],
    "Viettel": ["Viettel FC"],
    "Zabbar St. Patrick": ["St. Patrick's F.C.", "Żabbar St. Patrick F.C."],
    # MLS and MLS Next Pro. "Dallas" alone is the city page, not FC Dallas.
    "Austin FC": ["Austin FC"],
    "Charlotte FC": ["Charlotte FC"],
    "Chicago Fire": ["Chicago Fire FC"],
    "Cincinnati": ["FC Cincinnati"],
    "Colorado Rapids": ["Colorado Rapids"],
    "Dallas": ["FC Dallas"],
    "Houston Dynamo": ["Houston Dynamo FC"],
    "Minnesota United": ["Minnesota United FC"],
    "Nashville SC": ["Nashville SC"],
    "New York RB": ["New York Red Bulls"],
    "Orlando City": ["Orlando City SC"],
    "Philadelphia Union": ["Philadelphia Union"],
    "Portland Timbers": ["Portland Timbers"],
    "Real Salt Lake": ["Real Salt Lake"],
    "Seattle Sounders": ["Seattle Sounders FC"],
    "SJ Earthquakes": ["San Jose Earthquakes"],
    "Sporting KC": ["Sporting Kansas City"],
    "St. Louis City": ["St. Louis City SC"],
    "Toronto": ["Toronto FC"],
    "Vancouver Whitecaps": ["Vancouver Whitecaps FC"],
}

# Official MLS Next Pro crests (mlsnextpro.com), keyed by the club name in the dataset.
# "Los Angeles II" is Los Angeles FC 2; Ventura County FC is a separate club.
MLS_NEXT_PRO_CRESTS: dict[str, str] = {
    "Atlanta United II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1671201297/assets/mnp/logos/clubs/ATL-Club_Logo-Full_Color_xgfecm.png",
    "Austin FC II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1677080279/assets/mnp/logos/clubs/ATX_2-Club_Logo-Full_Color_pe1twv.svg",
    "Carolina Core": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1707387107/assets/mnp/logos/clubs/CCFC_Logo480x480.png",
    "Chattanooga": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1707387108/assets/mnp/logos/clubs/CHT-480x480.png",
    "Chicago Fire II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628288/assets/mnp/logos/clubs/MLS_NextPro_Logo-CHI-480_xnhffw.png",
    "Colorado Rapids II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628284/assets/mnp/logos/clubs/COL-Logo-480.png",
    "Columbus Crew II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628289/assets/mnp/logos/clubs/CLB-Logo_Dark-480.png",
    "Crown Legacy FC": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1677077684/assets/mnp/logos/clubs/CLT2-Club_Logo-Full_Color_msnssi.png",
    "Connecticut FC": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1764624230/assets/mnp/club-logos/CT-United-Shield-Digital_fmufik.png",
    "Cincinnati II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628285/assets/mnp/logos/clubs/FCC2-Logo-480_iq8qpq.png",
    "Houston Dynamo II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628286/assets/mnp/logos/clubs/HOU-Logo-480.png",
    "Huntsville City": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1667406760/assets/mnp/huntsville/logos/New_RGB_HuntsvilleCityFC_Crest_FullColor_2_ykcgln.svg",
    "Inter Miami II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645639462/assets/mnp/logos/clubs/MLS_NextPro_Logo-MIA-480_mqgj5k.png",
    "Los Angeles II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1677084715/assets/mnp/logos/clubs/LAFC-Club_Logo-Full_Color_updated_yegizu.svg",
    "Minnesota United II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628286/assets/mnp/logos/clubs/MIN-Logo-480.png",
    "New England II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628289/assets/mnp/logos/clubs/NE-Logo-480.png",
    "North Texas": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628266/assets/mnp/logos/clubs/NTSC-Logo-480.png",
    "New York City II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1742330029/assets/mnp/logos/clubs/NYCFC-II_badge_rgb_full-color_2025_jec9lr.png",
    "Orlando City B": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628268/assets/mnp/logos/clubs/ORL-Logo-480.png",
    "Philadelphia Union II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628269/assets/mnp/logos/clubs/PHI-Logo-480.png",
    "Real Monarchs": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628271/assets/mnp/logos/clubs/RMN-Logo-480.png",
    "New York RB II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1778277232/assets/RBII_crest_4C_STAR_480x480_t0vnbo.png",
    "Quakes II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1745527199/assets/mnp/club-logos/San_Jose_Earthquakes_2014_jjndnq.png",
    "Sporting KC II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628275/assets/mnp/logos/clubs/SKC-Logo-480.png",
    "St. Louis City II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628276/assets/mnp/logos/clubs/STL-Logo-480.png",
    "Tacoma Defiance": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628277/assets/mnp/logos/clubs/TAC-Logo-480.png",
    "Toronto II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628277/assets/mnp/logos/clubs/TOR-Logo-480.png",
    "Portland Timbers II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645628270/assets/mnp/logos/clubs/POR-Logo-480.png",
    "Ventura County": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1710868641/assets/mnp/logos/clubs/Ventura_County_480x480_bmc1mn.png",
    "Vancouver Whitecaps II": "https://images.mlssoccer.com/image/upload/f_png,w_320,c_limit/v1645740228/assets/mnp/logos/clubs/MLS_NextPro_Logo-VAN-480_1_jntzah.png",
    "St. Louis City": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Logo_of_St._Louis_City_SC.svg/330px-Logo_of_St._Louis_City_SC.svg.png",
}


def slug(name: str) -> str:
    normalized = unicodedata.normalize("NFD", name)
    ascii_name = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": "sada-scout/1.0 (club logos)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return None


def download_file(url: str, dest: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": "sada-scout/1.0 (club logos)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            dest.write_bytes(response.read())
        return True
    except urllib.error.URLError:
        return False


def wiki_thumbnail(title: str) -> str | None:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    data = fetch_json(f"https://pt.wikipedia.org/api/rest_v1/page/summary/{encoded}")
    if not data or not data.get("thumbnail"):
        data = fetch_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}")
    if not data:
        return None
    thumb = data.get("thumbnail", {})
    src = thumb.get("source")
    if not src:
        return None
    # Prefer a consistent ~120px asset when possible.
    return re.sub(r"/(\d+)px-", "/120px-", src)


def sportsdb_badge(club: str) -> str | None:
    query = urllib.parse.quote(club.replace(" U20", ""))
    data = fetch_json(f"https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t={query}")
    teams = (data or {}).get("teams") or []
    if not teams:
        return None
    team = teams[0]
    return team.get("strBadge") or team.get("strLogo")


def resolve_logo_url(club: str) -> str | None:
    if club in MLS_NEXT_PRO_CRESTS:
        return MLS_NEXT_PRO_CRESTS[club]
    for title in WIKI_TITLES.get(club, [club]):
        url = wiki_thumbnail(title)
        if url:
            return url
        time.sleep(0.35)
    url = sportsdb_badge(club)
    if url:
        return url
    return None


def clubs_in_use() -> list[str]:
    names = set(json.loads(META.read_text(encoding="utf-8")).get("clubs") or [])
    for path in (ROOT / "data").glob("*/players.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for player in payload.get("players") or []:
            club = str(player.get("club") or "").strip()
            if club:
                names.add(club)
    return sorted(names)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    clubs = clubs_in_use()
    ok = 0
    for club in clubs:
        dest = OUT / f"{slug(club)}.png"
        if dest.exists() and dest.stat().st_size > 500:
            print(f"SKIP {club} (exists)")
            ok += 1
            continue
        if club.endswith(" U20"):
            senior = OUT / f"{slug(club[:-4].strip())}.png"
            if senior.exists() and senior.stat().st_size > 500:
                dest.write_bytes(senior.read_bytes())
                print(f"COPY {club} <- {senior.name}")
                ok += 1
                continue
        url = resolve_logo_url(club)
        if not url:
            print(f"MISS {club}")
            continue
        if download_file(url, dest):
            print(f"OK   {club} -> {dest.name}")
            ok += 1
        else:
            print(f"FAIL {club}")
        time.sleep(0.5)
    print(f"\nReady {ok}/{len(clubs)} logos in {OUT}")


if __name__ == "__main__":
    main()
