from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
XLSX_PATH = ROOT / "Serie A 26.xlsx"
PBIX_PATH = ROOT / "Dashboard - Série A 25-26.pbix"

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
    "esquerdo": "Canhoto",
    "both": "Ambidestro",
    "destro": "Destro",
    "canhoto": "Canhoto",
}


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


def _normalize_foot(value: Any) -> str:
    if value is None:
        return "—"
    text = str(value).strip().lower()
    return FOOT_MAP.get(text, str(value).strip().title())


def _load_from_xlsx() -> pd.DataFrame | None:
    if not XLSX_PATH.exists():
        return None

    xl = pd.ExcelFile(XLSX_PATH)
    if "Tb_SerieC25" in xl.sheet_names:
        df = pd.read_excel(XLSX_PATH, sheet_name="Tb_SerieC25")
        if "Equipe" not in df.columns and "Equipa" in df.columns:
            df = df.rename(columns={"Equipa": "Equipe"})
        return df

    if "Search results (500)" not in xl.sheet_names:
        return None

    raw = pd.read_excel(XLSX_PATH, sheet_name="Search results (500)")
    rename = {
        "Equipa": "Equipe",
        "País de nacionalidade": "Naturalidade",
    }
    df = raw.rename(columns=rename)
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
    df = _dedupe_columns(df)
    mapped_positions = [_map_wyscout_position(v) for v in df.get("Posição", [])]
    df["Posição"] = mapped_positions
    df = df[df["Posição"].notna()].copy()
    if len(df) < 50:
        return None
    return df


def _load_from_pbix() -> pd.DataFrame:
    from pbixray import PBIXRay

    pbix = PBIXRay(str(PBIX_PATH))
    return pbix.get_table("Tb_SerieC25")


def load_players_dataframe() -> pd.DataFrame:
    df = _load_from_xlsx()
    source = "xlsx"
    if df is None and PBIX_PATH.exists():
        df = _load_from_pbix()
        source = "pbix"
    if df is None:
        raise FileNotFoundError("Nenhuma fonte de dados válida encontrada.")

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

    df["Pé"] = df["Pé"].map(_normalize_foot)
    df["NomeExibicao"] = [
        f"{name} ({club})" if club and str(club) != "nan" else str(name)
        for name, club in zip(df["Jogador"], df["Equipe"])
    ]
    df["player_id"] = [
        _slugify(str(row["Jogador"]), str(row.get("Equipe", "")), i)
        for i, row in df.reset_index(drop=True).iterrows()
    ]
    if "Idade" in df.columns:
        df["Nascimento"] = 2026 - pd.to_numeric(df["Idade"], errors="coerce")
    elif "Nascimento" not in df.columns:
        df["Nascimento"] = None

    df.attrs["source"] = source
    return df.reset_index(drop=True)
