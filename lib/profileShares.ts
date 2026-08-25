import {
  LAT_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
  archetypeTone,
  isLatCluster,
  latArchetypeTone,
} from "@/lib/clusterMeta";
import type { PlayerProfile } from "@/lib/types";

export type ProfileShareRow = {
  key: string;
  label: string;
  tone: string;
  share: number;
  rating: number;
};

export function buildProfileShareRows(player: PlayerProfile): ProfileShareRow[] {
  if (!player.cluster) return [];
  if (isLatCluster(player.cluster)) {
    const cluster = player.cluster;
    return LAT_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: latArchetypeTone(item.archetype),
      share:
        item.archetype === "Defensivo"
          ? cluster.shares.defensivo
          : item.archetype === "Construtor"
            ? cluster.shares.construtor
            : cluster.shares.ofensivo,
      rating:
        item.archetype === "Defensivo"
          ? cluster.ratings.defensivo
          : item.archetype === "Construtor"
            ? cluster.ratings.construtor
            : cluster.ratings.ofensivo,
    }));
  }
  const cluster = player.cluster;
  return ZAG_ARCHETYPE_META.map((item) => ({
    key: item.archetype,
    label: item.archetype,
    tone: archetypeTone(item.archetype),
    share:
      item.archetype === "Defensor de Área"
        ? cluster.shares.defensor_area
        : item.archetype === "Construtor"
          ? cluster.shares.construtor
          : cluster.shares.combativo,
    rating:
      item.archetype === "Defensor de Área"
        ? cluster.ratings.defensor_area
        : item.archetype === "Construtor"
          ? cluster.ratings.construtor
          : cluster.ratings.combativo,
  }));
}

export function sortedProfileShareRows(player: PlayerProfile): ProfileShareRow[] {
  return [...buildProfileShareRows(player)].sort((a, b) => b.share - a.share);
}
