#!/usr/bin/env python3
"""Exporta um card-resumo de atleta (estilo popup de tela) como PDF de 1 página.

Gera um PNG estilo o card do app e embute num PDF exato. Uso:

    python scripts/export_player_card_pdf.py --league serie-b --player "Maurício"
    python scripts/export_player_card_pdf.py --league serie-a --id maur-cio-palmeiras-139 --season 2025
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import unicodedata
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CLUBS = ROOT / "public" / "clubs"
CURRENT = "2026"

FONTS_DIR = Path("C:/Windows/Fonts")
FONT = {
    "black": FONTS_DIR / "segoeuib.ttf",
    "bold": FONTS_DIR / "segoeuib.ttf",
    "reg": FONTS_DIR / "segoeui.ttf",
}


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT[kind]), size)


def slug(text: str) -> str:
    t = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return "".join(c if c.isalnum() else "-" for c in t).strip("-")


def find_player(league: str, season: str, needle: str) -> dict:
    base = DATA / league if season == CURRENT else DATA / league / "seasons" / season
    for fam in ("zagueiros", "laterais", "meio-campistas", "extremos", "atacantes"):
        path = base / f"family-{fam}.json"
        if not path.is_file():
            continue
        for p in json.loads(path.read_text(encoding="utf-8")).get("players", []):
            if p.get("player_id") == needle or slug(p.get("name", "")) == slug(needle):
                return p
    raise SystemExit(f"atleta '{needle}' não encontrado em {league} {season}")


def fetch_photo(url: str | None, size: tuple[int, int]) -> Image.Image | None:
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        img = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=15).read())).convert("RGBA")
        return img.resize(size)
    except Exception:
        return None


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *img.size], radius=radius, fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def pct_color(pct: float | None) -> tuple[int, int, int]:
    if pct is None:
        return (148, 163, 184)
    if pct >= 75:
        return (34, 211, 238)
    if pct >= 50:
        return (74, 222, 128)
    if pct >= 25:
        return (250, 204, 21)
    return (248, 113, 113)


def stat_rows(p: dict, limit: int = 5) -> list[tuple[str, str, float | None]]:
    rows: list[tuple[str, str, float | None]] = []
    for items in (p.get("aspects") or {}).values():
        for item in items or []:
            if item.get("display_value") and item.get("percentile") is not None:
                rows.append((item["label"], item["display_value"], item.get("percentile")))
            for sub in (item.get("sub_metrics") or [])[:2]:
                if sub.get("display_value") and sub.get("percentile") is not None:
                    rows.append((f"{item['label']} · {sub['label']}", sub["display_value"], sub.get("percentile")))
            if len(rows) >= limit:
                return rows[:limit]
    return rows


def build_card(p: dict, league: str, season: str) -> Image.Image:
    W, H = 1080, 560
    card = Image.new("RGBA", (W, H), (10, 18, 34, 255))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([4, 4, W - 4, H - 4], radius=26, fill=(13, 23, 44, 255), outline=(56, 189, 248, 160), width=3)

    # foto
    photo = fetch_photo((p.get("transfermarkt") or {}).get("photo"), (196, 244))
    if photo:
        card.paste(rounded(photo, 20), (34, 34), rounded(photo, 20))
    else:
        d.rounded_rectangle([34, 34, 230, 278], radius=20, fill=(30, 41, 66))
        initials = "".join(w[0] for w in p["name"].split()[:2]).upper()
        d.text((132, 156), initials, font=font("black", 56), fill=(148, 163, 184), anchor="mm")

    # logo do clube
    logo_path = CLUBS / f"{slug(p.get('club',''))}.png"
    lx = 254
    if logo_path.is_file():
        logo = rounded(Image.open(logo_path).convert("RGBA").resize((44, 44)), 22)
        card.paste(logo, (lx, 44), logo)
        lx += 56

    d.text((lx, 48), p["name"], font=font("black", 44), fill="white")
    d.text((lx, 104), f"{p.get('club','')}  ·  {p.get('position','')}", font=font("reg", 24), fill=(148, 163, 184))
    birth = p.get("birth_year")
    idade = int(CURRENT) - birth if birth else "?"
    meta = f"{idade} anos  ·  {p.get('foot','-')}  ·  {p.get('height','-')} cm  ·  {round(p.get('minutes_pct') or 0)}% min"
    d.text((lx, 140), meta, font=font("reg", 22), fill=(100, 116, 139))
    if p.get("profile"):
        d.rounded_rectangle([lx, 176, lx + 40 + 16 * len(p["profile"]), 216], radius=20, fill=(8, 51, 68), outline=(34, 211, 238))
        d.text((lx + 20, 196), p["profile"], font=font("bold", 20), fill=(103, 232, 249), anchor="lm")

    # nota
    rating = p.get("rating")
    if rating is not None:
        d.rounded_rectangle([W - 200, 44, W - 46, 138], radius=20, fill=(8, 51, 68), outline=(34, 211, 238), width=2)
        d.text((W - 123, 78), f"{float(rating):.1f}", font=font("black", 52), fill=(103, 232, 249), anchor="mm")
        d.text((W - 123, 116), "NOTA", font=font("bold", 16), fill=(148, 163, 184), anchor="mm")

    # stats com percentil
    y = 288
    d.text((34, y - 18), "DESTAQUES", font=font("bold", 18), fill=(100, 116, 139))
    rows = stat_rows(p)
    bar_x, bar_w = 420, 560
    for label, value, pct in rows:
        y += 38
        d.text((34, y), label, font=font("reg", 21), fill=(226, 232, 240))
        d.text((400, y), value, font=font("bold", 21), fill="white", anchor="rm")
        d.rounded_rectangle([bar_x, y + 4, bar_x + bar_w, y + 18], radius=7, fill=(30, 41, 66))
        fill = bar_w * min(max(pct or 0, 0), 100) / 100
        d.rounded_rectangle([bar_x, y + 4, bar_x + fill, y + 18], radius=7, fill=pct_color(pct))
        d.text((bar_x + bar_w + 16, y), f"{pct:.0f}" if pct is not None else "-", font=font("bold", 18), fill=pct_color(pct))

    d.text((34, H - 34), f"SADA Scout · {league.upper().replace('-', ' ')} {season}", font=font("reg", 16), fill=(71, 85, 105))
    return card.convert("RGB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", required=True)
    ap.add_argument("--player", help="nome do atleta")
    ap.add_argument("--id", dest="player_id", help="player_id exato")
    ap.add_argument("--season", default=CURRENT)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    p = find_player(args.league, args.season, args.player_id or args.player)
    card = build_card(p, args.league, args.season)

    out_dir = ROOT / "exports"
    out_dir.mkdir(exist_ok=True)
    safe = slug(args.player_id or p["name"])
    png_path = out_dir / f"{safe}-card.png"
    pdf_path = Path(args.out) if args.out else out_dir / f"{safe}-card.pdf"

    card.save(png_path)
    c = canvas.Canvas(str(pdf_path), pagesize=(card.width, card.height))
    c.drawImage(ImageReader(card), 0, 0, width=card.width, height=card.height)
    c.showPage()
    c.save()
    print(f"{p['name']} ({p.get('club')}) -> {pdf_path}")


if __name__ == "__main__":
    main()
