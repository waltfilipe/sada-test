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
    labels: ["Duelos Defensivos", "Eficiência Defensiva"],
  },
  {
    title: "Aéreo",
    tone: "defensivos",
    labels: ["Aéreo"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Disputas com Bola", "Conduções Progressivas"],
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
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais",
    tone: "final",
    labels: ["Cruzamentos", "Passes Chave e Área", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Ofensividade",
    tone: "final",
    labels: ["Ofensividade"],
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
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais",
    tone: "final",
    labels: ["Finalizações", "Passes Chave e Área", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Ofensividade",
    tone: "final",
    labels: ["Ofensividade"],
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
    labels: ["Passes Chave e Área", "Cruzamentos", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Condução e Drible",
    tone: "dribles",
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
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

const AT_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Duelos Aéreos",
    tone: "defensivos",
    labels: ["Duelos Aéreos"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Passes Finais",
    tone: "final",
    labels: ["Passes Chave e Área", "Cruzamentos", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Condução e Drible",
    tone: "dribles",
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
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
  if (family === "atacantes") return AT_STAT_SECTIONS;
  if (family === "zagueiros") return ZAG_STAT_SECTIONS;
  return ZAG_STAT_SECTIONS;
}

export function statSectionTone(title: string): StatSectionTone {
  const all = [...ZAG_STAT_SECTIONS, ...LAT_STAT_SECTIONS, ...MC_STAT_SECTIONS, ...EX_STAT_SECTIONS, ...AT_STAT_SECTIONS];
  return all.find((section) => section.title === title)?.tone ?? "defensivos";
}
