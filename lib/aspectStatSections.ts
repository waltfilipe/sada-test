import type { PositionFamily } from "@/lib/types";

export type StatSectionTone = "defensivos" | "passes" | "dribles" | "final";

export type StatSectionSpec = {
  title: string;
  labels: string[];
  tone: StatSectionTone;
};

const ZAG_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Duelos Ofensivos", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais e Ofensividade",
    tone: "final",
    labels: [],
  },
];

const LAT_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Duelos Ofensivos", "Dribles", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais e Ofensividade",
    tone: "final",
    labels: [
      "Cruzamentos",
      "Passes Chave e Área",
      "Assistências e xA",
      "Pré-Assists",
      "Passes Inteligentes",
      "Passes em Profundidade",
      "Ofensividade",
    ],
  },
];

const MC_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Duelos Ofensivos", "Dribles", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais e Ofensividade",
    tone: "final",
    labels: [
      "Finalizações",
      "Passes Chave e Área",
      "Assistências e xA",
      "Pré-Assists",
      "Passes Inteligentes",
      "Passes em Profundidade",
      "Ofensividade",
    ],
  },
];

const EX_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Vencidos", "Ações Defensivas"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Passes Finais",
    tone: "final",
    labels: [
      "Passes Chave e Área",
      "Cruzamentos",
      "Assistências e xA",
      "Pré-Assists",
      "Passes Inteligentes",
      "Passes em Profundidade",
    ],
  },
  {
    title: "Condução e Drible",
    tone: "dribles",
    labels: ["Duelos Ofensivos", "Dribles", "Progressão"],
  },
  {
    title: "Finalização",
    tone: "final",
    labels: ["Gols e xG", "Finalizações"],
  },
  {
    title: "Ofensividade",
    tone: "final",
    labels: ["Ações Terminais", "Verticalidade"],
  },
];

export function statSectionsForFamily(family: PositionFamily): StatSectionSpec[] {
  if (family === "laterais") return LAT_STAT_SECTIONS;
  if (family === "meio-campistas") return MC_STAT_SECTIONS;
  if (family === "extremos") return EX_STAT_SECTIONS;
  if (family === "zagueiros") return ZAG_STAT_SECTIONS;
  return ZAG_STAT_SECTIONS;
}

export function statSectionTone(title: string): StatSectionTone {
  const all = [...ZAG_STAT_SECTIONS, ...LAT_STAT_SECTIONS, ...MC_STAT_SECTIONS, ...EX_STAT_SECTIONS];
  return all.find((section) => section.title === title)?.tone ?? "defensivos";
}
