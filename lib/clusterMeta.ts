export type ZagArchetype = "Rebatedor" | "Construtor" | "Agressivo";

export type ConstrutorSubtype = "Construtor Defensivo" | "Construtor Lançador";

export type ZagClusterShares = {
  rebatedor: number;
  construtor: number;
  agressivo: number;
};

export type ZagArchetypeRatings = {
  rebatedor: number;
  construtor: number;
  agressivo: number;
};

export type ZagCluster = {
  archetype: ZagArchetype;
  archetype_label: string;
  /** Present only when archetype is Construtor. */
  construtor_subtype?: ConstrutorSubtype | null;
  is_hybrid: boolean;
  shares: ZagClusterShares;
  ratings: ZagArchetypeRatings;
};

export type ArchetypeTrait = {
  label: string;
  direction: "up" | "down";
};

export const ZAG_ARCHETYPES: ZagArchetype[] = ["Rebatedor", "Construtor", "Agressivo"];

export const CONSTRUTOR_SUBTYPES: ConstrutorSubtype[] = ["Construtor Defensivo", "Construtor Lançador"];

export const CONSTRUTOR_SUBTYPE_META: {
  subtype: ConstrutorSubtype;
  short_label: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    subtype: "Construtor Defensivo",
    short_label: "Defensivo",
    description: "Constrói com base defensiva sólida: mais rebatidas, duelos aéreos e tendência ao passe longo.",
    traits: [
      { label: "Rebatidas", direction: "up" },
      { label: "Duelos Aéreos", direction: "up" },
      { label: "Tendência Longo", direction: "up" },
      { label: "PTF", direction: "down" },
    ],
  },
  {
    subtype: "Construtor Lançador",
    short_label: "Lançador",
    description: "Iniciador de jogo: construção alta com perfil mais distribuidor e menos lastro defensivo.",
    traits: [
      { label: "PTF", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Rebatidas", direction: "down" },
      { label: "Duelos Aéreos", direction: "down" },
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
    archetype: "Rebatedor",
    tone: "rebatedor",
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
    archetype: "Agressivo",
    tone: "agressivo",
    description: "Constrói com envolvimento alto em duelos ofensivos e conduções.",
    traits: [
      { label: "Duelos Ofensivos", direction: "up" },
      { label: "Condução Prog.", direction: "up" },
      { label: "PTF", direction: "up" },
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

export function construtorSubtypeMetaFor(subtype: ConstrutorSubtype) {
  return CONSTRUTOR_SUBTYPE_META.find((item) => item.subtype === subtype);
}

export function archetypeCounts(players: { cluster?: ZagCluster | null }[]) {
  const counts: Record<ZagArchetype, number> = {
    Rebatedor: 0,
    Construtor: 0,
    Agressivo: 0,
  };
  const construtorSubtypes: Record<ConstrutorSubtype, number> = {
    "Construtor Defensivo": 0,
    "Construtor Lançador": 0,
  };
  let hybrids = 0;
  for (const player of players) {
    if (!player.cluster) continue;
    counts[player.cluster.archetype] = (counts[player.cluster.archetype] ?? 0) + 1;
    if (player.cluster.construtor_subtype) {
      construtorSubtypes[player.cluster.construtor_subtype] =
        (construtorSubtypes[player.cluster.construtor_subtype] ?? 0) + 1;
    }
    if (player.cluster.is_hybrid) hybrids += 1;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const percents: Record<ZagArchetype, number> = {
    Rebatedor: total ? Math.round((counts.Rebatedor / total) * 100) : 0,
    Construtor: total ? Math.round((counts.Construtor / total) * 100) : 0,
    Agressivo: total ? Math.round((counts.Agressivo / total) * 100) : 0,
  };
  return { counts, percents, construtorSubtypes, hybrids, total };
}

/** @deprecated use archetypeCounts */
export function clusterCounts(players: { cluster?: ZagCluster | null }[]) {
  const { counts } = archetypeCounts(players);
  return { macros: counts, micros: counts };
}
