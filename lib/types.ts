export type PositionFamily =
  | "zagueiros"
  | "laterais"
  | "meio-campistas"
  | "extremos"
  | "atacantes";

export type AspectStat = {
  label: string;
  percentile: number;
};

export type AccuracyBadgeKind = "gold" | "silver" | "bronze";

export type AspectSubMetric = {
  label: string;
  percentile: number;
  display_value?: string;
  efficiency_pct?: number;
  efficiency_value?: string | null;
};

export type AspectItem = {
  label: string;
  grade: string;
  stats: AspectStat[];
  /** Expandable metric card. */
  kind?: "default" | "pass_certos" | "metric" | "metric_group" | "def_efficiency_group" | "construction_share";
  certos_per90?: number;
  percentile?: number;
  display_value?: string;
  /** Player share % for construction profile bars. */
  share_pct?: number;
  /** Position pool average share % (bar center). */
  pool_avg_pct?: number;
  /** Max % shown on the construction bar scale. */
  scale_max_pct?: number;
  /** Gradient bar variant for perfil de construção. */
  bar_key?: "pass_tendency" | "progressive_share" | "def_contact_style" | "def_foul_style";
  axis_left?: string;
  axis_right?: string;
  efficiency_pct?: number;
  efficiency_value?: string | null;
  /** @deprecated computed in UI from volume + efficiency percentiles */
  accuracy_badge?: AccuracyBadgeKind | null;
  /** Nested rows for Eficiência Defensiva group. */
  sub_metrics?: AspectSubMetric[];
  /** Header badge pair: ações c/ êxito × eficiência def. */
  pair_badge?: [number, number] | null;
};

export type TransfermarktInfo = {
  id: string | null;
  photo: string | null;
  market_value: string | null;
  market_value_eur: number | null;
  contract_until: string | null;
  contract_remaining: string | null;
  on_loan_from?: string | null;
  club: string | null;
  profile_url: string | null;
} | null;

import type { PositionCluster, ZagArchetype, ZagCluster, ZagClusterShares, ZagArchetypeRatings } from "@/lib/clusterMeta";

export type { PositionCluster, ZagArchetype, ZagCluster, ZagClusterShares, ZagArchetypeRatings };

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
  cluster?: PositionCluster | null;
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
    defensivos?: AspectItem[];
    construcao: AspectItem[];
    perfil_construcao?: AspectItem[];
    perfil_defensivo?: AspectItem[];
    ofensivos?: AspectItem[];
    terco_final?: AspectItem[];
    passes_finais?: AspectItem[];
    conducao_drible?: AspectItem[];
    finalizacao?: AspectItem[];
    ofensividade?: AspectItem[];
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
