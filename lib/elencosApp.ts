/**
 * O SADA-Elencos roda no domínio próprio — os links de navegação apontam
 * para lá. O estado do time sombra é compartilhado via nuvem (Upstash),
 * sincronizado pela API tunelada em /elencos/api/* (ver next.config.ts e
 * lib/shadowTeamStorage.ts).
 */
export const ELENCOS_ORIGIN = "https://sada-elencos.vercel.app";

export function elencosPath(league: string, path = ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${ELENCOS_ORIGIN}/${league}${normalized === "/" ? "" : normalized}`;
}
