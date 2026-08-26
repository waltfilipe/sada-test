import type { PositionFamily } from "@/lib/types";

export type StatSectionSpec = {
  title: string;
  labels: string[];
};

export const ZAG_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivo",
    labels: ["Duelos Defensivos", "Eficiência Defensiva"],
  },
  {
    title: "Aéreo",
    labels: ["Duelos Aéreos"],
  },
  {
    title: "Construção",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
  },
  {
    title: "Ofensivo",
    labels: ["Duelos Ofensivos", "Conduções Progressivas"],
  },
];

export const LAT_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivo",
    labels: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Construção",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Ofensivo",
    labels: ["Duelos Ofensivos", "Dribles", "Progressão"],
  },
  {
    title: "Terço Final",
    labels: ["Cruzamentos", "Passes Finas", "Passes Finais", "Ofensividade"],
  },
];

export function statSectionsForFamily(family: PositionFamily): StatSectionSpec[] {
  if (family === "laterais") return LAT_STAT_SECTIONS;
  if (family === "zagueiros") return ZAG_STAT_SECTIONS;
  return ZAG_STAT_SECTIONS;
}
