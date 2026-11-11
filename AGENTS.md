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
5. `python scripts/audit_identity.py` — fila de revisão de identidade
   (homônimos fundidos, âncoras ss erradas, fusões de trajetória) →
   `data/cross-season/identity-audit.json`. Resolva os achados em
   `identity-overrides.json` e re-rode os passos 2–4.

Scripts de reparo (`repair_persons_by_tm.py`, `resolve_tm_disputes.py`,
`fix_heatmap_identity.py`) reescrevem `persons.json` — depois deles, rode de
novo os passos 2–4.

Correções humanas vivem em `data/cross-season/identity-overrides.json`
(versionado): `merge_people` (person_key → canônico), `pin_athlete`
(person_key → athlete_id), `row_athlete` (liga/temporada/player_id → athlete_id,
splits de linha). O registro sempre respeita overrides.

`athletes.json` nunca reutiliza ids: pessoas desaparecidas ficam `active:false`.

## xProgressão (`xprog`)

`python scripts/apply_xprog.py` — após rebuilds de dados (junto de
`apply_pass_distance.py`). Regressão OLS por liga + temporada + família
(zagueiros/laterais/meio-campistas/extremos): passes progressivos/90 esperados a partir
de passes/90, % passe e passes/90 do time (proxy de posse; média ponderada por
minutos, sem goleiros). Grava `xprog` {actual, expected, delta, delta_pct, …}
em `family-*.json` + `profiles/` (liga corrente, sub-ligas de estaduais e
`seasons/<ano>` de A/B/C). Casamento por (nome, clube **ou** clube do período).
Exibido no popup "Tendências e xProg" (`PassTendencies.tsx`).

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
- Estaduais (est-nv1..4): CSVs defensivos SofaScore por nível em
  `BRE26NV{1,2,3}_defensive.csv` (merge dos CSVs por campeonato — Nv1:
  CAR/GAU/MIN/PAUA1, Nv2: PR/CAT/PAUA2, Nv3: PAUA3; Nv4 sem fonte ainda).
  `BRE26_defensive.csv` é o merge completo usado pelo hub `estaduais`.
  Heatmaps de estadual: `apply_heatmaps_to_site.py --league est-nvX --csv
  <csv do campeonato> --source-dir <pasta onlyheatmaps>` — depois conferir
  ss_ids duplicados em `data/heatmaps` (colisões de homônimos) e rodar a
  cadeia 2–4 para estampar as âncoras.
- `apply_estadual_competition.py` — carimba `competition` ("Paulista A2",
  "Catarinense"...) em players/family/profiles das ligas est-nv* + hub;
  rode após rebuild dos níveis. O campo rotula a competição real do atleta
  no site e nos reports (percentis seguem contra o pool do nível).
- `build_estadual_historical_seasons.py` — temporadas arquivadas dos
  estaduais: sincroniza os xlsx por campeonato (Desktop `Estaduais/` →
  `wyscout/historical/estaduais/{comp}-{ano}.xlsx`, já com `Campeonato`
  carimbado) e roda `build_league` por (nível, ano) →
  `data/{est-nv*}/seasons/{ano}` + stamp `competition`. `--only est-nvX/AAAA`
  para um build só. Nv3 histórico tem só Paulista A3; Nv4 não tem arquivo.
  Atenção: "Paranaense 2022.xlsx" é na verdade a elite do Paranaense 2023
  (o "… CERTO.xlsx" é o 2022 real) — o mapeamento está no SOURCES do script.
  Depois dos builds: `apply_xprog.py` e `apply_pass_distance.py` já cobrem
  os snapshots estaduais; `backfill_tm_by_club_history.py` cobre est-nv* e
  resolve tm_id por elenco/ano (join → `athlete_id` via `apply_athlete_ids`).
- Reports multi-liga: `/api/athlete-rows` devolve linhas por liga+temporada;
  ligas fora do grafo de pessoas (est-nv*, serie-d) entram pelo `athlete_id`
  carimbado via âncora tm/ss verificada (ver `NON_GRAPH_LEAGUES` em
  `lib/athleteRows.server.ts`).

## Verificação

- `npx tsc --noEmit` — typecheck
- Dev: `npx next dev -p 3310`
- Metadados de scrape `*_run.done.json` ficam fora do git.
