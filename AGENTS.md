# SADA Scout — notas do projeto

## Cadeia de identidade de atletas (cross-temporada)

`player_id` é posicional por temporada — **nunca** use como join entre anos.
O join canônico é `athlete_id` (`ath-XXXXXX`), emitido uma vez e imutável.

Ordem da cadeia (rode nesta sequência após rebuilds de dados):

1. `python scripts/build_cross_season_projection.py` — resolve `person_key`
   (nome+ano±1, cadeia de clubes, tm_id como partição dura) → `persons.json`,
   `models.json`, enriquece `cross_season` nas famílias/perfis.
   **Trava física**: um tm_id reivindicado só vale como âncora se a altura da
   linha for compatível com o perfil TM (cache de elencos; ≥5cm de divergência
   = âncora de homônimo → rebaixada para "não ancorada" no split). Faixas de
   altura disjuntas (>4cm) bloqueiam junção por clube e o merge de temporadas
   disjuntas. `pin_person` continua acima de qualquer trava (verdade humana).
2. `python scripts/build_people.py` — consolida `people.json` (âncoras
   Transfermarkt/SofaScore por pessoa).
3. `python scripts/build_athlete_registry.py` — reanexa/emite `athlete_id`
   (estável por person_key, depois âncoras tm/ss) → `athletes.json`;
   warnings de âncoras conflitantes entram em `_meta.warnings` (fila de revisão).
3.5 `python scripts/reconcile_tm_anchors.py` — tm_id deve ser único:
   quando 2+ pessoas carregam o mesmo tm_id, o dono é decidido pelo cache
   de elencos (`data/transfermarkt-squads.json`): nascimento + clubes onde
   o tm_id apareceu. Perdedores ganham override `tm_unanchor` (honrado por
   build_people.py) e o bloco transfermarkt errado some das linhas (foto
   errada junto). Homônimos legítimos → `distinct_pairs` (audit ignora).

4. `python scripts/apply_athlete_ids.py` — grava `athlete_id`/`person_key` em
   `players.json`, `family-*.json` e `profiles/` de **todas** as ligas
   (estaduais/D/MLS casam por `tm_id` verificado).
4.5 `python scripts/apply_cross_season_non_graph.py` — propaga o bloco
   `cross_season` (histórico + previsões ridge da projeção de minutos) da
   linha nacional corrente do atleta para suas linhas fora do grafo
   (est-*, serie-d, mls-next-pro) via `athlete_id`. Sem isso, atletas como
   Lucas Mila (Série C 2026 + Goiano 2026) projetam só com o prior do
   pool estadual, ignorando o histórico nacional.
5. `python scripts/audit_identity.py` — fila de revisão de identidade
   (homônimos fundidos, âncoras ss erradas, fusões de trajetória) →
   `data/cross-season/identity-audit.json`. Resolva os achados em
   `identity-overrides.json` e re-rode os passos 2–4.
   Checagens físicas: `height-spread` (±5cm entre linhas do atleta),
   `anchor-physique` (linha vs altura/nascimento do perfil TM da pessoa —
   aponta a linha mal ancorada) e `position-mismatch` (linha cuja família é
   par improvável com a dominante do atleta — localiza a linha errada).

Scripts de reparo (`repair_persons_by_tm.py`, `resolve_tm_disputes.py`,
`fix_heatmap_identity.py`) reescrevem `persons.json` — depois deles, rode de
novo os passos 2–4.

Correções humanas vivem em `data/cross-season/identity-overrides.json`
(versionado): `merge_people` (person_key → canônico), `pin_athlete`
(person_key → athlete_id), `pin_person` (liga/temporada/player_id →
person_key — força de pessoa **no grafo**, contrapartida do `row_athlete`
para splits que a inferência não resolve; linhas pinadas não são absorvidas
pelo merge de temporadas disjuntas), `row_athlete` (liga/temporada/player_id →
athlete_id, splits de linha). O registro sempre respeita overrides.

`athletes.json` nunca reutiliza ids: pessoas desaparecidas ficam `active:false`.

## Cartão canônico (nome + foto por atleta)

Identidade resolvida não basta: nome e foto também são propriedades do
atleta, não da linha. `scripts/engine/identity_display.py`
(`sync_row_presentation`) é a camada de apresentação, chamada por
`apply_athlete_ids.py` em **toda** linha com identidade:

- `name_display` — nome de exibição canônico quando difere do nome cru da
  fonte. Fonte: override `display_name` (person_key → nome de guerra, ex.:
  `name:joao vitor|2004|0` → "Dantas") aplicado em `build_people.py` →
  `person.display_name`. `name` nunca é sobrescrito (chave de match/busca);
  no site `data.server.ts#withDisplayName` promove `name_display` a `name`
  na fronteira e preserva o cru em `name_raw` (matchers usam
  `name_raw ?? name`).
- foto **tudo-ou-nada**: a foto canônica da pessoa vai para todas as linhas
  do atleta. Fontes provadas: `person.photo`, override `canonical_photo`
  (person_key → url), `athletes.json` com tm **não disputado**, ou foto de
  linha cuja âncora prova ser dele (tm da linha = tm da pessoa, tm que
  resolveu o atleta, `/photos/{ss_id}` nas âncoras `person.sofascore`).
  Sem canônica: só se remove foto provadamente estranha (CDN TM com outro
  tm_id, /photos/{ss} fora das âncoras) — o resto fica e o audit aponta.

Audit (etapa 5) cobre a camada: `name-divergence` (nomes divergentes sem
override → fila de sugestão), `photo-coverage` (foto em parte das linhas),
`photo-mismatch` (foto provadamente alheia).

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
- Estaduais (est-<slug>, um por campeonato): CSVs defensivos SofaScore em
  `BRE26NV{1,2,3}_defensive.csv` (merge por ex-nível, filtrado por
  `Campeonato` na attach) + `PAUA2{22..25}_defensive.csv` (A2 histórico).
  `BRE26_defensive.csv` é o merge completo usado pelo hub `estaduais`.
- `build_est_championships.py` — estaduais como ligas individuais: cada
  campeonato (est-paulista-a1 ... est-copa-paulista) tem pool multi-ano
  próprio (percentis/notas/perfil comparados entre todas as temporadas
  disponíveis, 22–26). Saída: `data/est-<slug>/` (temporada mais recente) +
  `seasons/{ano}`. A tela inicial agrupa por nível só visualmente
  (`ESTADUAIS_LEVELS` em `lib/estaduaisHub.ts`). Depois do build:
  `link_est_championship_athletes.py` + cadeia de identidade.
  Normalização por temporada: métricas defensivas SofaScore mudaram de
  definição entre gerações de scrape (total_clearance/90 ~+40% em 25–26,
  ball_recovery em queda). Em pools multi-ano, `compute_family_metrics`
  cria `{col}__ys` (z por temporada, amostra qualificada do próprio ano)
  para interception_won/total_clearance/outfielder_block/ball_recovery;
  `numeric_col`/`_num_col`/`_ss_*`/`year_scaled_col` leem a variante, e os
  `_axis_z` das hierarquias usam `zscore_by_season` (pool_reference.py).
  Valores exibidos continuam crus; razões/somas por-90 (m4, ações sem
  bola) usam `_raw_ss_*` e são normalizadas só no percentil.
  Heatmaps de estadual: `apply_heatmaps_to_site.py --league est-nvX --csv
  <csv do campeonato> --source-dir <pasta onlyheatmaps>` — depois conferir
  ss_ids duplicados em `data/heatmaps` (colisões de homônimos) e rodar a
  cadeia 2–4 para estampar as âncoras.
- `apply_estadual_competition.py` — carimba `competition` ("Paulista A2",
  "Catarinense"...) em players/family/profiles das ligas est-nv* + hub;
  rode após rebuild dos níveis. O campo rotula a competição real do atleta
  no site e nos reports (percentis seguem contra o pool do nível).
- `apply_discipline_to_site.py` — injeta bloco `discipline` (faltas/90,
  amarelos, vermelhos + médias do pool por família) em family-*/players/
  profiles de todas as ligas e temporadas; alimenta o modal "Disciplina"
  do hero. Match por nome+clube (nunca por nome sozinho). Fontes:
  `wyscout/2026/{liga}-pt*.xlsx`, `wyscout/2026/estaduais/{slug}.xlsx`
  (est-* corrente), `wyscout/historical/{liga}-{ano}.xlsx` e
  `wyscout/historical/estaduais/{slug}-{ano}.xlsx` (est-* arquivado).
  Rode após rebuilds de dados — o bloco não é gerado pelo builder.
- `apply_hist_profile_grades.py` — letras de perfil contra o pool multi-anual
  ponderado da liga (temporada mais antiga = peso 1 … mais recente = N).
  Recupera o z do composto via `z = 2.5·atanh((nota−6.5)/1.85)`, ajusta μ/σ
  ponderados por slug e grava `cluster.hist[slug] = {z, pct, grade}` +
  `hist_pool` (referência) em family-*/players/profiles (root + seasons).
  O site usa `archetypeGrade` (lib/profileShares.ts): hist primeiro,
  fallback = rank na temporada. Caveat: a nota gravada já tem specialty_floor,
  truncando a cauda esquerda do eixo do arquétipo — para referência exata,
  persistir `m8_final_<slug>` no build. Rode após rebuilds de dados.
- `build_estadual_historical_seasons.py` — temporadas arquivadas dos
  estaduais: sincroniza os xlsx por campeonato (Desktop `Estaduais/` →
  `wyscout/historical/estaduais/{comp}-{ano}.xlsx`, já com `Campeonato`
  carimbado) e roda `build_league` por (nível, ano) →
  `data/{est-nv*}/seasons/{ano}` + stamp `competition`. `--only est-nvX/AAAA`
  para um build só. Nv3 histórico tem só Paulista A3; Nv4 histórico tem só
  Copa Paulista (2022-2025, fontes em `Estaduais/Outros/` — ela saiu de
  `EXCLUDED_COMPETITIONS` e virou campeonato Nv4 em `COMPETITION_LEVEL`).
  Atenção: "Paranaense 2022.xlsx" é na verdade a elite do Paranaense 2023
  (o "… CERTO.xlsx" é o 2022 real) — o mapeamento está no SOURCES do script.
  Depois dos builds: `apply_xprog.py` e `apply_pass_distance.py` já cobrem
  os snapshots estaduais; `backfill_tm_by_club_history.py` cobre est-nv* e
  resolve tm_id por elenco/ano (join → `athlete_id` via `apply_athlete_ids`).
- Reports multi-liga: `/api/athlete-rows` devolve linhas por liga+temporada;
  ligas fora do grafo de pessoas (est-nv*, serie-d) entram pelo `athlete_id`
  carimbado via âncora tm/ss verificada (ver `NON_GRAPH_LEAGUES` em
  `lib/athleteRows.server.ts`).

## PDF — páginas do analista

`AnalystSheet` (`components/position/profile/PlayerReport.tsx`) gera **duas** páginas
A4 no fim do relatório (por isso `totalPages = ... + 2`): (1) resumo do analista
(identidade + KPIs, síntese em tom de scout, leitura estatística, números por
temporada) e (2) "Encaixe tático". A síntese vem de `lib/reportInsights.ts`
(`story` = manchete + parágrafos com `**destaque**`; a redação varia de forma
estável por atleta via seed do nome). O encaixe vem de `lib/tacticalFit.ts`,
modelo em duas camadas: **funções** (roles com nomes de scout — "Primeiro
volante", "Líbero", "Extremo de ruptura", "Falso 9"...) pontuadas por afinidade
de perfil + percentis por bloco + percentis de métricas específicas + GPS; e
**slots por esquema** (4-3-3 / 4-2-3-1 / 4-4-2 / 3-5-2 / 3-4-3 / 4-1-2-1-2 /
3-4-2-1), cada um listando as funções que cabem nele — o card mostra a função
em que o atleta renderia melhor NAQUELE desenho (o nome muda por esquema).
Funções com `gate` são **adaptações de posição** (lateral defensivo → zagueiro
pelo lado na linha de 3; lateral ofensivo driblador → ponta; extremo com volume
defensivo → ala; volante alto e forte no alto → zagueiro; zagueiro construtor →
volante; atacante driblador → atacante pelo lado): só entram se o critério
(percentis/altura) passa e o score ≥ `CROSS_MIN`; aparecem no máximo 1× entre
os esquemas (card âmbar "Adaptação") e 1× entre as funções. `move` = movimento
típico da função (delta no campinho) → seta tracejada no card + legenda.
Métricas casam por `aspect` (rótulo PT do aspecto, estável entre idiomas);
`buildInsights` filtra aspectos fora da família avaliada (temporadas curtas em
outra posição não contaminam). A síntese usa `ACTIONS` (aspecto → ação em
campo) e a função do encaixe como sujeito da manchete.
Ajustar função/slot = editar `FAMILIES` nesse arquivo.
Página com `overflow:hidden`: após mexer no layout, conferir que
`.player-report-body` não tem scrollHeight > clientHeight.

## Verificação

- `npx tsc --noEmit` — typecheck
- Dev: `npx next dev -p 3310`
- Metadados de scrape `*_run.done.json` ficam fora do git.

## Bloco Paulista A2 multi-ano (est-paua2) — DESATIVADO

Removido do site (duplicava linhas do Nv2 na ficha/PDF). Scripts mantidos
para reativação: build_paua2_pool.py + link_paua2_athletes.py. Para voltar:
rebuild, recolocar em ESTADUAIS_LEAGUE_IDS/LEAGUES/ARCHIVE_LEAGUES/
NON_GRAPH_LEAGUES e no hub.

`build_paua2_pool.py` — piloto de campeonato-estadual próprio: pool de
percentis/perfis = Paulista A2 2022-2026 inteiro (não por temporada).
Gera `data/est-paua2/` (2026) + `data/est-paua2/seasons/{2022..2025}`,
xProg e distância por ano. Depois: `link_paua2_athletes.py` (propaga
athlete_id das linhas est-nv2 por nome+clube+nasc na mesma temporada →
`row_athlete`), `apply_athlete_ids.py`.
O builder ja replica o bloco `transfermarkt` (foto/valor/url) das linhas
est-nv2 equivalentes — atleta sem enriquecimento TM proprio herda da linha
do nivel. Rótulo do pool: `poolName` em
`lib/leagues.ts` ("Paulista A2 · 2022–26").
Ordenação da aba Posição: ligas `est*` ordenam por minutagem; nacionais
por rating (`PositionScoutPage.tsx`).

## Ideias pendentes

### Ideia 1 — Perfil posicional via heatmap (ofensividade/interioridade)

Agregar por liga+temporada, a partir dos pontos do heatmap SofaScore
(`heatmap.points`, eixos: x = direção de ataque 0→100, y = largura):
`{avancoX, campoAdv%, tercoFinal%, interior%, lado}` por atleta +
percentil dentro da família+liga+temporada (piso ~300 pontos).
Usos: "atuou mais avançado que X% dos zagueiros da liga" (ofensividade),
"recebeu por dentro" para extremos (meia-ponta vs ponta aberto),
detecção de linha de 3 por time (3 zagueiros titulares + dispersão lateral)
para reforçar encaixe "Zagueiro pelo lado". Sempre relativo ao pool da
liga/temporada (heatmap mede jogador+time). Temporadas sem heatmap: omite.
Ref.: análise Castán — Sport B24 x=36.9 (top ~15% zagueiros da liga);
Cruzeiro A23 x=34.7 (mediana); detectou linha de 4 no Cruzeiro 2023.
