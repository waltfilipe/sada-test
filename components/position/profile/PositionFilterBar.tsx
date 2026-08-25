"use client";

import { useMemo } from "react";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  LAT_ARCHETYPE_META,
  LAT_HYBRID_BADGE_META,
  ZAG_ARCHETYPE_META,
  latArchetypeTone,
  archetypeTone,
} from "@/lib/clusterMeta";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { STAT_LETTER_OPTIONS } from "@/lib/playerStatFilters";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  clusterMode: boolean;
  clusterFilters: string[];
  profilesFilter: string[];
  onToggleClusterFilter: (key: string) => void;
  onToggleProfile: (profile: string) => void;
  profilesAvailable: string[];
  statSectionFilter: string | null;
  statLetterFilter: string | null;
  onStatSectionChange: (section: string | null) => void;
  onStatLetterChange: (letter: string | null) => void;
};

function profileCardAccent(family: PositionFamily, key: string): string {
  if (family === "laterais") {
    if (key === "Defensivo") return "#38bdf8";
    if (key === "Construtor") return "#a78bfa";
    if (key === "Ofensivo") return "#34d399";
    return "#67e8f9";
  }
  if (key === "Defensor de Área") return "#38bdf8";
  if (key === "Construtor") return "#a78bfa";
  if (key === "Combativo") return "#f97316";
  return "#67e8f9";
}

export function PositionFilterBar({
  family,
  clusterMode,
  clusterFilters,
  profilesFilter,
  onToggleClusterFilter,
  onToggleProfile,
  profilesAvailable,
  statSectionFilter,
  statLetterFilter,
  onStatSectionChange,
  onStatLetterChange,
}: Props) {
  const statSections = useMemo(() => statSectionsForFamily(family), [family]);

  const archetypeFilters =
    family === "laterais" ? LAT_ARCHETYPE_META : family === "zagueiros" ? ZAG_ARCHETYPE_META : null;

  const hybridFilters = family === "laterais" ? LAT_HYBRID_BADGE_META : null;

  const handleStatCardClick = (title: string) => {
    if (statSectionFilter === title) {
      onStatSectionChange(null);
      onStatLetterChange(null);
      return;
    }
    onStatSectionChange(title);
    onStatLetterChange(null);
  };

  return (
    <div className="profile-group-panel profile-filters-compact">
      {clusterMode && archetypeFilters ? (
        <div className="profile-filter-block">
          <span className="profile-league-filter-eyebrow">Perfil</span>
          <div className="profile-filter-card-grid">
            {archetypeFilters
              .filter((item) => item.archetype !== "Híbrido")
              .map((item) => {
                const tone =
                  family === "laterais"
                    ? latArchetypeTone(item.archetype as "Defensivo" | "Construtor" | "Ofensivo")
                    : archetypeTone(item.archetype as "Defensor de Área" | "Construtor" | "Combativo");
                const active = clusterFilters.includes(item.archetype);
                const accent = profileCardAccent(family, item.archetype);
                return (
                  <button
                    key={item.archetype}
                    type="button"
                    className={`reports-category-card profile-archetype-card cluster-${tone}${active ? " active" : ""}`}
                    style={{ "--category-accent": accent } as React.CSSProperties}
                    onClick={() => onToggleClusterFilter(item.archetype)}
                    aria-pressed={active}
                  >
                    <span className="reports-category-card-eyebrow">Perfil</span>
                    <span className="reports-category-card-title">{item.archetype}</span>
                  </button>
                );
              })}
            {hybridFilters?.map((item) => {
              const active = clusterFilters.includes(item.badge);
              return (
                <button
                  key={item.badge}
                  type="button"
                  className={`reports-category-card profile-archetype-card cluster-hibrido${active ? " active" : ""}`}
                  style={{ "--category-accent": "#fbbf24" } as React.CSSProperties}
                  onClick={() => onToggleClusterFilter(item.badge)}
                  aria-pressed={active}
                >
                  <span className="reports-category-card-eyebrow">Híbrido</span>
                  <span className="reports-category-card-title">{item.short_label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : profilesAvailable.length ? (
        <div className="profile-filter-block">
          <span className="profile-league-filter-eyebrow">Perfil</span>
          <div className="profile-filter-card-grid">
            {profilesAvailable.map((profile) => (
              <button
                key={profile}
                type="button"
                className={`reports-category-card profile-archetype-card${profilesFilter.includes(profile) ? " active" : ""}`}
                style={{ "--category-accent": "#67e8f9" } as React.CSSProperties}
                onClick={() => onToggleProfile(profile)}
                aria-pressed={profilesFilter.includes(profile)}
              >
                <span className="reports-category-card-eyebrow">Perfil</span>
                <span className="reports-category-card-title">{profile}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="profile-filter-block">
        <span className="profile-league-filter-eyebrow">Stats</span>
        <div className="profile-filter-card-grid profile-stat-filter-grid">
          {statSections.map((section) => {
            const active = statSectionFilter === section.title;
            return (
              <button
                key={section.title}
                type="button"
                className={`reports-category-card profile-stat-filter-card${active ? " active" : ""}`}
                style={{ "--category-accent": "#67e8f9" } as React.CSSProperties}
                onClick={() => handleStatCardClick(section.title)}
                aria-pressed={active}
              >
                <span className="reports-category-card-eyebrow">Stats</span>
                <span className="reports-category-card-title">{section.title}</span>
                {active && statLetterFilter ? (
                  <span className="profile-stat-filter-grade">
                    <GradeBadge letter={statLetterFilter} size="sm" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {statSectionFilter ? (
          <div className="stat-letter-filter-row">
            <span className="stat-letter-filter-label">Nota mínima em {statSectionFilter}</span>
            <div className="stat-letter-chips">
              {STAT_LETTER_OPTIONS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={`stat-letter-chip${statLetterFilter === letter ? " active" : ""}`}
                  onClick={() => onStatLetterChange(statLetterFilter === letter ? null : letter)}
                  aria-pressed={statLetterFilter === letter}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function profileDescription(player: PlayerProfile): { title: string; summary: string; accent: string } {
  if (player.cluster) {
    if (player.cluster.family === "laterais" || "defensivo" in player.cluster.shares) {
      return {
        title: player.cluster.archetype_label,
        summary: "",
        accent: "#34d399",
      };
    }
    return {
      title: player.cluster.archetype_label,
      summary: "",
      accent: "#a78bfa",
    };
  }
  return {
    title: player.profile,
    summary: "",
    accent: "#67e8f9",
  };
}
