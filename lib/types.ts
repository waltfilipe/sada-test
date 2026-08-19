export type PositionFamily =
  | "zagueiros"
  | "laterais"
  | "meio-campistas"
  | "extremos"
  | "meias-ofensivos"
  | "atacantes";

export type AspectStat = {
  label: string;
  percentile: number;
};

export type AccuracyBadgeKind = "gold" | "silver" | "bronze";

export type AspectItem = {
  label: string;
  grade: string;
  stats: AspectStat[];
  /** Pass aspects: certos/90 volume ranking with accuracy badge. */
  kind?: "default" | "pass_certos";
  certos_per90?: number;
  percentile?: number;
  accuracy_badge?: AccuracyBadgeKind | null;
};

export type TransfermarktInfo = {
  id: string | null;
  photo: string | null;
  market_value: string | null;
  market_value_eur: number | null;
  contract_until: string | null;
  contract_remaining: string | null;
  club: string | null;
  profile_url: string | null;
} | null;

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
  /** Share of competition minutes relative to the season leader in the pool (0–100). */
  minutes_pct?: number | null;
  rating: number;
  profile: string;
  hybrid_lean?: string | null;
  transfermarkt?: TransfermarktInfo;
};

export type Tendencies = {
  construcao: number;
  ofensividade: number;
  def1v1: number;
  contencao: number;
  duelo_aereo: number;
};

/** Summary enriched with the fields the advanced search needs to filter on. */
export type PlayerSearchRow = PlayerSummary & {
  goals: number;
  assists: number;
  tendencies: Tendencies;
};

export type PlayerProfile = PlayerSummary & {
  goals: number;
  assists: number;
  ratings: {
    geral: number;
    [profileKey: string]: number;
  };
  ranks: {
    geral: number;
    [profileKey: string]: number;
  };
  profile_shares: Record<string, number>;
  tendencies: Tendencies;
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
