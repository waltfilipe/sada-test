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

/** Primary profile keys to highlight — for híbridos, the two largest shares. */
export function activeProfileKeys(player: PlayerProfile, shareRows: ProfileShareRow[]): Set<string> {
  if (!player.cluster) return new Set();
  if (player.cluster.archetype === "Híbrido") {
    return new Set(
      [...shareRows]
        .sort((a, b) => b.share - a.share)
        .slice(0, 2)
        .map((row) => row.key),
    );
  }
  return new Set([player.cluster.archetype]);
}

export function profileEmoji(label: string): string {
  const map: Record<string, string> = {
    "Defensor de Área": "🛡️",
    Construtor: "🎯",
    Combativo: "⚔️",
    Defensivo: "🛡️",
    Ofensivo: "⚡",
    Híbrido: "🔀",
  };
  return map[label] ?? "📊";
}

export function profileAccent(label: string): string {
  const map: Record<string, string> = {
    "Defensor de Área": "#1be7ff",
    Construtor: "#8980f5",
    Combativo: "#fe4a49",
    Defensivo: "#1be7ff",
    Ofensivo: "#31e981",
    Híbrido: "#fed766",
  };
  return map[label] ?? "#1be7ff";
}
