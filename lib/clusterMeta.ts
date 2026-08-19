export type ClusterMacro = "Defensor" | "Construtor";
export type ClusterMicro = "D1" | "D2" | "C1" | "C2";

export type ZagCluster = {
  macro: ClusterMacro;
  micro: ClusterMicro;
  macro_label: ClusterMacro;
  micro_label: string;
};

export const ZAG_CLUSTER_MACROS: ClusterMacro[] = ["Defensor", "Construtor"];

export const ZAG_CLUSTER_MICROS: ClusterMicro[] = ["D1", "D2", "C1", "C2"];

export const ZAG_CLUSTER_TREE: {
  macro: ClusterMacro;
  tone: string;
  description: string;
  children: { micro: ClusterMicro; label: string; description: string }[];
}[] = [
  {
    macro: "Defensor",
    tone: "defensor",
    description: "Predominância defensiva — clearance, bloqueio e duelos de área.",
    children: [
      {
        micro: "D1",
        label: "Rebatedor / âncora",
        description: "Referência na área: aéreo, corte e bloqueio. Passe contido.",
      },
      {
        micro: "D2",
        label: "Distribuidor longo",
        description: "Defende com solidez e procura o longo com frequência relativa.",
      },
    ],
  },
  {
    macro: "Construtor",
    tone: "construtor",
    description: "Predominância na construção — volume, PTF e condução progressiva.",
    children: [
      {
        micro: "C1",
        label: "Construtor agressivo",
        description: "Constrói com alta progessividade e envolvimento em duelos.",
      },
      {
        micro: "C2",
        label: "Construtor puro",
        description: "Iniciador de jogo: muito passe, PTF e acerto elevado.",
      },
    ],
  },
];

export function clusterMacroTone(macro: ClusterMacro): string {
  return macro === "Construtor" ? "construtor" : "defensor";
}

export function clusterMicroTone(micro: ClusterMicro): string {
  if (micro.startsWith("D")) return "defensor";
  return "construtor";
}

export function clusterMetaFor(macro: ClusterMacro, micro: ClusterMicro) {
  const branch = ZAG_CLUSTER_TREE.find((item) => item.macro === macro);
  const leaf = branch?.children.find((item) => item.micro === micro);
  return {
    branch,
    leaf,
    path: branch && leaf ? `${branch.macro} · ${leaf.label}` : macro,
  };
}

export function clusterCounts(players: { cluster?: ZagCluster | null }[]) {
  const macros: Record<string, number> = { Defensor: 0, Construtor: 0 };
  const micros: Record<string, number> = { D1: 0, D2: 0, C1: 0, C2: 0 };
  for (const player of players) {
    if (!player.cluster) continue;
    macros[player.cluster.macro] = (macros[player.cluster.macro] ?? 0) + 1;
    micros[player.cluster.micro] = (micros[player.cluster.micro] ?? 0) + 1;
  }
  return { macros, micros };
}
