from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from .normalize import (
    apply_bonus,
    composite_z,
    normalize_rating_component,
    percentile_rank,
    rank_desc_normalized,
    rank_players,
)
from .profiles import FAMILY_PROFILE_CONFIG, profile_ratings_from_row, profile_ranks_from_row, profile_shares_from_row


ZAG_PROFILES = ["Construtor", "Defensivo", "Híbrido"]

POSITION_FAMILIES: dict[str, dict[str, Any]] = {
    "zagueiros": {
        "label": "Zagueiros",
        "positions": ["Zagueiro"],
        "profiles": ZAG_PROFILES,
        "profile_map": {"construcao": "Construção", "defesa": "Defesa", "perfil": "Perfil"},
    },
    "laterais": {
        "label": "Laterais",
        "positions": ["Lateral Direito", "Lateral Esquerdo"],
        "profiles": ["Defensivo", "Construtor", "Ofensivo", "Vertical", "Híbrido"],
        "profile_map": {"defensivo": "Defensivo", "construtor": "Construtor", "ofensivo": "Ofensivo", "vertical": "Vertical"},
    },
    "meio-campistas": {
        "label": "Meio-campistas",
        "positions": ["Meio-campista"],
        "profiles": ["Contenção", "Construtor", "Box-to-box", "Ofensivo", "Híbrido"],
        "profile_map": {"contencao": "Contenção", "construtor": "Construtor", "boxtobox": "Box-to-box", "ofensivo": "Ofensivo"},
    },
    "extremos": {
        "label": "Extremos",
        "positions": ["Extremo Direito", "Extremo Esquerdo"],
        "profiles": ["Criador", "Meia Ponta", "Vertical", "Híbrido"],
        "profile_map": {"criador": "Criador", "meia_ponta": "Meia Ponta", "vertical": "Vertical"},
    },
    "meias-ofensivos": {
        "label": "Meias Ofensivos",
        "positions": ["Meia Ofensivo"],
        "profiles": ["Armador", "Finalizador", "Híbrido"],
        "profile_map": {"armador": "Armador", "finalizador": "Finalizador"},
    },
    "atacantes": {
        "label": "Atacantes",
        "positions": ["Atacante"],
        "profiles": ["Finalizador", "Alvo", "Móvel", "Híbrido"],
        "profile_map": {"finalizador": "Finalizador", "alvo": "Alvo", "movel": "Móvel"},
    },
}

SCATTER_METRICS = {
    "zagueiros": [
        {"key": "intervencoes", "label": "Intervenções", "field": "Interseções"},
        {"key": "confrontos_of", "label": "Confrontos Ofensivos", "field": "DuelosOf"},
        {"key": "construcao", "label": "Construção", "field": "n_construcao"},
        {"key": "duelo_ar", "label": "Duelo Aéreo", "field": "n_duelo_ar"},
        {"key": "contencao", "label": "Contenção", "field": "n_leitura_def"},
        {"key": "ofensividade", "label": "Ofensividade", "field": "n_conducao"},
        {"key": "passes_prog", "label": "Passes Progressivos", "field": "PassesProg"},
        {"key": "duelos_def", "label": "Duelos Defensivos", "field": "DuelosDef"},
    ],
    "laterais": [
        {"key": "cruzamentos", "label": "Cruzamentos", "field": "Cruz."},
        {"key": "progressao", "label": "Progressão", "field": "Cond.Prog"},
        {"key": "xa", "label": "xA", "field": "xA"},
        {"key": "construcao", "label": "Construção", "field": "n_construcao"},
        {"key": "duelos_def", "label": "Duelos Defensivos", "field": "DuelosDef"},
    ],
    "meio-campistas": [
        {"key": "passes_prog", "label": "Passes Progressivos", "field": "PassesProg"},
        {"key": "xa", "label": "xA", "field": "xA"},
        {"key": "construcao", "label": "Construção", "field": "n_construcao"},
        {"key": "progressao", "label": "Progressão", "field": "Cond.Prog"},
    ],
    "extremos": [
        {"key": "dribles", "label": "Dribles", "field": "Dribles"},
        {"key": "xa", "label": "xA", "field": "xA"},
        {"key": "progressao", "label": "Progressão", "field": "Cond.Prog"},
        {"key": "finalizacao", "label": "Finalizações", "field": "Finalizações"},
    ],
    "meias-ofensivos": [
        {"key": "passes_chave", "label": "Passes Chave", "field": "PassesChave"},
        {"key": "xa", "label": "xA", "field": "xA"},
        {"key": "progressao", "label": "Progressão", "field": "Cond.Prog"},
        {"key": "gols", "label": "Gols", "field": "Gols"},
    ],
    "atacantes": [
        {"key": "gols", "label": "Gols", "field": "Gols"},
        {"key": "finalizacao", "label": "Finalizações", "field": "Finalizações"},
        {"key": "toques_area", "label": "Toques na Área", "field": "ToquesArea"},
        {"key": "progressao", "label": "Progressão", "field": "Cond.Prog"},
    ],
}


@dataclass
class ZagueiroMetrics:
    z_stats: dict[str, float]
    zg_construcao: float
    zg_conducao: float
    zg_duelos_def: float
    zg_duelos_ar: float
    zg_leitura_def: float
    n_conducao: float
    n_construcao: float
    n_duelo_ar: float
    n_duelos_def: float
    n_leitura_def: float
    izg_construtor: float
    izg_combativo: float
    izg_ancora: float
    pct_construtor: float
    pct_combativo: float
    pct_posicional: float
    rating_geral: float
    rating_combativo: float
    rating_construtor: float
    rating_posicional: float
    perfil: str
    rank_geral: int
    rank_combativo: int
    rank_construtor: int
    rank_posicional: int


def _eligible_pool(df: pd.DataFrame, positions: list[str], min_pct: float = 0.2) -> pd.DataFrame:
    return df[(df["Posição"].isin(positions)) & (df["%Minutos"] > min_pct)].copy()


def _z_percentile(pool: pd.DataFrame, field: str, ascending: bool = True) -> pd.Series:
    return percentile_rank(pool[field], ascending=ascending)


def _minmax01(series: pd.Series) -> pd.Series:
    lo, hi = float(series.min()), float(series.max())
    if hi <= lo:
        return pd.Series(0.5, index=series.index)
    return (series - lo) / (hi - lo)


def _feat_col(pool: pd.DataFrame, *candidates: str) -> pd.Series:
    for name in candidates:
        if name in pool.columns:
            return pd.to_numeric(pool[name], errors="coerce").fillna(0)
    raise KeyError(f"Nenhuma coluna encontrada: {candidates}")


def _score_axis(frame: pd.DataFrame) -> pd.Series:
    from sklearn.preprocessing import MinMaxScaler

    scaled = pd.DataFrame(
        MinMaxScaler().fit_transform(frame),
        columns=frame.columns,
        index=frame.index,
    )
    return scaled.mean(axis=1)


def _rescale_rating_band(series: pd.Series, lo: float = 5.0, hi: float = 9.5) -> pd.Series:
    ranked = series.rank(method="average", pct=True)
    return lo + ranked * (hi - lo)


# Construction score: 75% passes (residualized on prog) + 25% condução (cond + duelo)
ZAG_CON_W_PROG = 75 * 55 / 80
ZAG_CON_W_PTF_RES = 75 * 15 / 80
ZAG_CON_W_LONG_RES = 75 * 10 / 80
ZAG_CON_W_COND = 15.0
ZAG_CON_W_DUELO = 10.0


def _blend_eff_vol_percentiles(
    pool: pd.DataFrame,
    eff_field: str,
    vol_field: str,
    *,
    w_eff: float = 0.6,
) -> pd.Series:
    eff = percentile_rank(pool[eff_field].astype(float), ascending=True)
    vol = percentile_rank(pool[vol_field].astype(float), ascending=True)
    return w_eff * eff + (1.0 - w_eff) * vol


def _residualize_on(pool: pd.DataFrame, y: pd.Series, base: pd.Series) -> pd.Series:
    x = base.to_numpy(dtype=float)
    yv = y.to_numpy(dtype=float)
    coef, _, _, _ = np.linalg.lstsq(np.column_stack([np.ones(len(pool)), x]), yv, rcond=None)
    return pd.Series(yv - (coef[0] + coef[1] * x), index=pool.index)


def _zag_construction_score(pool: pd.DataFrame) -> pd.Series:
    blend_prog = _blend_eff_vol_percentiles(pool, "%EffPassProg", "PassesProg")
    blend_ptf = _blend_eff_vol_percentiles(pool, "%EffPassTF", "PTF")
    blend_long = _blend_eff_vol_percentiles(pool, "%EffPassesLng", "PassesLongos")

    ptf_res = percentile_rank(_residualize_on(pool, blend_ptf, blend_prog), ascending=True)
    long_res = percentile_rank(_residualize_on(pool, blend_long, blend_prog), ascending=True)

    blend_cond = percentile_rank(pool["Cond.Prog"].astype(float), ascending=True)

    if "Duelos ofensivos ganhos, %" in pool.columns:
        duelo_eff = percentile_rank(
            pd.to_numeric(pool["Duelos ofensivos ganhos, %"], errors="coerce").fillna(0),
            ascending=True,
        )
    else:
        duelo_eff = percentile_rank(pool["%DuelosOfW"].astype(float), ascending=True)
    duelo_vol = percentile_rank(pool["DuelosOf"].astype(float), ascending=True)
    blend_duelo = 0.6 * duelo_eff + 0.4 * duelo_vol

    return (
        ZAG_CON_W_PROG / 100 * blend_prog
        + ZAG_CON_W_PTF_RES / 100 * ptf_res
        + ZAG_CON_W_LONG_RES / 100 * long_res
        + ZAG_CON_W_COND / 100 * blend_cond
        + ZAG_CON_W_DUELO / 100 * blend_duelo
    )


def _zag_median_bonus(row: pd.Series) -> float:
    return float(
        np.median(
            [row["n_conducao"], row["n_construcao"], row["n_duelo_ar"], row["n_duelos_def"], row["n_leitura_def"]]
        )
        / 100
        * 0.5
    )


def _zag_rating_from_construction_score(row: pd.Series) -> float:
    score = float(row["score_construcao"])
    nota = (5 + score / 100 * 4.5) * (1 + row["%Minutos"] * 0.15)
    return (nota + _zag_median_bonus(row)) * 0.88


def _apply_zag_k3_classification(out: pd.DataFrame) -> None:
    """K=3 on construction vs defense; profile is always one of 3, lean is visual metadata."""
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    con_frame = pd.DataFrame(
        {
            "pprog": _feat_col(out, "Passes progressivos/90", "PassesProg"),
            "plong": _feat_col(out, "Passes longos/90", "PassesLongos"),
            "ptf": _feat_col(out, "Passes para terço final/90", "PTF"),
            "corr": _feat_col(out, "Corridas progressivas/90", "Cond.Prog"),
        }
    )
    def_frame = pd.DataFrame(
        {
            "dd": _feat_col(out, "Duelos defensivos/90", "DuelosDef"),
            "da": _feat_col(out, "Duelos aérios/90", "DuelosAr"),
            "inter": _feat_col(out, "Interseções/90", "Interseções"),
        }
    )

    score_con = _score_axis(con_frame)
    score_def = _score_axis(def_frame)
    out["score_con"] = score_con
    out["score_def"] = score_def
    out["gap_con_def"] = (score_con - score_def).abs()

    coords = np.column_stack([score_con.to_numpy(), score_def.to_numpy()])
    scaler = StandardScaler()
    km = KMeans(n_clusters=3, random_state=42, n_init=30).fit(scaler.fit_transform(coords))
    centers = scaler.inverse_transform(km.cluster_centers_)
    center_df = pd.DataFrame(centers, columns=["score_con", "score_def"])
    gaps = (center_df["score_con"] - center_df["score_def"]).abs()
    hybrid_i = int(gaps.idxmin())
    others = [i for i in range(3) if i != hybrid_i]
    con_i = others[0] if center_df.loc[others[0], "score_con"] > center_df.loc[others[1], "score_con"] else others[1]
    def_i = [i for i in others if i != con_i][0]
    cluster_to_base = {con_i: "Construtor", def_i: "Defensivo", hybrid_i: "Híbrido"}

    profiles: list[str] = []
    leans: list[str | None] = []
    for idx, cluster in enumerate(km.labels_):
        base = cluster_to_base[int(cluster)]
        profiles.append(base)
        if base != "Híbrido":
            leans.append(None)
            continue
        gap = float(score_con.iloc[idx] - score_def.iloc[idx])
        leans.append("+ Construtor" if gap >= 0 else "+ Defensivo")

    out["perfil"] = profiles
    out["hybrid_lean"] = leans


def _zag_rating_perfil(row: pd.Series) -> float:
    con = float(row["rating_construcao"])
    def_ = float(row["rating_defesa"])
    if row["perfil"] == "Construtor":
        return 0.85 * con + 0.15 * def_
    if row["perfil"] == "Defensivo":
        return 0.15 * con + 0.85 * def_
    if row.get("hybrid_lean") == "+ Construtor":
        return 0.55 * con + 0.45 * def_
    return 0.45 * con + 0.55 * def_


def _compute_zag_indices(pool: pd.DataFrame) -> pd.DataFrame:
    out = pool.copy()

    z_fields = {
        "Z_DuelosOf": ("DuelosOf", True),
        "Z_%DuelosOf": ("%DuelosOfW", True),
        "Z_CondProg": ("Cond.Prog", True),
        "Z_PassesProg": ("PassesProg", True),
        "Z_%PassesProg": ("%PProg", True),
        "Z_PTF": ("PTF", True),
        "Z_%PTF": ("%PPTF", True),
        "Z_PasseLng": ("PassesLongos", True),
        "Z_%PasseLng": ("%PassesLng", True),
        "Z_DuelosDef": ("DuelosDef", True),
        "Z_%DuelosDef": ("%DuelosDefW", True),
        "Z_DuelosAr": ("DuelosAr", True),
        "Z_%DuelosAr": ("%DuelosAr", True),
        "Z_Intersec": ("Interseções", True),
        "Z_ILD": ("LeituraDef.", True),
    }

    for z_name, (field, asc) in z_fields.items():
        out[z_name] = _z_percentile(out, field, ascending=asc)

    def zg_construcao_row(row: pd.Series) -> float:
        v1 = row["CompPassesProg"]
        v2 = row["CompBL"]
        v3 = row["CompPTF"]
        pools = [out["CompPassesProg"], out["CompBL"], out["CompPTF"]]
        return composite_z([v1, v2, v3], pools, [0.3, 0.2, 0.5])

    def zg_conducao_row(row: pd.Series) -> float:
        v1 = row["Cond.Prog"]
        v2 = row["DuelosOf"] * row["%DuelosOfW"]
        pools = [out["Cond.Prog"], out["DuelosOf"] * out["%DuelosOfW"]]
        return composite_z([v1, v2], pools, [0.95, 0.05])

    def zg_duelos_def_row(row: pd.Series) -> float:
        return composite_z(
            [row["EffDuelosDef"], row["DuelosDef"]],
            [out["EffDuelosDef"], out["DuelosDef"]],
            [0.6, 0.4],
        )

    def zg_duelos_ar_row(row: pd.Series) -> float:
        return composite_z(
            [row["DuelosAr"], row["%DuelosAr"]],
            [out["DuelosAr"], out["%DuelosAr"]],
            [0.45, 0.55],
        )

    def zg_leitura_row(row: pd.Series) -> float:
        return composite_z(
            [row["LeituraDef."], row["Interseções"]],
            [out["LeituraDef."], out["Interseções"]],
            [0.25, 0.75],
        )

    out["ZG_Construção"] = out.apply(zg_construcao_row, axis=1)
    out["ZG_Condução2"] = out.apply(zg_conducao_row, axis=1)
    out["ZG_DuelosDefensivo"] = out.apply(zg_duelos_def_row, axis=1)
    out["ZG_DuelosAr"] = out.apply(zg_duelos_ar_row, axis=1)
    out["ZG_LeituraDefensiva2"] = out.apply(zg_leitura_row, axis=1)

    out["n_conducao"] = rank_desc_normalized(out["ZG_Condução2"])
    out["n_construcao"] = rank_desc_normalized(out["ZG_Construção"])
    out["n_duelo_ar"] = rank_desc_normalized(out["%DuelosAr"] * out["DuelosAr"])
    out["n_duelos_def"] = rank_desc_normalized(out["ZG_DuelosDefensivo"])
    out["n_leitura_def"] = rank_desc_normalized(out["ZG_LeituraDefensiva2"])

    out["izg_construtor"] = out["ZG_Construção"] * 0.8 + out["ZG_Condução2"] * 0.2 + 2
    out["izg_combativo"] = out["ZG_DuelosDefensivo"] + 2
    out["izg_ancora"] = (out["ZG_DuelosAr"] * 0.5 + out["ZG_LeituraDefensiva2"] * 0.5 + 2) * 1.05

    total_profile = out["izg_construtor"] + out["izg_combativo"] + out["izg_ancora"]
    out["pct_construtor"] = out["izg_construtor"] / total_profile
    out["pct_combativo"] = out["izg_combativo"] / total_profile
    out["pct_posicional"] = out["izg_ancora"] / total_profile

    def rating_from_weights(row: pd.Series, duelo_def_weight: float, duelo_ar_weight: float, leitura_weight: float, divisor: float, scale: float, profile_col: str | None = None, profile_mix: float = 0.0) -> float:
        m_bases = [
            row["Z_%DuelosOf"] * 0.6 + row["Z_DuelosOf"] * 0.4,
            row["Z_CondProg"],
            row["Z_%PassesProg"] * 0.6 + row["Z_PassesProg"] * 0.4,
            row["Z_%PTF"] * 0.6 + row["Z_PTF"] * 0.4,
            row["Z_%PasseLng"] * 0.6 + row["Z_PasseLng"] * 0.4,
            row["Z_%DuelosDef"] * 0.6 + row["Z_DuelosDef"] * 0.4,
            row["Z_%DuelosAr"] * 0.6 + row["Z_DuelosAr"] * 0.4,
            row["Z_Intersec"] * 0.65 + row["Z_ILD"] * 0.35,
        ]
        m_norm = [normalize_rating_component(apply_bonus(v)) for v in m_bases]
        construcao = m_norm[2] * 0.4 + m_norm[3] * 0.4 + m_norm[4] * 0.2
        conducao = m_norm[1] * 0.7 + m_norm[0] * 0.3
        conj = (
            construcao * 1.25
            + conducao
            + m_norm[5] * duelo_def_weight
            + m_norm[6] * duelo_ar_weight
            + m_norm[7] * leitura_weight
        ) / divisor
        nota = conj * (1 + row["%Minutos"] * 0.15)
        median_bonus = _zag_median_bonus(row)
        indice = (nota + median_bonus) * scale
        if profile_col and profile_mix:
            nota_perfil = (5 + 1.125 * row[profile_col]) * 0.88
            return indice * (1 - profile_mix) + nota_perfil * profile_mix
        return indice

    out["rating_construcao_legacy_raw"] = out.apply(
        lambda r: rating_from_weights(r, 0.5, 0.5, 0.5, 5, 0.88),
        axis=1,
    )
    out["score_construcao"] = _zag_construction_score(out)
    out["rating_construcao_raw"] = out.apply(_zag_rating_from_construction_score, axis=1)
    out["rating_defesa_raw"] = out.apply(
        lambda r: rating_from_weights(r, 2.5, 3.0, 3.0, 10, 0.88),
        axis=1,
    )
    out["rating_construcao"] = _rescale_rating_band(out["rating_construcao_raw"])
    out["rating_construcao_legacy"] = _rescale_rating_band(out["rating_construcao_legacy_raw"])
    out["rating_defesa"] = _rescale_rating_band(out["rating_defesa_raw"])

    _apply_zag_k3_classification(out)

    out["rating_perfil"] = out.apply(_zag_rating_perfil, axis=1)
    out["rating_geral"] = out["rating_perfil"]

    # Legacy columns kept for internal diagnostics only
    out["rating_combativo"] = out["rating_defesa"]
    out["rating_construtor"] = out["rating_construcao"]
    out["rating_posicional"] = out["rating_defesa"]

    out["rank_geral"] = rank_players(out["rating_geral"])
    out["rank_construcao"] = rank_players(out["rating_construcao"])
    out["rank_defesa"] = rank_players(out["rating_defesa"])
    out["rank_perfil"] = rank_players(out["rating_perfil"])
    out["rank_combativo"] = out["rank_defesa"]
    out["rank_construtor"] = out["rank_construcao"]
    out["rank_posicional"] = out["rank_defesa"]
    return out


def _compute_generic_ratings(pool: pd.DataFrame, prefix: str) -> pd.DataFrame:
    out = pool.copy()
    offensive = out["DuelosOf"] + out["Dribles"] + out["ToquesArea"] + out["Finalizações"]
    construction = out["PassesProg"] * out["%EffPassProg"] + out["PTF"] * out["%EffPassTF"]
    defensive = out["DuelosDef"] * out["%DuelosDefW"] + out["Interseções"]
    progression = out["Cond.Prog"]

    out["off_pct"] = percentile_rank(offensive, ascending=True)
    out["con_pct"] = percentile_rank(construction, ascending=True)
    out["def_pct"] = percentile_rank(defensive, ascending=True)
    out["prog_pct"] = percentile_rank(progression, ascending=True)

    out["rating_geral"] = (
        5
        + (
            out["off_pct"] * 0.2
            + out["con_pct"] * 0.3
            + out["def_pct"] * 0.3
            + out["prog_pct"] * 0.2
        )
        * 0.045
        * (1 + out["%Minutos"] * 0.15)
        * 0.83
    )
    out["rating_combativo"] = out["rating_geral"] * 0.98
    out["rating_construtor"] = out["rating_geral"] * 1.02
    out["rating_posicional"] = out["rating_geral"] * 0.99
    out["n_conducao"] = out["prog_pct"]
    out["n_construcao"] = out["con_pct"]
    out["n_duelo_ar"] = percentile_rank(out["DuelosAr"] * out["%DuelosAr"], ascending=True)
    out["n_duelos_def"] = out["def_pct"]
    out["n_leitura_def"] = percentile_rank(out["LeituraDef."], ascending=True)
    out["pct_construtor"] = out["con_pct"] / 100
    out["pct_combativo"] = out["def_pct"] / 100
    out["pct_posicional"] = out["prog_pct"] / 100
    out["perfil"] = prefix
    out["rank_geral"] = rank_players(out["rating_geral"])
    out["rank_combativo"] = rank_players(out["rating_combativo"])
    out["rank_construtor"] = rank_players(out["rating_construtor"])
    out["rank_posicional"] = rank_players(out["rating_posicional"])
    return out


def compute_family_metrics(df: pd.DataFrame, family_key: str) -> pd.DataFrame:
    family = POSITION_FAMILIES[family_key]
    pool = _eligible_pool(df, family["positions"])
    if pool.empty:
        return pool
    if family_key == "zagueiros":
        return _compute_zag_indices(pool)
    return FAMILY_PROFILE_CONFIG[family_key].compute_indices(pool)


def medal_for_rank(rank: int, pool_size: int) -> str | None:
    if pool_size <= 0:
        return None
    pct = rank / pool_size
    if pct <= 0.1:
        return "gold"
    if pct <= 0.25:
        return "silver"
    if pct <= 0.4:
        return "bronze"
    return None


def build_player_payload(row: pd.Series, family_key: str, pool_size: int) -> dict[str, Any]:
    family = POSITION_FAMILIES[family_key]
    tendencies = {
        "construcao": round(float(row.get("n_construcao", 0)), 0),
        "ofensividade": round(float(row.get("n_conducao", 0)), 0),
        "def1v1": round(float(row.get("n_duelos_def", 0)), 0),
        "contencao": round(float(row.get("n_leitura_def", 0)), 0),
        "duelo_aereo": round(float(row.get("n_duelo_ar", 0)), 0),
    }
    profile_shares = profile_shares_from_row(row, family_key)
    profile_ratings = profile_ratings_from_row(row, family_key)
    profile_rank_map = profile_ranks_from_row(row, family_key)
    first_rank = next(iter(profile_rank_map.values()), int(row.get("rank_geral", pool_size)))

    aspects = {
        "defensivos": [
            {"label": "Confrontos", "grade": _grade_from_pct(row.get("n_duelos_def", 0)), "medal": medal_for_rank(first_rank, pool_size)},
            {"label": "Duelos Aéreos", "grade": _grade_from_pct(row.get("n_duelo_ar", 0)), "medal": medal_for_rank(first_rank, pool_size)},
            {"label": "Intervenções", "grade": _grade_from_pct(row.get("n_leitura_def", 0)), "medal": medal_for_rank(int(row.get("rank_geral", pool_size)), pool_size)},
        ],
        "construcao": [
            {"label": "Passes Verticais", "grade": _grade_from_pct(row.get("n_construcao", 0)), "medal": medal_for_rank(first_rank, pool_size)},
            {"label": "PCF", "grade": _grade_from_pct(row.get("n_construcao", 0) * 0.9), "medal": medal_for_rank(first_rank, pool_size)},
            {"label": "Passes Longos", "grade": _grade_from_pct(row.get("n_construcao", 0) * 0.8), "medal": None},
        ],
        "ofensivos": [
            {"label": "Ball Security", "grade": _grade_from_pct(row.get("n_conducao", 0) * 0.7), "medal": None},
            {"label": "Progressão", "grade": _grade_from_pct(row.get("n_conducao", 0)), "medal": medal_for_rank(first_rank, pool_size)},
        ],
    }

    ratings = {"geral": round(float(row["rating_geral"]), 1), **profile_ratings}
    ranks = {"geral": int(row["rank_geral"]), **profile_rank_map}

    payload: dict[str, Any] = {
        "player_id": row["player_id"],
        "name": row["Jogador"],
        "club": row["Equipe"],
        "label": row["NomeExibicao"],
        "position": row["Posição"],
        "position_family": family_key,
        "nationality": row.get("Naturalidade"),
        "birth_year": int(row["Nascimento"]) if pd.notna(row.get("Nascimento")) else None,
        "height": int(row["Altura"]) if pd.notna(row.get("Altura")) else None,
        "foot": row.get("Pé"),
        "minutes": int(row.get("Minutos jogados:", 0) or 0),
        "minutes_pct": round(float(row.get("%Minutos", 0) or 0) * 100, 1),
        "goals": int(row.get("Gols", 0) or 0),
        "assists": int(row.get("Assist", 0) or 0),
        "rating": round(float(row["rating_geral"]), 1),
        "ratings": ratings,
        "ranks": ranks,
        "profile": row["perfil"],
        "profile_shares": profile_shares,
        "tendencies": tendencies,
        "aspects": aspects,
        "profiles_available": family["profiles"],
        "scatter": {m["key"]: float(row.get(m["field"], 0) or 0) for m in SCATTER_METRICS[family_key]},
    }
    if family_key == "zagueiros":
        lean = row.get("hybrid_lean")
        payload["hybrid_lean"] = lean if pd.notna(lean) and lean else None
    return payload


def _grade_from_pct(pct: Any) -> str:
    value = float(pct or 0)
    if value >= 85:
        return "A"
    if value >= 75:
        return "B+"
    if value >= 65:
        return "B"
    if value >= 55:
        return "B-"
    if value >= 45:
        return "C+"
    if value >= 35:
        return "C"
    if value >= 25:
        return "C-"
    return "D"
