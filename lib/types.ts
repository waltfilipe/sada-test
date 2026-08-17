export type PositionFamily =
  | "zagueiros"
  | "laterais"
  | "meio-campistas"
  | "extremos"
  | "meias-ofensivos"
  | "atacantes";

export type AspectItem = {
  label: string;
  grade: string;
  medal: "gold" | "silver" | "bronze" | null;
};

export type PlayerSummary = {
  player_id: string;
  name: string;
  club: string;
  label: string;
  position: string;
  position_family: PositionFamily;
  nationality: string | null;
  birth_year: number | null;
  height: number | null;
  foot: string | null;
  minutes: number;
  rating: number;
  profile: string;
};

export type PlayerProfile = PlayerSummary & {
  goals: number;
  assists: number;
  ratings: {
    geral: number;
    combativo: number;
    construtor: number;
    posicional: number;
  };
  ranks: {
    geral: number;
    combativo: number;
    construtor: number;
    posicional: number;
  };
  profile_shares: {
    combativo: number;
    construtor: number;
    posicional: number;
  };
  tendencies: {
    construcao: number;
    ofensividade: number;
    def1v1: number;
    contencao: number;
    duelo_aereo: number;
  };
  aspects: {
    defensivos: AspectItem[];
    construcao: AspectItem[];
    ofensivos: AspectItem[];
  };
  profiles_available: string[];
  scatter: Record<string, number>;
};

export type SiteMeta = {
  league: string;
  season: string;
  source: string;
  player_count: number;
  families: {
    key: PositionFamily;
    label: string;
    positions: string[];
    profiles: string[];
    count: number;
  }[];
  clubs: string[];
  nationalities: string[];
  filters: {
    height: [number, number];
    minutes: [number, number];
    birth_year: [number, number];
    rating: [number, number];
  };
  scatter_metrics: Record<PositionFamily, { key: string; label: string; field: string }[]>;
};
