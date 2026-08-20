export type ZagArchetype = "Defensor de Área" | "Construtor" | "Combativo";

export type ConstrutorBadge = "Construtor Âncora" | "Construtor Nato";

export type ZagClusterShares = {
  defensor_area: number;
  construtor: number;
  combativo: number;
};

export type ZagArchetypeRatings = {
  defensor_area: number;
  construtor: number;
  combativo: number;
};

export type ZagCluster = {
  archetype: ZagArchetype;
  archetype_label: string;
  /** Hierarchical badge when archetype is Construtor. */
  construtor_badge?: ConstrutorBadge | null;
  construtor_badge_short?: string | null;
  shares: ZagClusterShares;
  ratings: ZagArchetypeRatings;
};

export type ArchetypeTrait = {
  label: string;
  direction: "up" | "down";
};

export const ZAG_ARCHETYPES: ZagArchetype[] = ["Defensor de Área", "Construtor", "Combativo"];

export const CONSTRUTOR_BADGES: ConstrutorBadge[] = ["Construtor Âncora", "Construtor Nato"];

export const CONSTRUTOR_BADGE_META: {
  badge: ConstrutorBadge;
  short_label: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    badge: "Construtor Âncora",
    short_label: "Âncora",
    description: "Constrói com tendência ao passe longo — distribui a partir da defesa.",
    traits: [
      { label: "Tendência Longo", direction: "up" },
      { label: "Passes Longos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Passes Progressivos", direction: "down" },
    ],
  },
  {
    badge: "Construtor Nato",
    short_label: "Nato",
    description: "Iniciador de jogo curto e progressivo, sem perfil de distribuidor longo.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Volume de Passe", direction: "up" },
      { label: "Tendência Longo", direction: "down" },
    ],
  },
];

export const ZAG_ARCHETYPE_META: {
  archetype: ZagArchetype;
  tone: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    archetype: "Defensor de Área",
    tone: "defensor-area",
    description: "Referência defensiva: rebatidas, bloqueio e duelos aéreos e defensivos.",
    traits: [
      { label: "Rebatidas", direction: "up" },
      { label: "Duelos Aéreos", direction: "up" },
      { label: "Bloqueios", direction: "up" },
      { label: "Passes Progressivos", direction: "down" },
      { label: "PTF", direction: "down" },
    ],
  },
  {
    archetype: "Construtor",
    tone: "construtor",
    description: "Iniciador de jogo: volume de passe, PTF e progressividade.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Volume de Passe", direction: "up" },
      { label: "Rebatidas", direction: "down" },
    ],
  },
  {
    archetype: "Combativo",
    tone: "combativo",
    description: "Leitura e contato: duelos defensivos, interceptações e envolvimento alto.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Interceptações", direction: "up" },
      { label: "Duelos Ofensivos", direction: "up" },
      { label: "Rebatidas", direction: "down" },
    ],
  },
];

export function archetypeTone(archetype: ZagArchetype): string {
  return ZAG_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "construtor";
}

export function archetypeMetaFor(archetype: ZagArchetype) {
  return ZAG_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function construtorBadgeMetaFor(badge: ConstrutorBadge) {
  return CONSTRUTOR_BADGE_META.find((item) => item.badge === badge);
}

export function archetypeCounts(players: { cluster?: ZagCluster | null }[]) {
  const counts: Record<ZagArchetype, number> = {
    "Defensor de Área": 0,
    Construtor: 0,
    Combativo: 0,
  };
  const construtorBadges: Record<ConstrutorBadge, number> = {
    "Construtor Âncora": 0,
    "Construtor Nato": 0,
  };
  for (const player of players) {
    if (!player.cluster) continue;
    counts[player.cluster.archetype] = (counts[player.cluster.archetype] ?? 0) + 1;
    if (player.cluster.construtor_badge) {
      construtorBadges[player.cluster.construtor_badge] =
        (construtorBadges[player.cluster.construtor_badge] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const percents: Record<ZagArchetype, number> = {
    "Defensor de Área": total ? Math.round((counts["Defensor de Área"] / total) * 100) : 0,
    Construtor: total ? Math.round((counts.Construtor / total) * 100) : 0,
    Combativo: total ? Math.round((counts.Combativo / total) * 100) : 0,
  };
  return { counts, percents, construtorBadges, total };
}

/** @deprecated use archetypeCounts */
export function clusterCounts(players: { cluster?: ZagCluster | null }[]) {
  const { counts } = archetypeCounts(players);
  return { macros: counts, micros: counts };
}
