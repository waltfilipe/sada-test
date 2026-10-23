# Série A Scout

Site de scouting das Séries A, B, C e D, com cálculos derivados das DAX do arquivo `Dashboard - Série A 25-26.pbix` e exportações Wyscout em `wyscout/2026/`.

## Stack

- Next.js 15 (App Router)
- Dados estáticos gerados em build por `scripts/build_site_data.py`
- Deploy na Vercel

## Páginas

- `/` — escolha da competição (A, B, C, D)
- `/{liga}/filtros` — filtros e lista de atletas
- `/{liga}/posicao/[slug]` — análise por posição
- `/{liga}/comparar` — comparação direta com radares
- `/{liga}/scatter` — comparação com gráficos de dispersão

## Desenvolvimento

```bash
pip install pandas openpyxl pbixray numpy
npm install
npm run build:data
npm run dev
```

## Build / Deploy

```bash
npm run build
```

O script de build lê os pares `wyscout/2026/serie-*-pt1.xlsx` e `pt2.xlsx` (aba `Search results`), junta as partes e remove a sobreposição do limite de 500 linhas do Wyscout. A Série A ainda cai no `.pbix` se o Excel não estiver no formato esperado.

**Estaduais 2026:** exporte os lotes do Wyscout, rode `npm run import:estaduais` (gera `Estaduais 26.xlsx` com abas `Search results` e `Tb_Estaduais26` + medidas DAX em Python) e depois `npm run build:data` para atualizar a liga `estaduais` no site.

## Atualizar dados

1. Substitua os arquivos em `wyscout/2026/` (`serie-a`, `serie-b`, `serie-c`, `serie-d`, partes `pt1` e `pt2`)
2. Rode `npm run build:data`
3. Faça deploy novamente na Vercel

## Referências

- DAX exportadas: `reference/dax-measures.json` (gerado no build)
- Fonte original: `Dashboard - Série A 25-26.pbix`
