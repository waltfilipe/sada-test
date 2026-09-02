import type { AspectItem, PlayerProfile } from "@/lib/types";

export function flattenAspects(player: PlayerProfile): AspectItem[] {
  const groups = player.aspects;
  return [
    ...(groups.defensivos ?? []),
    ...(groups.construcao ?? []),
    ...(groups.ofensivos ?? []),
    ...(groups.terco_final ?? []),
    ...(groups.passes_finais ?? []),
    ...(groups.conducao_drible ?? []),
    ...(groups.ofensividade ?? []),
  ];
}

export function findAspect(items: AspectItem[], label: string): AspectItem | undefined {
  const aliases: Record<string, string[]> = {
    "Passes Finais": ["Passes Finas", "Passes Finais"],
    Progressão: ["Progressão", "Conduções Progressivas"],
    "Passes Chave": ["Passes Chave", "Passes Finas"],
  };
  const candidates = aliases[label] ?? [label];
  return items.find((item) => candidates.some((c) => item.label === c || item.label.startsWith(c)));
}
