# Série A Scout

Site de scouting da Série A inspirado no dashboard Power BI, com cálculos derivados das DAX do arquivo `Dashboard - Série A 25-26.pbix` e dados de `Serie A 26.xlsx`.

## Stack

- Next.js 15 (App Router)
- Dados estáticos gerados em build por `scripts/build_site_data.py`
- Deploy na Vercel

## Páginas

- `/filtros` — filtros e lista de atletas
- `/posicao/[slug]` — análise por posição
- `/comparar` — comparação direta com radares
- `/scatter` — comparação com gráficos de dispersão

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

O script de build lê `Serie A 26.xlsx` (aba `Tb_SerieC25` ou `Search results (500)` com mapeamento Wyscout). Se o Excel não estiver no formato esperado, o fallback usa os dados embutidos no `.pbix`.

## Atualizar dados

1. Substitua `Serie A 26.xlsx` mantendo as colunas do modelo (`Tb_SerieC25`)
2. Rode `npm run build:data`
3. Faça deploy novamente na Vercel

## Referências

- DAX exportadas: `reference/dax-measures.json` (gerado no build)
- Fonte original: `Dashboard - Série A 25-26.pbix`
