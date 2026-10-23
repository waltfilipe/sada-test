import type { LeagueId } from "./leagues";

export type EstadualTier = {
  label: string;
  items: { id: LeagueId; name: string; brand: string }[];
};

export const ESTADUAIS_HUB: EstadualTier[] = [
  {
    label: "Estaduais Nv1",
    items: [
      { id: "est-nv1-paulista", name: "Paulista", brand: "PA" },
      { id: "est-nv1-gaucho", name: "Gaúcho", brand: "RS" },
      { id: "est-nv1-mineiro", name: "Mineiro", brand: "MG" },
      { id: "est-nv1-carioca", name: "Carioca", brand: "RJ" },
    ],
  },
  {
    label: "Estaduais Nv2",
    items: [
      { id: "est-nv2-paranaense", name: "Paranaense", brand: "PR" },
      { id: "est-nv2-catarinense", name: "Catarinense", brand: "SC" },
      { id: "est-nv2-paulista-a2", name: "Paulista A2", brand: "A2" },
      { id: "est-nv2-baiano", name: "Baiano", brand: "BA" },
    ],
  },
  {
    label: "Estaduais Nv3",
    items: [
      { id: "est-nv3-cearense", name: "Cearense", brand: "CE" },
      { id: "est-nv3-pernambucano", name: "Pernambucano", brand: "PE" },
      { id: "est-nv3-paulista-a3", name: "Paulista A3", brand: "A3" },
      { id: "est-nv3-goiano", name: "Goiano", brand: "GO" },
    ],
  },
  {
    label: "Estaduais Nv4",
    items: [{ id: "est-nv4-outros", name: "Outros", brand: "BR" }],
  },
];

export const ESTADUAIS_LEAGUE_IDS = [
  "est-nv1-paulista",
  "est-nv1-gaucho",
  "est-nv1-mineiro",
  "est-nv1-carioca",
  "est-nv2-paranaense",
  "est-nv2-catarinense",
  "est-nv2-paulista-a2",
  "est-nv2-baiano",
  "est-nv3-cearense",
  "est-nv3-pernambucano",
  "est-nv3-paulista-a3",
  "est-nv3-goiano",
  "est-nv4-outros",
] as const satisfies readonly LeagueId[];

export type EstadualLeagueId = (typeof ESTADUAIS_LEAGUE_IDS)[number];
