from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PBIX_PATH = ROOT / "Dashboard - Série A 25-26.pbix"

from engine.estaduais_championship import LEVEL_IDS, classify_estadual_level, competition_level
from engine.leagues import LEAGUES, LeagueConfig
from engine.wyscout_i18n import rename_english_wyscout_columns

# Wyscout parts are shared by the full estaduais pool and each level rebuild.
_XLSX_FRAME_CACHE: dict[tuple[str, ...], pd.DataFrame] = {}

WYSCOUT_TO_POSITION: dict[str, str] = {
    "GK": "Goleiro",
    "RCB": "Zagueiro",
    "LCB": "Zagueiro",
    "CB": "Zagueiro",
    "RB": "Lateral Direito",
    "RWB": "Lateral Direito",
    "LB": "Lateral Esquerdo",
    "LWB": "Lateral Esquerdo",
    "DMF": "Meio-campista",
    "LDMF": "Meio-campista",
    "RDMF": "Meio-campista",
    "LCMF": "Meio-campista",
    "RCMF": "Meio-campista",
    "AMF": "Meia Ofensivo",
    "LAMF": "Meia Ofensivo",
    "RAMF": "Meia Ofensivo",
    "RW": "Extremo Direito",
    "RWF": "Extremo Direito",
    "LW": "Extremo Esquerdo",
    "LWF": "Extremo Esquerdo",
    "CF": "Atacante",
}

FOOT_MAP = {
    "direito": "Destro",
    "right": "Destro",
    "r": "Destro",
    "destro": "Destro",
    "esquerdo": "Canhoto",
    "left": "Canhoto",
    "l": "Canhoto",
    "canhoto": "Canhoto",
    "both": "Ambidestro",
    "either": "Ambidestro",
    "ambos": "Ambidestro",
    "ambidestro": "Ambidestro",
}

# Manual corrections when Wyscout primary position is stale vs current role.
PLAYER_POSITION_OVERRIDES: dict[str, str] = {
    "Nicolás Acevedo": "Meio-campista",
    "N. Acevedo": "Meio-campista",
}


def _existing_player_ids(league_id: str) -> dict[tuple[str, str], list[str]]:
    """Reuse ids already published for the same name and club."""
    path = ROOT / "data" / league_id / "players.json"
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    mapping: dict[tuple[str, str], list[str]] = {}
    for player in payload.get("players", []):
        name = str(player.get("name") or "").strip().casefold()
        club = str(player.get("club") or "").strip().casefold()
        player_id = str(player.get("player_id") or "")
        if not name or not player_id:
            continue
        mapping.setdefault((name, club), []).append(player_id)
    return mapping


def _slugify(name: str, club: str, index: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", f"{name}-{club}".lower()).strip("-")
    return f"{base}-{index}"


def _map_wyscout_position(raw: str | None) -> str | None:
    if not raw:
        return None
    primary = str(raw).split(",")[0].strip()
    if primary in WYSCOUT_TO_POSITION:
        return WYSCOUT_TO_POSITION[primary]
    lowered = str(raw).lower()
    if "zagueiro" in lowered or primary in {"RCB", "LCB", "CB"}:
        return "Zagueiro"
    return raw if raw in {
        "Zagueiro",
        "Lateral Direito",
        "Lateral Esquerdo",
        "Meio-campista",
        "Meia Ofensivo",
        "Extremo Direito",
        "Extremo Esquerdo",
        "Atacante",
        "Goleiro",
    } else None


def _dedupe_columns(df: pd.DataFrame) -> pd.DataFrame:
    seen: dict[str, int] = {}
    new_cols = []
    for col in df.columns:
        name = str(col)
        if name not in seen:
            seen[name] = 0
            new_cols.append(name)
        else:
            seen[name] += 1
            new_cols.append(f"{name}__{seen[name]}")
    df = df.copy()
    df.columns = new_cols
    for name in list(seen.keys()):
        dupes = [c for c in df.columns if c == name or c.startswith(f"{name}__")]
        if len(dupes) > 1:
            combined = df[dupes[0]]
            for extra in dupes[1:]:
                combined = combined.fillna(df[extra])
            df[name] = combined
            df = df.drop(columns=[c for c in dupes if c != name])
    return df


def _normalize_foot(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().lower()
    if text in {"", "nan", "none", "unknown", "n/a", "—", "-"}:
        return None
    return FOOT_MAP.get(text)


def _xlsx_sources(xlsx: Path | list[Path]) -> list[Path]:
    if isinstance(xlsx, Path):
        return [xlsx]
    return list(xlsx)


def _alias_wyscout_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Align newer Wyscout headers with the names the rating engine expects."""
    aliases = {
        "Minutos jogados": "Minutos jogados:",
        "Jogos disputados": "Partidas jogadas",
        "Minutes played": "Minutos jogados:",
        "Matches played": "Partidas jogadas",
    }
    rename = {src: dst for src, dst in aliases.items() if src in df.columns and dst not in df.columns}
    if not rename:
        return df
    return df.rename(columns=rename)


def _read_wyscout_frame(xlsx_path: Path) -> pd.DataFrame | None:
    if not xlsx_path.exists():
        return None

    xl = pd.ExcelFile(xlsx_path)
    if "Tb_SerieC25" in xl.sheet_names:
        df = pd.read_excel(xlsx_path, sheet_name="Tb_SerieC25")
        if "Equipe" not in df.columns and "Equipa" in df.columns:
            df = df.rename(columns={"Equipa": "Equipe"})
        return _alias_wyscout_columns(df)

    sheet = next((name for name in xl.sheet_names if str(name).startswith("Search results")), None)
    if sheet is None:
        return None

    raw = pd.read_excel(xlsx_path, sheet_name=sheet)
    raw = rename_english_wyscout_columns(raw)
    rename = {
        "Equipa": "Equipe",
        "Jogador": "Jogador",
    }
    if "Naturalidade" not in raw.columns and "País de nacionalidade" in raw.columns:
        rename["País de nacionalidade"] = "Naturalidade"
    df = raw.rename(columns={k: v for k, v in rename.items() if k in raw.columns})
    if "Jogador" not in df.columns and "Player" in df.columns:
        df = df.rename(columns={"Player": "Jogador"})
    if "Equipe" not in df.columns and "Equipa dentro de um período de tempo seleccionado" in df.columns:
        df = df.rename(columns={"Equipa dentro de um período de tempo seleccionado": "Equipe"})
    # Drop duplicate Equipe columns from Wyscout export
    equipe_cols = [i for i, c in enumerate(df.columns) if c == "Equipe"]
    if len(equipe_cols) > 1:
        keep = equipe_cols[0]
        drop = [df.columns[i] for i in equipe_cols[1:]]
        df = df.drop(columns=drop)
        cols = list(df.columns)
        cols[keep] = "Equipe"
        df.columns = cols
    return _alias_wyscout_columns(_dedupe_columns(df))


def _dedupe_players(df: pd.DataFrame) -> pd.DataFrame:
    """Wyscout caps each export at 500 rows, so PT1/PT2 overlap around the cut."""
    keys = [
        column
        for column in ("Jogador", "Equipe", "Campeonato", "Equipa dentro de um período de tempo seleccionado")
        if column in df.columns
    ]
    if "Jogador" not in keys:
        return df
    out = df.copy()
    if "Minutos jogados:" in out.columns:
        out["_keep_minutes"] = pd.to_numeric(out["Minutos jogados:"], errors="coerce").fillna(-1)
        out = out.sort_values("_keep_minutes", ascending=False, kind="mergesort")
    out = out.drop_duplicates(subset=keys, keep="first")
    if "_keep_minutes" in out.columns:
        out = out.drop(columns=["_keep_minutes"])
    return out.reset_index(drop=True)


def _load_from_xlsx(xlsx: Path | list[Path]) -> pd.DataFrame | None:
    paths = _xlsx_sources(xlsx)
    key = tuple(str(path.resolve()) for path in paths)
    cached = _XLSX_FRAME_CACHE.get(key)
    if cached is not None:
        return cached.copy()

    frames = []
    for path in paths:
        frame = _read_wyscout_frame(path)
        if frame is not None and len(frame):
            frames.append(frame)
    if not frames:
        return None

    df = _dedupe_players(pd.concat(frames, ignore_index=True))
    df = _dedupe_columns(df)
    mapped_positions = [_map_wyscout_position(v) for v in df.get("Posição", [])]
    df["Posição"] = mapped_positions
    df = df[df["Posição"].notna()].copy()
    if len(df) < 50:
        return None
    _XLSX_FRAME_CACHE[key] = df.copy()
    return df


def _load_from_pbix() -> pd.DataFrame:
    from pbixray import PBIXRay

    pbix = PBIXRay(str(PBIX_PATH))
    return pbix.get_table("Tb_SerieC25")


def load_players_dataframe(
    league_id: str = "serie-a",
    *,
    xlsx_override: list[Path] | None = None,
) -> pd.DataFrame:
    league = LEAGUES.get(league_id)
    if not league:
        raise ValueError(f"Liga desconhecida: {league_id}")

    xlsx_source = xlsx_override if xlsx_override is not None else league["xlsx"]
    df = _load_from_xlsx(xlsx_source)
    source = "xlsx"
    if df is None and league_id == "serie-a" and PBIX_PATH.exists():
        df = _load_from_pbix()
        source = "pbix"
    if df is None:
        raise FileNotFoundError(f"Nenhuma fonte válida para {league['label']}: {league['xlsx']}")

    df = df.copy()
    df = _dedupe_columns(df)
    if "Equipe" not in df.columns and "Equipa" in df.columns:
        df = df.rename(columns={"Equipa": "Equipe"})
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
    equipe_col = "Equipe"
    if equipe_col not in df.columns:
        for col in df.columns:
            if str(col).lower().startswith("equip"):
                equipe_col = col
                df = df.rename(columns={col: "Equipe"})
                break

    period_club = "Equipa dentro de um período de tempo seleccionado"
    estadual_pool = league_id in LEVEL_IDS or league_id == "estaduais"
    if period_club in df.columns and estadual_pool:
        period_values = df[period_club].map(lambda value: "" if pd.isna(value) else str(value).strip())
        has_period = period_values.ne("")
        df.loc[has_period, "Equipe"] = period_values.loc[has_period]
    elif period_club in df.columns:
        def _blank_club(value: Any) -> bool:
            return pd.isna(value) or str(value).strip().lower() in {"", "nan", "none"}

        missing_club = df["Equipe"].map(_blank_club)
        df.loc[missing_club, "Equipe"] = df.loc[missing_club, period_club]
    df["Equipe"] = df["Equipe"].map(lambda value: "" if pd.isna(value) else str(value).strip())

    if league_id in LEVEL_IDS and "Campeonato" in df.columns:
        levels = df["Campeonato"].map(lambda value: competition_level(str(value)) or "")
        before = len(df)
        df = df.loc[levels.eq(league_id)].copy()
        print(f"  Filtro {league_id} por campeonato: {len(df)} de {before} linhas")
        if df.empty:
            raise FileNotFoundError(f"Nenhum campeonato classificado em {league['label']}")
    elif league_id in LEVEL_IDS:
        levels = df["Equipe"].map(classify_estadual_level)
        before = len(df)
        df = df.loc[levels.eq(league_id)].copy()
        print(f"  Filtro {league_id}: {len(df)} de {before} linhas Wyscout")
        if df.empty:
            raise FileNotFoundError(f"Nenhum clube classificado em {league['label']}")

    df["Pé"] = df["Pé"].map(_normalize_foot)
    df["NomeExibicao"] = [
        f"{name} ({club})" if club and str(club) != "nan" else str(name)
        for name, club in zip(df["Jogador"], df["Equipe"])
    ]
    def _player_id(name: str, club: str, index: int) -> str:
        slug = _slugify(name, club, index)
        return slug if league_id == "serie-a" else f"{league_id}-{slug}"

    existing_ids = _existing_player_ids(league_id)
    used_ids: set[str] = set()
    assigned_ids: list[str] = []
    for i, row in df.reset_index(drop=True).iterrows():
        name = str(row["Jogador"])
        club = str(row.get("Equipe", ""))
        key = (name.strip().casefold(), club.strip().casefold())
        pool = existing_ids.get(key, [])
        chosen: str | None = None
        while pool:
            candidate = pool.pop(0)
            if candidate not in used_ids:
                chosen = candidate
                break
        if chosen is None:
            chosen = _player_id(name, club, int(i))
            suffix = 2
            while chosen in used_ids:
                chosen = f"{_player_id(name, club, int(i))}-{suffix}"
                suffix += 1
        used_ids.add(chosen)
        assigned_ids.append(chosen)
    df["player_id"] = assigned_ids
    for name, position in PLAYER_POSITION_OVERRIDES.items():
        mask = df["Jogador"].astype(str).str.strip() == name
        if mask.any():
            df.loc[mask, "Posição"] = position
    if "Idade" in df.columns:
        df["Nascimento"] = 2026 - pd.to_numeric(df["Idade"], errors="coerce")
    elif "Nascimento" not in df.columns:
        df["Nascimento"] = None

    df.attrs["source"] = source
    df.attrs["league_id"] = league_id
    df.attrs["league_label"] = league["label"]
    df.attrs["season"] = league["season"]
    return df.reset_index(drop=True)
