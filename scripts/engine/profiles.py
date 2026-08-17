from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import pandas as pd

from .normalize import composite_z, percentile_rank, rank_players


@dataclass(frozen=True)
class ProfileSpec:
    key: str
    label: str
    dax_name: str


@dataclass(frozen=True)
class FamilyProfileConfig:
    threshold: float
    profiles: tuple[ProfileSpec, ...]
    compute_indices: Callable[[pd.DataFrame], pd.DataFrame]


def _block(pool: pd.DataFrame, row: pd.Series, specs: list[tuple[list[tuple[str, float]], list[float]]]) -> float:
    """Average of composite_z blocks (each block = weighted medidas)."""
    scores = []
    for fields, weights in specs:
        values = [row[f] for f, _ in fields]
        pools = [pool[f] for f, _ in fields]
        w = [w for _, w in fields]
        scores.append(composite_z(values, pools, w))
    return sum(scores) / len(scores) if scores else 0.0


def _add_geral_rating(out: pd.DataFrame) -> pd.DataFrame:
    offensive = out["DuelosOf"] + out["Dribles"] + out["ToquesArea"] + out["Finalizações"]
    construction = out["PassesProg"] * out["%EffPassProg"] + out["PTF"] * out["%EffPassTF"]
    defensive = out["DuelosDef"] * out["%DuelosDefW"] + out["Interseções"]
    progression = out["Cond.Prog"]
    out["off_pct"] = percentile_rank(offensive, ascending=True)
    out["con_pct"] = percentile_rank(construction, ascending=True)
    out["def_pct"] = percentile_rank(defensive, ascending=True)
    out["prog_pct"] = percentile_rank(progression, ascending=True)
    out["rating_geral"] = (
        5 + (out["off_pct"] * 0.2 + out["con_pct"] * 0.3 + out["def_pct"] * 0.3 + out["prog_pct"] * 0.2) * 0.045
    ) * (1 + out["%Minutos"] * 0.15) * 0.83
    out["rank_geral"] = rank_players(out["rating_geral"])
    return out


def _attach_shares(out: pd.DataFrame, index_cols: list[str], prefix: str = "pct_idx_") -> pd.DataFrame:
    total = out[index_cols].sum(axis=1).replace(0, 1)
    for col in index_cols:
        key = col.replace("idx_", "")
        out[f"{prefix}{key}"] = out[col] / total
    return out


def _resolve_profile(
    row: pd.Series,
    specs: list[ProfileSpec],
    threshold: float,
    prefix: str = "pct_idx_",
) -> str:
    shares = {spec.key: float(row.get(f"{prefix}{spec.key}", 0)) for spec in specs}
    ordered = sorted(shares.items(), key=lambda item: item[1], reverse=True)
    if len(ordered) < 2:
        return specs[0].label
    if ordered[0][1] - ordered[1][1] >= threshold:
        return next(spec.label for spec in specs if spec.key == ordered[0][0])
    return "Híbrido"


def _attach_tendencies(out: pd.DataFrame) -> pd.DataFrame:
    out["n_construcao"] = percentile_rank(out.get("blk_construcao", out["CompPassesProg"]), ascending=True)
    out["n_conducao"] = percentile_rank(out.get("blk_conducao", out["Cond.Prog"]), ascending=True)
    out["n_duelos_def"] = percentile_rank(out.get("blk_duelos_def", out["EffDuelosDef"]), ascending=True)
    out["n_leitura_def"] = percentile_rank(out.get("blk_leitura", out["LeituraDef."]), ascending=True)
    out["n_duelo_ar"] = percentile_rank(out["DuelosAr"] * out["%DuelosAr"], ascending=True)
    return out


def _finalize_indices(out: pd.DataFrame, index_cols: list[str], profile_keys: list[str]) -> pd.DataFrame:
    for idx_col, key in zip(index_cols, profile_keys):
        out[f"rating_idx_{key}"] = 5 + percentile_rank(out[idx_col], ascending=True) * 0.045 * 0.88 * (1 + out["%Minutos"] * 0.15)
        out[f"rank_idx_{key}"] = rank_players(out[f"rating_idx_{key}"])
    return out


def _compute_laterais_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    out = pool.copy()

    def construcao_row(row: pd.Series) -> float:
        return _block(out, row, [([("CompPassesProg", 0.5), ("CompPTF", 0.5)], [1.0])])

    def duelos_def_row(row: pd.Series) -> float:
        return composite_z([row["EffDuelosDef"], row["DuelosDef"]], [out["EffDuelosDef"], out["DuelosDef"]], [0.65, 0.35])

    def leitura_row(row: pd.Series) -> float:
        return composite_z([row["LeituraDef."]], [out["LeituraDef."]], [1.0])

    def presenca_row(row: pd.Series) -> float:
        return composite_z([row["ToquesArea"], row["AçõesAtW"]], [out["ToquesArea"], out["AçõesAtW"]], [0.5, 0.5])

    def cruz_row(row: pd.Series) -> float:
        comp = out["Cruz."] * out["%EffCruz."]
        val = row["Cruz."] * row["%EffCruz."]
        return composite_z([val], [comp], [1.0])

    def progressao_row(row: pd.Series) -> float:
        return composite_z([row["Acelerações"], row["Cond.Prog"]], [out["Acelerações"], out["Cond.Prog"]], [0.6, 0.4])

    def conducao_row(row: pd.Series) -> float:
        d_of = row["DuelosOf"] * row["%DuelosOfW"]
        pool_of = out["DuelosOf"] * out["%DuelosOfW"]
        return composite_z([row["Dribles"], d_of], [out["Dribles"], pool_of], [0.5, 0.5])

    out["blk_construcao"] = out.apply(construcao_row, axis=1)
    out["blk_duelos_def"] = out.apply(duelos_def_row, axis=1)
    out["blk_leitura"] = out.apply(leitura_row, axis=1)
    out["blk_presenca"] = out.apply(presenca_row, axis=1)
    out["blk_cruz"] = out.apply(cruz_row, axis=1)
    out["blk_progressao"] = out.apply(progressao_row, axis=1)
    out["blk_conducao"] = out.apply(conducao_row, axis=1)

    out["idx_construtor"] = (out["blk_construcao"] + 2) * 0.95
    out["idx_defensivo"] = out["blk_duelos_def"] * 0.65 + out["blk_leitura"] * 0.35 + 2
    out["idx_ofensivo"] = (out["blk_presenca"] * 0.75 + out["blk_cruz"] * 0.25) + 2
    out["idx_vertical"] = out["blk_progressao"] * 0.75 + out["blk_conducao"] * 0.125 + out["blk_presenca"] * 0.125 + 2

    index_cols = ["idx_construtor", "idx_defensivo", "idx_vertical", "idx_ofensivo"]
    keys = ["construtor", "defensivo", "vertical", "ofensivo"]
    _attach_shares(out, index_cols)
    specs = FAMILY_PROFILE_CONFIG["laterais"].profiles
    out["perfil"] = out.apply(lambda r: _resolve_profile(r, list(specs), 0.03, "pct_idx_"), axis=1)
    out = _add_geral_rating(out)
    out = _attach_tendencies(out)
    return _finalize_indices(out, index_cols, keys)


def _compute_meio_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    out = pool.copy()

    def construcao_row(row: pd.Series) -> float:
        return composite_z(
            [row["CompPassesProg"], row["CompBL"], row["CompPTF"], row["PasseAreaW"]],
            [out["CompPassesProg"], out["CompBL"], out["CompPTF"], out["PasseAreaW"]],
            [0.35, 0.25, 0.3, 0.1],
        )

    def distribuicao_row(row: pd.Series) -> float:
        comp = out["CompPasse"]
        return composite_z([row["CompPasse"], row["RecPasse"]], [comp, out["RecPasse"]], [0.7, 0.3])

    def duelos_def_row(row: pd.Series) -> float:
        return composite_z([row["EffDuelosDef"], row["DuelosDef"]], [out["EffDuelosDef"], out["DuelosDef"]], [0.6, 0.4])

    def leitura_row(row: pd.Series) -> float:
        return composite_z([row["LeituraDef."], row["Interseções"]], [out["LeituraDef."], out["Interseções"]], [0.3, 0.7])

    def duelo_ar_row(row: pd.Series) -> float:
        return composite_z([row["DuelosAr"], row["%DuelosAr"]], [out["DuelosAr"], out["%DuelosAr"]], [0.45, 0.55])

    def finalizacao_row(row: pd.Series) -> float:
        fin = row["Finalizações"] * row["%EffFin"]
        pool_fin = out["Finalizações"] * out["%EffFin"]
        return composite_z([fin, row["npxG"]], [pool_fin, out["npxG"]], [0.55, 0.45])

    def presenca_row(row: pd.Series) -> float:
        return composite_z([row["ToquesArea"], row["AçõesAtW"]], [out["ToquesArea"], out["AçõesAtW"]], [0.5, 0.5])

    def criacao_row(row: pd.Series) -> float:
        return composite_z(
            [row["xA"], row["PassesPerigosos"], row["PassesCriativos"]],
            [out["xA"], out["PassesPerigosos"], out["PassesCriativos"]],
            [0.4, 0.35, 0.25],
        )

    out["blk_construcao"] = out.apply(construcao_row, axis=1)
    out["blk_distribuicao"] = out.apply(distribuicao_row, axis=1)
    out["blk_duelos_def"] = out.apply(duelos_def_row, axis=1)
    out["blk_leitura"] = out.apply(leitura_row, axis=1)
    out["blk_duelo_ar"] = out.apply(duelo_ar_row, axis=1)
    out["blk_finalizacao"] = out.apply(finalizacao_row, axis=1)
    out["blk_presenca"] = out.apply(presenca_row, axis=1)
    out["blk_criacao"] = out.apply(criacao_row, axis=1)

    out["idx_construtor"] = out["blk_construcao"] * 0.85 + out["blk_distribuicao"] * 0.15 + 2
    out["idx_contencao"] = out["blk_duelos_def"] * 0.5 + out["blk_leitura"] * 0.3 + out["blk_duelo_ar"] * 0.2 + 2
    out["idx_boxtobox"] = out["blk_finalizacao"] * 0.3 + out["blk_duelos_def"] * 0.4 + out["blk_presenca"] * 0.5 + 2
    out["idx_ofensivo"] = out["blk_finalizacao"] * 0.25 + out["blk_criacao"] * 0.5 + out["blk_presenca"] * 0.25 + 2

    index_cols = ["idx_construtor", "idx_contencao", "idx_boxtobox", "idx_ofensivo"]
    keys = ["construtor", "contencao", "boxtobox", "ofensivo"]
    _attach_shares(out, index_cols)
    specs = FAMILY_PROFILE_CONFIG["meio-campistas"].profiles
    out["perfil"] = out.apply(lambda r: _resolve_profile(r, list(specs), 0.03, "pct_idx_"), axis=1)
    out = _add_geral_rating(out)
    out = _attach_tendencies(out)
    return _finalize_indices(out, index_cols, keys)


def _compute_extremos_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    out = pool.copy()

    def conducao_row(row: pd.Series) -> float:
        drible = row["Dribles"] * row["%EffDribles"]
        pool_d = out["Dribles"] * out["%EffDribles"]
        d_of = row["DuelosOf"] * row["%DuelosOfW"]
        pool_of = out["DuelosOf"] * out["%DuelosOfW"]
        return composite_z([drible, d_of], [pool_d, pool_of], [0.7, 0.3])

    def cruz_row(row: pd.Series) -> float:
        comp = out["Cruz."] * out["%EffCruz."]
        return composite_z([row["Cruz."] * row["%EffCruz."]], [comp], [1.0])

    def construcao_row(row: pd.Series) -> float:
        return composite_z(
            [row["CompPassesProg"], row["CompBL"], row["CompPTF"]],
            [out["CompPassesProg"], out["CompBL"], out["CompPTF"]],
            [0.35, 0.25, 0.4],
        )

    def distribuicao_row(row: pd.Series) -> float:
        return composite_z([row["CompPasse"], row["RecPasse"]], [out["CompPasse"], out["RecPasse"]], [0.7, 0.3])

    def progressao_row(row: pd.Series) -> float:
        return composite_z([row["Acelerações"], row["Cond.Prog"]], [out["Acelerações"], out["Cond.Prog"]], [0.6, 0.4])

    def desmarque_row(row: pd.Series) -> float:
        return composite_z([row["RecPassesLngs"], row["ToquesArea"]], [out["RecPassesLngs"], out["ToquesArea"]], [0.7, 0.3])

    out["blk_conducao"] = out.apply(conducao_row, axis=1)
    out["blk_cruz"] = out.apply(cruz_row, axis=1)
    out["blk_construcao"] = out.apply(construcao_row, axis=1)
    out["blk_distribuicao"] = out.apply(distribuicao_row, axis=1)
    out["blk_progressao"] = out.apply(progressao_row, axis=1)
    out["blk_desmarque"] = out.apply(desmarque_row, axis=1)

    out["idx_criador"] = (out["blk_conducao"] + 2) * 1.025
    out["idx_meia_ponta"] = out["blk_construcao"] * 0.35 + out["blk_distribuicao"] * 0.35 + out["blk_cruz"] * 0.3 + 2
    out["idx_vertical"] = out["blk_progressao"] * 0.7 + out["blk_desmarque"] * 0.3 + 2

    index_cols = ["idx_criador", "idx_meia_ponta", "idx_vertical"]
    keys = ["criador", "meia_ponta", "vertical"]
    _attach_shares(out, index_cols)
    specs = FAMILY_PROFILE_CONFIG["extremos"].profiles
    out["perfil"] = out.apply(lambda r: _resolve_profile(r, list(specs), 0.03, "pct_idx_"), axis=1)
    out = _add_geral_rating(out)
    out = _attach_tendencies(out)
    return _finalize_indices(out, index_cols, keys)


def _compute_meias_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    out = pool.copy()

    def construcao_row(row: pd.Series) -> float:
        return composite_z(
            [row["CompPassesProg"], row["CompBL"], row["CompPTF"]],
            [out["CompPassesProg"], out["CompBL"], out["CompPTF"]],
            [0.35, 0.25, 0.4],
        )

    def criacao_row(row: pd.Series) -> float:
        return composite_z(
            [row["xA"], row["PassesPerigosos"], row["PassesCriativos"]],
            [out["xA"], out["PassesPerigosos"], out["PassesCriativos"]],
            [0.4, 0.35, 0.25],
        )

    def cruz_row(row: pd.Series) -> float:
        comp = out["Cruz."] * out["%EffCruz."]
        return composite_z([row["Cruz."] * row["%EffCruz."]], [comp], [1.0])

    def distribuicao_row(row: pd.Series) -> float:
        return composite_z([row["CompPasse"], row["RecPasse"]], [out["CompPasse"], out["RecPasse"]], [0.7, 0.3])

    def finalizacao_row(row: pd.Series) -> float:
        return composite_z([row["Finalizações"], row["Golsxg"]], [out["Finalizações"], out["Golsxg"]], [0.5, 0.5])

    def conducao_row(row: pd.Series) -> float:
        drible = row["Dribles"] * row["%EffDribles"]
        pool_d = out["Dribles"] * out["%EffDribles"]
        return composite_z([drible, row["Cond.Prog"]], [pool_d, out["Cond.Prog"]], [0.6, 0.4])

    def progressao_row(row: pd.Series) -> float:
        return composite_z([row["Cond.Prog"], row["Acelerações"]], [out["Cond.Prog"], out["Acelerações"]], [0.6, 0.4])

    out["blk_construcao"] = out.apply(construcao_row, axis=1)
    out["blk_criacao"] = out.apply(criacao_row, axis=1)
    out["blk_cruz"] = out.apply(cruz_row, axis=1)
    out["blk_distribuicao"] = out.apply(distribuicao_row, axis=1)
    out["blk_finalizacao"] = out.apply(finalizacao_row, axis=1)
    out["blk_conducao"] = out.apply(conducao_row, axis=1)
    out["blk_progressao"] = out.apply(progressao_row, axis=1)

    out["idx_armador"] = (
        out["blk_construcao"] * 0.15 + out["blk_criacao"] * 0.4 + out["blk_cruz"] * 0.3 + out["blk_distribuicao"] * 0.15 + 2
    ) * 1.075
    out["idx_finalizador"] = out["blk_finalizacao"] * 0.5 + out["blk_conducao"] * 0.25 + out["blk_progressao"] * 0.25 + 2

    index_cols = ["idx_armador", "idx_finalizador"]
    keys = ["armador", "finalizador"]
    _attach_shares(out, index_cols)
    specs = FAMILY_PROFILE_CONFIG["meias-ofensivos"].profiles
    out["perfil"] = out.apply(lambda r: _resolve_profile(r, list(specs), 0.05, "pct_idx_"), axis=1)
    out = _add_geral_rating(out)
    out = _attach_tendencies(out)
    return _finalize_indices(out, index_cols, keys)


def _compute_atacantes_profiles(pool: pd.DataFrame) -> pd.DataFrame:
    out = pool.copy()

    def finalizacao_row(row: pd.Series) -> float:
        fin = row["Finalizações"] * row["%EffFin"]
        pool_fin = out["Finalizações"] * out["%EffFin"]
        return composite_z([fin, row["npxG"]], [pool_fin, out["npxG"]], [0.7, 0.3])

    def efetividade_row(row: pd.Series) -> float:
        return composite_z([row["GolspTq"], row["Golsxg"]], [out["GolspTq"], out["Golsxg"]], [0.5, 0.5])

    def duelo_ar_row(row: pd.Series) -> float:
        return composite_z([row["DuelosAr"], row["%DuelosAr"]], [out["DuelosAr"], out["%DuelosAr"]], [0.7, 0.3])

    def criacao_row(row: pd.Series) -> float:
        return composite_z(
            [row["xA"], row["PassesPerigosos"], row["PassesCriativos"]],
            [out["xA"], out["PassesPerigosos"], out["PassesCriativos"]],
            [0.4, 0.35, 0.25],
        )

    def conducao_row(row: pd.Series) -> float:
        return composite_z([row["Dribles"], row["Cond.Prog"]], [out["Dribles"], out["Cond.Prog"]], [0.5, 0.5])

    def progressao_row(row: pd.Series) -> float:
        return composite_z([row["Cond.Prog"], row["AçõesAtW"]], [out["Cond.Prog"], out["AçõesAtW"]], [0.6, 0.4])

    out["blk_finalizacao"] = out.apply(finalizacao_row, axis=1)
    out["blk_efetividade"] = out.apply(efetividade_row, axis=1)
    out["blk_duelo_ar"] = out.apply(duelo_ar_row, axis=1)
    out["blk_criacao"] = out.apply(criacao_row, axis=1)
    out["blk_conducao"] = out.apply(conducao_row, axis=1)
    out["blk_progressao"] = out.apply(progressao_row, axis=1)

    out["idx_finalizador"] = (out["blk_finalizacao"] * 0.7 + out["blk_efetividade"] * 0.3) * 1.1 - out["blk_duelo_ar"] * 0.35 + 2
    out["idx_alvo"] = out["blk_duelo_ar"] * 0.7 + out["blk_efetividade"] * 0.3 + 2
    out["idx_movel"] = out["blk_criacao"] * 0.5 + out["blk_conducao"] * 0.3 + out["blk_progressao"] * 0.2 + 2

    index_cols = ["idx_finalizador", "idx_alvo", "idx_movel"]
    keys = ["finalizador", "alvo", "movel"]
    _attach_shares(out, index_cols)
    specs = FAMILY_PROFILE_CONFIG["atacantes"].profiles
    out["perfil"] = out.apply(lambda r: _resolve_profile(r, list(specs), 0.03, "pct_idx_"), axis=1)
    out = _add_geral_rating(out)
    out = _attach_tendencies(out)
    return _finalize_indices(out, index_cols, keys)


FAMILY_PROFILE_CONFIG: dict[str, FamilyProfileConfig] = {
    "laterais": FamilyProfileConfig(
        threshold=0.03,
        profiles=(
            ProfileSpec("construtor", "Construtor", "Construtor"),
            ProfileSpec("defensivo", "Defensivo", "Defensivo"),
            ProfileSpec("vertical", "Vertical", "Vertical"),
            ProfileSpec("ofensivo", "Ofensivo", "Ofensivo"),
        ),
        compute_indices=_compute_laterais_profiles,
    ),
    "meio-campistas": FamilyProfileConfig(
        threshold=0.03,
        profiles=(
            ProfileSpec("construtor", "Construtor", "Construtor"),
            ProfileSpec("contencao", "Contenção", "Contenção"),
            ProfileSpec("boxtobox", "Box-to-box", "Box to Box"),
            ProfileSpec("ofensivo", "Ofensivo", "Ofensivo"),
        ),
        compute_indices=_compute_meio_profiles,
    ),
    "extremos": FamilyProfileConfig(
        threshold=0.03,
        profiles=(
            ProfileSpec("criador", "Criador", "Driblador"),
            ProfileSpec("meia_ponta", "Meia Ponta", "Meia Ponta"),
            ProfileSpec("vertical", "Vertical", "Ruptura"),
        ),
        compute_indices=_compute_extremos_profiles,
    ),
    "meias-ofensivos": FamilyProfileConfig(
        threshold=0.05,
        profiles=(
            ProfileSpec("armador", "Armador", "Meia Armador"),
            ProfileSpec("finalizador", "Finalizador", "Meia Atacante"),
        ),
        compute_indices=_compute_meias_profiles,
    ),
    "atacantes": FamilyProfileConfig(
        threshold=0.03,
        profiles=(
            ProfileSpec("finalizador", "Finalizador", "Finalizador"),
            ProfileSpec("alvo", "Alvo", "Alvo"),
            ProfileSpec("movel", "Móvel", "Móvel"),
        ),
        compute_indices=_compute_atacantes_profiles,
    ),
}


def profile_shares_from_row(row: pd.Series, family_key: str) -> dict[str, float]:
    if family_key == "zagueiros":
        return {
            "combativo": round(float(row.get("pct_combativo", 0)) * 100, 0),
            "construtor": round(float(row.get("pct_construtor", 0)) * 100, 0),
            "posicional": round(float(row.get("pct_posicional", 0)) * 100, 0),
        }
    config = FAMILY_PROFILE_CONFIG[family_key]
    shares: dict[str, float] = {}
    for spec in config.profiles:
        shares[spec.key] = round(float(row.get(f"pct_idx_{spec.key}", 0)) * 100, 0)
    return shares


def profile_ratings_from_row(row: pd.Series, family_key: str) -> dict[str, float]:
    if family_key == "zagueiros":
        return {
            "combativo": round(float(row.get("rating_combativo", 0)), 1),
            "construtor": round(float(row.get("rating_construtor", 0)), 1),
            "posicional": round(float(row.get("rating_posicional", 0)), 1),
        }
    config = FAMILY_PROFILE_CONFIG[family_key]
    ratings: dict[str, float] = {}
    for spec in config.profiles:
        ratings[spec.key] = round(float(row.get(f"rating_idx_{spec.key}", row.get(f"rating_{spec.key}", 0))), 1)
    return ratings


def profile_ranks_from_row(row: pd.Series, family_key: str) -> dict[str, int]:
    if family_key == "zagueiros":
        return {
            "combativo": int(row.get("rank_combativo", 0)),
            "construtor": int(row.get("rank_construtor", 0)),
            "posicional": int(row.get("rank_posicional", 0)),
        }
    config = FAMILY_PROFILE_CONFIG[family_key]
    ranks: dict[str, int] = {}
    for spec in config.profiles:
        col = f"rank_idx_{spec.key}"
        ranks[spec.key] = int(row.get(col, row.get(f"rank_{spec.key}", 0)))
    return ranks
