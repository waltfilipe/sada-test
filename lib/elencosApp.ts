/**
 * O app SADA-Elencos é montado neste domínio em /elencos/* via rewrite
 * (ver next.config.ts). As páginas de elenco saíram deste app — links e
 * redirects apontam para lá; o localStorage do time sombra é compartilhado
 * por ser a mesma origem.
 */
export const ELENCOS_BASE = "/elencos";

export function elencosPath(league: string, path = ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${ELENCOS_BASE}/${league}${normalized === "/" ? "" : normalized}`;
}
