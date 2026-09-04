/** Short labels for aspect blocks in compact UI (tooltips, chips). */
export function sectionShortLabel(title: string): string {
  const map: Record<string, string> = {
    Defensivos: "Defensivo",
    Passes: "Passe",
    "Dribles e Condução": "Condução",
    "Passes Finais e Ofensividade": "Ofensivo",
    "Passes Finais": "Passe final",
    "Condução e Drible": "Condução",
    Ofensividade: "Ofensivo",
    Finalização: "Finalização",
    "Ações Terminais": "Ações terminais",
    Verticalidade: "Verticalidade",
    "Gols e xG": "Finalização",
    "Passes Chave e Área": "Passe final",
  };
  return map[title] ?? title;
}
