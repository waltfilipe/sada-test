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
    labels: ["Cruzamentos", "Passes Finas", "Ofensividade"],
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
    labels: ["Finalizações", "Passes Finas", "Ofensividade"],
  },
];

export function statSectionsForFamily(family: PositionFamily): StatSectionSpec[] {
  if (family === "laterais") return LAT_STAT_SECTIONS;
  if (family === "meio-campistas") return MC_STAT_SECTIONS;
  if (family === "zagueiros") return ZAG_STAT_SECTIONS;
  return ZAG_STAT_SECTIONS;
}

export function statSectionTone(title: string): StatSectionTone {
  const all = [...ZAG_STAT_SECTIONS, ...LAT_STAT_SECTIONS, ...MC_STAT_SECTIONS];
  return all.find((section) => section.title === title)?.tone ?? "defensivos";
}
