# SADA Scout — notas do projeto

## Cadeia de identidade de atletas (cross-temporada)

`player_id` é posicional por temporada — **nunca** use como join entre anos.
O join canônico é `athlete_id` (`ath-XXXXXX`), emitido uma vez e imutável.

Ordem da cadeia (rode nesta sequência após rebuilds de dados):

1. `python scripts/build_cross_season_projection.py` — resolve `person_key`
   (nome+ano±1, cadeia de clubes, tm_id como partição dura) → `persons.json`,
   `models.json`, enriquece `cross_season` nas famílias/perfis.
2. `python scripts/build_people.py` — consolida `people.json` (âncoras
   Transfermarkt/SofaScore por pessoa).
3. `python scripts/build_athlete_registry.py` — reanexa/emite `athlete_id`
   (estável por person_key, depois âncoras tm/ss) → `athletes.json`;
   warnings de âncoras conflitantes entram em `_meta.warnings` (fila de revisão).
4. `python scripts/apply_athlete_ids.py` — grava `athlete_id`/`person_key` em
   `players.json`, `family-*.json` e `profiles/` de **todas** as ligas
   (estaduais/D/MLS casam por `tm_id` verificado).

Scripts de reparo (`repair_persons_by_tm.py`, `resolve_tm_disputes.py`,
`fix_heatmap_identity.py`) reescrevem `persons.json` — depois deles, rode de
novo os passos 2–4.

Correções humanas vivem em `data/cross-season/identity-overrides.json`
(versionado): `merge_people` (person_key → canônico), `pin_athlete`
(person_key → athlete_id), `row_athlete` (liga/temporada/player_id → athlete_id,
splits de linha). O registro sempre respeita overrides.

`athletes.json` nunca reutiliza ids: pessoas desaparecidas ficam `active:false`.

## Heatmaps por temporada (SofaScore)

- Temporada corrente: `apply_heatmaps_to_site.py` (CSV defensivo BR26).
- Temporadas arquivadas: `apply_heatmaps_season.py --league X --season Y
  --source <dir>` — resolve identidade por `sofascore_player_id` do registro
  (fallback: nome único dentro da temporada; homônimos ambíguos são pulados),
  embute `heatmap` na linha de `players.json` + `family-*.json`, grava storage
  em `data/heatmaps/seasons/{liga}-{temp}/` e estampa a âncora
  `sofascore["{liga}/{temp}"]` em `people.json`/`athletes.json`
  (`build_people.py` relê esse diretório em rebuilds).
- Exibição é gated por `meta.heatmaps_enabled` da temporada.

## Verificação

- `npx tsc --noEmit` — typecheck
- Dev: `npx next dev -p 3310`
- Metadados de scrape `*_run.done.json` ficam fora do git.
