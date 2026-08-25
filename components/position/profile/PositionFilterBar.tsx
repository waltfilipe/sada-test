"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  LAT_ARCHETYPE_META,
  LAT_HYBRID_BADGE_META,
  ZAG_ARCHETYPE_META,
  archetypeMetaFor,
  construtorBadgeMetaFor,
  isLatCluster,
  latArchetypeMetaFor,
} from "@/lib/clusterMeta";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  clusterMode: boolean;
  clusterFilters: string[];
  profilesFilter: string[];
  onToggleClusterFilter: (key: string) => void;
  onToggleProfile: (profile: string) => void;
  profilesAvailable: string[];
};

export function PositionFilterBar({
  family,
  players,
  clusterMode,
  clusterFilters,
  profilesFilter,
  onToggleClusterFilter,
  onToggleProfile,
  profilesAvailable,
}: Props) {
  const positionCards = useMemo(
    () =>
      POSITION_FAMILIES.map((item) => ({
        ...item,
        count: item.key === family ? players.length : undefined,
      })),
    [family, players.length],
  );

  const archetypeFilters =
    family === "laterais" ? LAT_ARCHETYPE_META : family === "zagueiros" ? ZAG_ARCHETYPE_META : null;

  const hybridFilters = family === "laterais" ? LAT_HYBRID_BADGE_META : null;

  return (
    <div className="profile-group-panel profile-filters-compact">
      <div className="profile-group-age-grid" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        {positionCards.map((item) => (
          <Link
            key={item.key}
            href={`/posicao/${item.slug}`}
            className={`reports-category-card profile-group-block-card${item.key === family ? " active" : ""}`}
            style={{ "--category-accent": "#67e8f9" } as React.CSSProperties}
          >
            <span className="reports-category-card-eyebrow">Posição</span>
            <span className="reports-category-card-title">{item.label}</span>
            {item.count != null ? (
              <span className="reports-category-card-foot">
                <span className="reports-category-card-count">{item.count} atletas</span>
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {clusterMode && archetypeFilters ? (
        <>
          <span className="profile-league-filter-eyebrow">Perfil / Arquétipo</span>
          <div className="position-profile-chips">
            {archetypeFilters.map((item) => (
              <button
                key={item.archetype}
                type="button"
                className={`position-profile-chip cluster-${"tone" in item ? item.tone : "construtor"} ${clusterFilters.includes(item.archetype) ? "active" : ""}`}
                onClick={() => onToggleClusterFilter(item.archetype)}
                aria-pressed={clusterFilters.includes(item.archetype)}
              >
                {item.archetype}
              </button>
            ))}
            {hybridFilters?.map((item) => (
              <button
                key={item.badge}
                type="button"
                className={`position-profile-chip cluster-hibrido ${clusterFilters.includes(item.badge) ? "active" : ""}`}
                onClick={() => onToggleClusterFilter(item.badge)}
                aria-pressed={clusterFilters.includes(item.badge)}
              >
                {item.short_label}
              </button>
            ))}
          </div>
        </>
      ) : profilesAvailable.length ? (
        <>
          <span className="profile-league-filter-eyebrow">Perfil</span>
          <div className="position-profile-chips">
            {profilesAvailable.map((profile) => (
              <button
                key={profile}
                type="button"
                className={`position-profile-chip ${profilesFilter.includes(profile) ? "active" : ""}`}
                onClick={() => onToggleProfile(profile)}
                aria-pressed={profilesFilter.includes(profile)}
              >
                {profile}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function profileDescription(player: PlayerProfile): { title: string; summary: string; accent: string } {
  if (player.cluster) {
    if (isLatCluster(player.cluster)) {
      const meta = latArchetypeMetaFor(player.cluster.archetype);
      return {
        title: player.cluster.archetype_label,
        summary: meta?.description ?? "Perfil tático do lateral.",
        accent: "#34d399",
      };
    }
    const meta = archetypeMetaFor(player.cluster.archetype);
    const badge = player.cluster.construtor_badge
      ? construtorBadgeMetaFor(player.cluster.construtor_badge)
      : null;
    return {
      title: badge?.short_label ?? player.cluster.archetype_label,
      summary: badge?.description ?? meta?.description ?? "Perfil tático do zagueiro.",
      accent: "#a78bfa",
    };
  }
  return {
    title: player.profile,
    summary: "Perfil de jogo identificado pelo modelo de clustering.",
    accent: "#67e8f9",
  };
}
