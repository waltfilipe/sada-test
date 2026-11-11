export const ESTADUAIS_LEAGUE_IDS = [
  "est-paulista-a1",
  "est-carioca",
  "est-gaucho",
  "est-mineiro",
  "est-paranaense",
  "est-catarinense",
  "est-paulista-a2",
  "est-baiano",
  "est-cearense",
  "est-pernambucano",
  "est-paulista-a3",
  "est-goiano",
  "est-paraense",
  "est-alagoano",
  "est-potiguar",
  "est-paulista-a4",
  "est-copa-paulista",
] as const;

export type EstadualLeagueId = (typeof ESTADUAIS_LEAGUE_IDS)[number];

export type EstChampionship = {
  /** LeagueId da liga própria do campeonato (est-<slug>). */
  id: EstadualLeagueId;
  name: string;
  logo: string;
  brand: string;
  /** Rótulo do pool multi-ano nos reports; ausente quando só há uma temporada. */
  poolName?: string;
};

export type EstadualLevel = {
  key: "nv1" | "nv2" | "nv3" | "nv4";
  name: string;
  hint: string;
  members: EstChampionship[];
};

export const ESTADUAIS_LEVELS: EstadualLevel[] = [
  {
    key: "nv1",
    name: "Estaduais Nv1",
    hint: "Paulista A1 · Carioca · Gaúcho · Mineiro — pool multi-ano 2022–26.",
    members: [
      { id: "est-paulista-a1", name: "Paulista A1", logo: "/competitions/paulista.png", brand: "A1", poolName: "Paulista A1 · 22–26" },
      { id: "est-carioca", name: "Carioca", logo: "/competitions/carioca.png", brand: "CAR", poolName: "Carioca · 22–26" },
      { id: "est-gaucho", name: "Gaúcho", logo: "/competitions/gaucho.png", brand: "GAU", poolName: "Gaúcho · 22–26" },
      { id: "est-mineiro", name: "Mineiro", logo: "/competitions/mineiro.svg", brand: "MIN", poolName: "Mineiro · 22–26" },
    ],
  },
  {
    key: "nv2",
    name: "Estaduais Nv2",
    hint: "Paranaense · Catarinense · Paulista A2 · Baiano — pool multi-ano 2022–26.",
    members: [
      { id: "est-paranaense", name: "Paranaense", logo: "/competitions/paranaense.png", brand: "PAR", poolName: "Paranaense · 22–26" },
      { id: "est-catarinense", name: "Catarinense", logo: "/competitions/catarinense.png", brand: "CAT", poolName: "Catarinense · 22–26" },
      { id: "est-paulista-a2", name: "Paulista A2", logo: "/competitions/paulista-a2.png", brand: "A2", poolName: "Paulista A2 · 22–26" },
      { id: "est-baiano", name: "Baiano", logo: "/competitions/baiano.svg", brand: "BAI", poolName: "Baiano · 22–26" },
    ],
  },
  {
    key: "nv3",
    name: "Estaduais Nv3",
    hint: "Cearense · Pernambucano · Paulista A3 · Goiano. A3 com pool 2022–26; demais só 2026.",
    members: [
      { id: "est-cearense", name: "Cearense", logo: "/competitions/cearense.png", brand: "CEA" },
      { id: "est-pernambucano", name: "Pernambucano", logo: "/competitions/pernambucano.png", brand: "PER" },
      { id: "est-paulista-a3", name: "Paulista A3", logo: "/competitions/paulista-a3.png", brand: "A3", poolName: "Paulista A3 · 22–26" },
      { id: "est-goiano", name: "Goiano", logo: "/competitions/goiano.png", brand: "GOI" },
    ],
  },
  {
    key: "nv4",
    name: "Estaduais Nv4",
    hint: "Paraense · Alagoano · Potiguar · Paulista A4 · Copa Paulista (pool 2022–25).",
    members: [
      { id: "est-paraense", name: "Paraense", logo: "/competitions/paraense.png", brand: "PAE" },
      { id: "est-alagoano", name: "Alagoano", logo: "/competitions/alagoano.png", brand: "ALA" },
      { id: "est-potiguar", name: "Potiguar", logo: "/competitions/potiguar.png", brand: "POT" },
      { id: "est-paulista-a4", name: "Paulista A4", logo: "/competitions/paulista-a4.png", brand: "A4" },
      { id: "est-copa-paulista", name: "Copa Paulista", logo: "/competitions/paulista.svg", brand: "CP", poolName: "Copa Paulista · 22–25" },
    ],
  },
];
