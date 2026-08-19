export type ZagArchetype = "Rebatedor" | "Construtor" | "Agressivo";

export type ZagClusterShares = {
  rebatedor: number;
  construtor: number;
  agressivo: number;
};

export type ZagCluster = {
  archetype: ZagArchetype;
  archetype_label: string;
  is_hybrid: boolean;
  shares: ZagClusterShares;
};

export const ZAG_ARCHETYPES: ZagArchetype[] = ["Rebatedor", "Construtor", "Agressivo"];

export const ZAG_ARCHETYPE_META: {
  archetype: ZagArchetype;
  tone: string;
  description: string;
}[] = [
  {
    archetype: "Rebatedor",
    tone: "rebatedor",
    description: "Referência defensiva: clearance, bloqueio, duelos aéreos e defensivos.",
  },
  {
    archetype: "Construtor",
    tone: "construtor",
    description: "Iniciador de jogo: volume de passe, PTF e progressividade.",
  },
  {
    archetype: "Agressivo",
    tone: "agressivo",
    description: "Constrói com envolvimento alto em duelos ofensivos e conduções.",
  },
];

export function archetypeTone(archetype: ZagArchetype): string {
  return ZAG_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "construtor";
}

export function archetypeMetaFor(archetype: ZagArchetype) {
  return ZAG_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function archetypeCounts(players: { cluster?: ZagCluster | null }[]) {
  const counts: Record<ZagArchetype, number> = {
    Rebatedor: 0,
    Construtor: 0,
    Agressivo: 0,
  };
  let hybrids = 0;
  for (const player of players) {
    if (!player.cluster) continue;
    counts[player.cluster.archetype] = (counts[player.cluster.archetype] ?? 0) + 1;
    if (player.cluster.is_hybrid) hybrids += 1;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const percents: Record<ZagArchetype, number> = {
    Rebatedor: total ? Math.round((counts.Rebatedor / total) * 100) : 0,
    Construtor: total ? Math.round((counts.Construtor / total) * 100) : 0,
    Agressivo: total ? Math.round((counts.Agressivo / total) * 100) : 0,
  };
  return { counts, percents, hybrids, total };
}

/** @deprecated use archetypeCounts */
export function clusterCounts(players: { cluster?: ZagCluster | null }[]) {
  const { counts } = archetypeCounts(players);
  return { macros: counts, micros: counts };
}
