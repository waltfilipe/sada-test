"use client";

import { useMemo } from "react";

import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import {
  LAT_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
  archetypeTone,
  isLatCluster,
  latArchetypeTone,
  type LatArchetype,
  type PositionCluster,
  type ZagArchetype,
} from "@/lib/clusterMeta";
import { ArchetypeTooltip } from "./ArchetypeTooltip";

type Props = {
  cluster: PositionCluster;
};

type MixRow = {
  key: string;
  label: string;
  tone: string;
  share: number;
  rating: number;
  tooltipArchetype?: ZagArchetype | LatArchetype;
};

function buildRows(cluster: PositionCluster): MixRow[] {
  if (isLatCluster(cluster)) {
    const shareMap: Record<LatArchetype, number | undefined> = {
      Defensivo: cluster.shares.defensivo,
      Construtor: cluster.shares.construtor,
      Ofensivo: cluster.shares.ofensivo,
      Híbrido: undefined,
    };
    const ratingMap: Record<Exclude<LatArchetype, "Híbrido">, number> = {
      Defensivo: cluster.ratings.defensivo,
      Construtor: cluster.ratings.construtor,
      Ofensivo: cluster.ratings.ofensivo,
    };
    return LAT_ARCHETYPE_META.filter((item) => item.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: latArchetypeTone(item.archetype),
      share: shareMap[item.archetype] ?? 0,
      rating: ratingMap[item.archetype as Exclude<LatArchetype, "Híbrido">],
      tooltipArchetype: item.archetype,
    }));
  }

  const shareMap = {
    "Defensor de Área": cluster.shares.defensor_area,
    Construtor: cluster.shares.construtor,
    Combativo: cluster.shares.combativo,
  };
  const ratingMap = {
    "Defensor de Área": cluster.ratings.defensor_area,
    Construtor: cluster.ratings.construtor,
    Combativo: cluster.ratings.combativo,
  };
  return ZAG_ARCHETYPE_META.map((item) => ({
    key: item.archetype,
    label: item.archetype,
    tone: archetypeTone(item.archetype),
    share: shareMap[item.archetype],
    rating: ratingMap[item.archetype],
    tooltipArchetype: item.archetype,
  }));
}

export function ArchetypeMixCard({ cluster }: Props) {
  const rows = useMemo(() => buildRows(cluster), [cluster]);
  const activeKey = cluster.archetype === "Híbrido" ? null : cluster.archetype;

  const orderedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.key === activeKey) return -1;
        if (b.key === activeKey) return 1;
        return b.share - a.share;
      }),
    [rows, activeKey],
  );

  return (
    <article className="archetype-mix-card" aria-label="Perfil do atleta">
      <header className="archetype-mix-head">
        <h3>Perfil do Atleta</h3>
      </header>

      <ul className="archetype-mix-rows">
        {orderedRows.map((item) => {
          const active = item.key === activeKey;
          const token = ratingTier(item.rating);

          return (
            <li key={item.key} className="archetype-mix-item">
              <ArchetypeTooltip archetype={item.tooltipArchetype!} cluster={cluster} block>
                <div
                  className={`archetype-mix-row cluster-${item.tone} ${active ? "active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  <span className={`archetype-mix-name cluster-${item.tone}`}>{item.label}</span>
                  <span className="archetype-mix-share">{Math.round(item.share)}%</span>
                  <span className="archetype-mix-rating" style={tierVars(token)}>
                    Rating <strong>{formatRating(item.rating)}</strong>
                  </span>
                </div>
              </ArchetypeTooltip>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const ZAG_ARCHETYPES = new Set<string>(["Defensor de Área", "Construtor", "Combativo"]);
const LAT_ARCHETYPES = new Set<string>(["Defensivo", "Construtor", "Ofensivo", "Híbrido"]);
const CONSTRUTOR_BADGES = new Set<string>(["Construtor Âncora", "Construtor Nato"]);
const LAT_HYBRID_BADGES = new Set<string>(["Lateral Base", "Lateral Moderno", "Lateral Projetivo", "Lateral Completo"]);

export function playerMatchesClusterFilter(
  player: { cluster?: PositionCluster | null },
  filters: string[],
): boolean {
  if (!filters.length) return true;
  if (!player.cluster) return false;

  if (isLatCluster(player.cluster)) {
    const badgeFilters = filters.filter((key) => LAT_HYBRID_BADGES.has(key));
    const archetypeFilters = filters.filter((key) => LAT_ARCHETYPES.has(key));
    if (badgeFilters.length) return badgeFilters.includes(player.cluster.hybrid_badge ?? "");
    if (archetypeFilters.length) {
      if (player.cluster.archetype === "Híbrido") return archetypeFilters.includes("Híbrido");
      return archetypeFilters.includes(player.cluster.archetype);
    }
    return true;
  }

  const archetypeFilters = filters.filter((key) => ZAG_ARCHETYPES.has(key));
  const badgeFilters = filters.filter((key) => CONSTRUTOR_BADGES.has(key));

  if (badgeFilters.length) return badgeFilters.includes(player.cluster.construtor_badge ?? "");
  if (archetypeFilters.length) return archetypeFilters.includes(player.cluster.archetype);
  return true;
}
