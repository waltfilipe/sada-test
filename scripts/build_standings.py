"""Build data/cross-season/standings.json — final/current table order per league+season.

Sources: pt.wikipedia wikitext.
  - Serie A/B: Predefinicao "Tabela do Campeonato Brasileiro da Serie X - YYYY"
    (team1..team20 already in table order).
  - Serie C: article's "Classificacao geral" section (inline Sports table).
  - Serie D has no single table -> left out (UI falls back to alphabetical).
"""
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "cross-season" / "standings.json"

WIKI_RAW = "https://pt.wikipedia.org/w/index.php?title={title}&action=raw"
UA = {"User-Agent": "sada-scout-standings/1.0"}

LEAGUES = {
    "serie-a": ("A", "template"),
    "serie-b": ("B", "template"),
    "serie-c": ("C", "article"),
}
SEASONS = ["2026", "2025", "2024", "2023", "2022"]

TEAM_RE = re.compile(r"\|team(\d+)\s*=\s*([A-Z0-9]{2,4})")
NAME_RE = re.compile(r"\|name_([A-Z0-9]{2,4})\s*=\s*(.+)")


def fetch(title: str) -> str:
    req = urllib.request.Request(WIKI_RAW.format(title=urllib.parse.quote(title)), headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8")


def fold(value: str) -> str:
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]", "", text.lower())


def clean_name(raw: str) -> str:
    # {{Futebol X|estado=antes}} -> X ; [[Clube|X]] -> X ; {{Futebol X}} -> X
    raw = raw.strip()
    m = re.search(r"\{\{Futebol ([^}|]+)", raw)
    if m:
        return m.group(1).strip()
    m = re.search(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", raw)
    if m:
        return m.group(1).strip()
    return re.sub(r"\{\{|\}\}", "", raw).strip()


def parse_table(text: str) -> list[str]:
    """Parse the LONGEST teamN= block in the wikitext -> ordered names."""
    names = {m.group(1): clean_name(m.group(2)) for m in NAME_RE.finditer(text)}
    # group consecutive teamN= declarations into blocks
    blocks: list[list[tuple[int, str]]] = []
    for m in TEAM_RE.finditer(text):
        num, code = int(m.group(1)), m.group(2)
        if not blocks or num <= blocks[-1][-1][0]:
            blocks.append([])
        blocks[-1].append((num, code))
    best = max(blocks, key=len, default=[])
    return [names.get(code, code) for _, code in sorted(best)]


def parse_wikitable(text: str) -> list[str]:
    """Plain wikitable: rows are already in table order -> {{Futebol X}} sequence."""
    ordered: list[str] = []
    for m in re.finditer(r"\{\{Futebol ([^}|]+)", text):
        name = m.group(1).strip()
        if name not in ordered:
            ordered.append(name)
    return ordered


def section(text: str, heading: str) -> str:
    m = re.search(rf"==+\s*{re.escape(heading)}\s*==+", text)
    if not m:
        return ""
    nxt = re.search(r"\n==[^=]", text[m.end():])
    return text[m.end(): m.end() + nxt.start()] if nxt else text[m.end():]


ALIAS = {
    # wikiname (folded) -> dataset club name
    "athleticopr": "Athletico Paranaense",
    "athleticoparanaense": "Athletico Paranaense",
    "atleticogo": "Atlético GO",
    "atleticogoianiense": "Atlético GO",
    "atleticomg": "Atlético Mineiro",
    "atleticomineiro": "Atlético Mineiro",
    "internacionalrs": "Internacional",
    "vasco": "Vasco da Gama",
    "vascodagama": "Vasco da Gama",
    "redbullbragantino": "Red Bull Bragantino",
    "bragantino": "Red Bull Bragantino",
    "rbbragantino": "Red Bull Bragantino",
    "americamg": "América Mineiro",
    "americamineiro": "América Mineiro",
    "americarn": "América de Natal",
    "athletic": "Athletic Club",
    "athleticclub": "Athletic Club",
    "athleticclubmg": "Athletic Club",
    "botafogopb": "Botafogo da Paraíba",
    "botafogodaparaiba": "Botafogo da Paraíba",
    "saojosepoa": "São José-RS",
    "saojosers": "São José-RS",
    "florestace": "Floresta",
    "ferroviarioce": "Ferroviário",
    "ferroviario": "Ferroviário",
    "saubernardo": "São Bernardo",
    "saobernardofc": "São Bernardo",
    "sport": "Sport Recife",
    "sportrecife": "Sport Recife",
    "operario": "Operário PR",
    "operariopr": "Operário PR",
    "operarioferroviario": "Operário PR",
    "ypirangadeerechim": "Ypiranga Erechim",
    "ypirangars": "Ypiranga Erechim",
    "ypiranga": "Ypiranga Erechim",
    "novorizontino": "Grêmio Novorizontino",
    "gremionovorizontino": "Grêmio Novorizontino",
    "florestace": "Floresta EC",
    "florestaec": "Floresta EC",
    "floresta": "Floresta EC",
    "saojosepoa": "EC São José",
    "saojosers": "EC São José",
    "ecsaojose": "EC São José",
    "coritiba": "Coritiba",
    "paysandu": "Paysandu",
    "paysandusc": "Paysandu",
    "paysandusportclub": "Paysandu",
    "amazonasfc": "Amazonas",
    "ceara": "Ceará",
    "cearasc": "Ceará",
    "avilaa": "Avaí",
    "avila": "Avaí",
    "avifc": "Avaí",
    "nautico": "Náutico",
    "vila nova": "Vila Nova",
    "vilanova": "Vila Nova",
    "saopaulo": "São Paulo",
    "gremio": "Grêmio",
    "gremionovorizontino": "Novorizontino",
    "tunaluso": "Tuna Luso",
    "tunalusobrasileira": "Tuna Luso",
}


def dataset_clubs(league: str, season: str) -> list[str]:
    """Real member clubs — the export adds artifact rows for mid-season departures
    (a few athletes under the destination club), so only clubs with >=10 players count."""
    base = ROOT / "data" / league
    players_path = base / "players.json" if season == "2026" else base / "seasons" / season / "players.json"
    if not players_path.exists():
        return []
    players = json.loads(players_path.read_text(encoding="utf-8")).get("players", [])
    counts: dict[str, int] = {}
    for player in players:
        club = player.get("club")
        if club:
            counts[club] = counts.get(club, 0) + 1
    return [club for club, count in counts.items() if count >= 10]


def resolve(wiki_name: str, clubs: list[str]) -> str | None:
    folded = fold(wiki_name)
    if folded in ALIAS and ALIAS[folded] in clubs:
        return ALIAS[folded]
    for club in clubs:
        if fold(club) == folded:
            return club
    # containment fallbacks ("atleticogo" inside "atleticogoianiense" etc.)
    for club in clubs:
        c = fold(club)
        if len(folded) >= 5 and (c.startswith(folded) or folded.startswith(c)):
            return club
    return None


def main() -> None:
    standings: dict[str, dict[str, list[str]]] = {}
    misses: list[str] = []
    for league, (serie, mode) in LEAGUES.items():
        standings[league] = {}
        for season in SEASONS:
            if mode == "template":
                title = f"Predefinição:Tabela_do_Campeonato_Brasileiro_da_Série_{serie}_-_{season}"
                text = fetch(title)
                ordered = parse_table(text)
            else:
                title = f"Campeonato_Brasileiro_de_Futebol_de_{season}_-_Série_{serie}"
                text = fetch(title)
                geral = section(text, "Classificação geral")
                ordered = parse_table(geral) if geral else parse_table(text)
                if len(ordered) < 15:
                    tmpl = fetch(
                        f"Predefinição:Tabela_do_Campeonato_Brasileiro_da_Série_{serie}_-_{season}"
                    )
                    ordered = parse_table(tmpl)
                    if len(ordered) < 15:
                        ordered = parse_wikitable(tmpl)
            clubs = dataset_clubs(league, season)
            mapped: list[str] = []
            for name in ordered:
                hit = resolve(name, clubs)
                if hit and hit not in mapped:
                    mapped.append(hit)
                elif not hit:
                    misses.append(f"{league} {season}: '{name}'")
            missing = [c for c in clubs if c not in mapped]
            standings[league][season] = mapped
            print(f"{league} {season}: {len(mapped)} clubes ({len(missing)} sem posição)")
    OUT.write_text(json.dumps(standings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if misses:
        print("\nNOMES SEM MATCH:")
        for m in misses:
            print(" ", m)
    print(f"\n-> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
