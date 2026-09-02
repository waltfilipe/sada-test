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
  };
  return map[title] ?? title;
}
