/**
 * Tooltips ⓘ exibidos ao lado dos títulos de aspectos/stats.
 * Chave = label do aspecto (como vem nos dados) ou título exibido.
 */
export const STAT_TOOLTIPS: Record<string, string> = {
  "Eficiência Defensiva":
    "Medida do impacto defensivo do atleta: a taxa de eventos defensivos por 90 é modelada com shrinkage por minutagem (poucos minutos puxam para a média da posição) e z-scores winsorizados. Positivo = acima da média; negativo = abaixo.",
  "Passes Criativos":
    "Soma de Passes em Profundidade/90 + Passes Inteligentes/90 (through balls e smart passes): bolas que quebram linhas e criam chances de finalização.",
};
