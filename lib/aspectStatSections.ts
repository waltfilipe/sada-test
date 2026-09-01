import type { PositionFamily } from "@/lib/types";

export type StatSectionSpec = {
  title: string;
  labels: string[];
  /** Show medal count on section nav when badges are earned (Passes group). */
  showPassMedals?: boolean;
};

const ZAG_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    labels: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
    showPassMedals: true,
  },
  {
    title: "Dribles e Condução",
    labels: ["Duelos Ofensivos", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais e Ofensividade",
    labels: [],
  },
];

const LAT_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    labels: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
    showPassMedals: true,
  },
  {
    title: "Dribles e Condução",
    labels: ["Duelos Ofensivos", "Dribles", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais e Ofensividade",
    labels: ["Cruzamentos", "Passes Finas", "Ofensividade"],
  },
];

export function statSectionsForFamily(family: PositionFamily): StatSectionSpec[] {
  if (family === "laterais") return LAT_STAT_SECTIONS;
  if (family === "zagueiros") return ZAG_STAT_SECTIONS;
  return ZAG_STAT_SECTIONS;
}
