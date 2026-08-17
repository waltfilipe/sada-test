from __future__ import annotations

import json
import re
import time
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
CACHE_PATH = ROOT / "data" / "transfermarkt-cache.json"
BASE_URL = "https://www.transfermarkt.com.br"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

CLUB_ALIASES: dict[str, list[str]] = {
    "athletico paranaense": ["athletico", "athletico paranaense", "cap"],
    "atletico mineiro": ["atlético mineiro", "atletico mineiro", "atl mineiro"],
    "vasco da gama": ["vasco", "cr vasco"],
    "red bull bragantino": ["bragantino", "rb bragantino", "red bull bragantino"],
    "sao paulo": ["são paulo", "spfc"],
    "internacional": ["inter", "sport club internacional"],
    "gremio": ["grêmio"],
    "cruzeiro": ["cruzeiro esporte clube"],
    "fluminense": ["fluminense football club"],
    "corinthians": ["sc corinthians", "corinthians"],
    "palmeiras": ["se palmeiras", "palmeiras"],
    "flamengo": ["cr flamengo", "flamengo"],
    "santos": ["santos fc"],
    "bahia": ["ec bahia", "bahia"],
    "fortaleza": ["fortaleza ec"],
    "ceara": ["ceará", "ceara sc"],
    "chapecoense": ["chapecoense af"],
    "mirassol": ["mirassol fc"],
    "remo": ["clube do remo"],
}


def _normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _club_match_score(player_club: str, tm_club: str) -> int:
    player_norm = _normalize_text(player_club)
    tm_norm = _normalize_text(tm_club)
    if not player_norm or not tm_norm:
        return 0
    if player_norm in tm_norm or tm_norm in player_norm:
        return 100
    player_tokens = set(player_norm.split())
    tm_tokens = set(tm_norm.split())
    overlap = len(player_tokens & tm_tokens)
    if overlap:
        return 40 + overlap * 10
    for alias_key, aliases in CLUB_ALIASES.items():
        if alias_key in player_norm or any(alias in player_norm for alias in aliases):
            if any(alias in tm_norm for alias in aliases) or alias_key in tm_norm:
                return 80
    return 0


def _parse_market_value_eur(raw: str | None) -> int | None:
    if not raw:
        return None
    text = raw.lower().strip()
    match = re.search(r"€\s*([\d.,]+)\s*(mil(?:h[oõ]es)?|mi(?:l|lh[oõ]es)?|mio|m\b|k|th)?", text)
    if not match:
        return None
    amount_str = match.group(1)
    if "," in amount_str and "." in amount_str:
        if amount_str.rfind(",") > amount_str.rfind("."):
            amount_str = amount_str.replace(".", "").replace(",", ".")
        else:
            amount_str = amount_str.replace(",", "")
    elif "," in amount_str:
        amount_str = amount_str.replace(",", ".")
    amount = float(amount_str)
    unit = (match.group(2) or "").replace(".", "")
    if unit in {"mi", "mio", "m"}:
        return int(amount * 1_000_000)
    if unit in {"mil", "k", "th"}:
        return int(amount * 1_000)
    return int(amount)


def _format_market_value_pt(raw: str | None, eur: int | None) -> str | None:
    if raw:
        cleaned = re.split(r"\s+Última alteração:", raw, maxsplit=1)[0].strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.replace("€", "€ ").replace("€  ", "€ ").strip()
    if eur is None:
        return None
    if eur >= 1_000_000:
        value = eur / 1_000_000
        text = f"{value:.2f}".rstrip("0").rstrip(".")
        return f"€ {text} mi"
    if eur >= 1_000:
        value = eur / 1_000
        text = f"{value:.0f}" if value.is_integer() else f"{value:.1f}"
        return f"€ {text} mil"
    return f"€ {eur}"


def _parse_contract_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _contract_remaining(contract_until: str | None) -> str | None:
    if not contract_until:
        return None
    try:
        end = datetime.fromisoformat(contract_until).date()
    except ValueError:
        return None
    today = date.today()
    if end <= today:
        return "Contrato vencido"
    years = end.year - today.year
    months = end.month - today.month
    days = end.day - today.day
    if days < 0:
        months -= 1
    if months < 0:
        years -= 1
        months += 12
    parts: list[str] = []
    if years:
        parts.append(f"{years} ano{'s' if years > 1 else ''}")
    if months:
        parts.append(f"{months} mes{'es' if months > 1 else ''}")
    if not parts:
        parts.append(f"{max((end - today).days, 1)} dia(s)")
    return " e ".join(parts)


def _load_cache() -> dict[str, Any]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def _save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _search_players(name: str) -> list[dict[str, Any]]:
    response = SESSION.get(
        f"{BASE_URL}/schnellsuche/ergebnis/schnellsuche",
        params={"query": name},
        timeout=25,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    for row in soup.select("table.items tbody tr"):
        link = row.select_one("a[href*='/profil/spieler/']")
        market_cell = row.select_one("td.rechts.hauptlink")
        if not link or not market_cell:
            continue
        href = link["href"]
        match = re.search(r"/spieler/(\d+)", href)
        if not match:
            continue
        player_id = match.group(1)
        if player_id in seen:
            continue
        seen.add(player_id)
        parts = [part.strip() for part in row.get_text(" | ", strip=True).split(" | ")]
        results.append(
            {
                "id": player_id,
                "name": link.get_text(strip=True),
                "club": parts[1] if len(parts) > 1 else "",
                "market_value": market_cell.get_text(strip=True),
                "path": href,
            }
        )
    return results


def _pick_search_result(name: str, club: str, results: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not results:
        return None
    if len(results) == 1:
        return results[0]

    name_norm = _normalize_text(name)
    scored: list[tuple[int, dict[str, Any]]] = []
    for result in results:
        score = _club_match_score(club, result.get("club", ""))
        if _normalize_text(result.get("name", "")) == name_norm:
            score += 25
        elif name_norm in _normalize_text(result.get("name", "")):
            score += 10
        scored.append((score, result))
    scored.sort(key=lambda item: item[0], reverse=True)
    best_score, best = scored[0]
    return best if best_score >= 40 else None


def _scrape_profile(path: str) -> dict[str, Any]:
    response = SESSION.get(f"{BASE_URL}{path}", timeout=25)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")

    image = soup.select_one("img.data-header__profile-image")
    market_el = soup.select_one("a.data-header__market-value-wrapper")
    market_raw = market_el.get_text(" ", strip=True) if market_el else None
    market_eur = _parse_market_value_eur(market_raw)

    contract_raw = None
    current_club = None
    spans = soup.select("span.info-table__content")
    for index, span in enumerate(spans):
        label = span.get_text(strip=True).lower()
        if index + 1 >= len(spans):
            continue
        value = spans[index + 1].get_text(" ", strip=True)
        if label.startswith("contrato até"):
            contract_raw = value
        if label == "clube atual:":
            current_club = value

    contract_until = _parse_contract_date(contract_raw)
    return {
        "id": re.search(r"/spieler/(\d+)", path).group(1) if re.search(r"/spieler/(\d+)", path) else None,
        "photo": image["src"] if image and image.get("src") else None,
        "market_value": _format_market_value_pt(market_raw, market_eur),
        "market_value_eur": market_eur,
        "contract_until": contract_until,
        "contract_remaining": _contract_remaining(contract_until),
        "club": current_club,
        "profile_url": f"{BASE_URL}{path}",
    }


def fetch_player_transfermarkt(name: str, club: str, cache: dict[str, Any], delay: float = 0.9) -> dict[str, Any] | None:
    cache_key = f"{_normalize_text(name)}::{_normalize_text(club)}"
    if cache_key in cache:
        return cache[cache_key]

    try:
        results = _search_players(name)
        time.sleep(delay)
        picked = _pick_search_result(name, club, results)
        if not picked:
            cache[cache_key] = None
            return None
        profile = _scrape_profile(picked["path"])
        if profile.get("club") and _club_match_score(club, profile["club"]) < 40:
            cache[cache_key] = None
            return None
        if not profile.get("market_value") and picked.get("market_value"):
            profile["market_value"] = _format_market_value_pt(
                picked["market_value"],
                _parse_market_value_eur(picked["market_value"]),
            )
            profile["market_value_eur"] = _parse_market_value_eur(picked["market_value"])
        cache[cache_key] = profile
        time.sleep(delay)
        return profile
    except Exception:
        cache[cache_key] = None
        return None


def enrich_players_with_transfermarkt(players: list[dict[str, Any]], delay: float = 0.9) -> list[dict[str, Any]]:
    cache = _load_cache()
    total = len(players)
    for index, player in enumerate(players, start=1):
        if player.get("transfermarkt"):
            continue
        tm = fetch_player_transfermarkt(player["name"], player["club"], cache, delay=delay)
        player["transfermarkt"] = tm
        if index % 25 == 0:
            _save_cache(cache)
            print(f"    Transfermarkt: {index}/{total}")
    _save_cache(cache)
    return players
