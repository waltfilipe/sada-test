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
import { profileAccent } from "@/lib/profileShares";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { STAT_LETTER_OPTIONS } from "@/lib/playerStatFilters";
import type { PositionFamily } from "@/lib/types";

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

const STAT_SECTION_ACCENT: Record<string, string> = {
  Defensivo: "#38bdf8",
  Aéreo: "#a78bfa",
  Construção: "#34d399",
  Ofensivo: "#fbbf24",
  "Terço Final": "#f472b6",
};

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
    <div className="profile-top-filters">
      <div className="profile-filter-panel profile-filter-panel-perfil">
        <div className="profile-filter-panel-head">
          <h3 className="profile-filter-panel-title">Perfil</h3>
          <span className="profile-filter-panel-hint">Filtre por arquétipo</span>
        </div>

        {clusterMode && archetypeFilters ? (
          <div className="profile-filter-chip-grid">
            {archetypeFilters
              .filter((item) => item.archetype !== "Híbrido")
              .map((item) => {
                const tone =
                  family === "laterais"
                    ? latArchetypeTone(item.archetype as "Defensivo" | "Construtor" | "Ofensivo")
                    : archetypeTone(item.archetype as "Defensor de Área" | "Construtor" | "Combativo");
                const active = clusterFilters.includes(item.archetype);
                const accent = profileAccent(item.archetype);
                return (
                  <button
                    key={item.archetype}
                    type="button"
                    className={`profile-filter-chip profile-filter-chip-profile cluster-${tone}${active ? " active" : ""}`}
                    style={{ "--chip-accent": accent } as React.CSSProperties}
                    onClick={() => onToggleClusterFilter(item.archetype)}
                    aria-pressed={active}
                  >
                    {item.archetype}
                  </button>
                );
              })}
            {hybridFilters?.map((item) => {
              const active = clusterFilters.includes(item.badge);
              return (
                <button
                  key={item.badge}
                  type="button"
                  className={`profile-filter-chip profile-filter-chip-profile cluster-hibrido${active ? " active" : ""}`}
                  style={{ "--chip-accent": "#fbbf24" } as React.CSSProperties}
                  onClick={() => onToggleClusterFilter(item.badge)}
                  aria-pressed={active}
                >
                  {item.short_label}
                </button>
              );
            })}
          </div>
        ) : profilesAvailable.length ? (
          <div className="profile-filter-chip-grid">
            {profilesAvailable.map((profile) => {
              const active = profilesFilter.includes(profile);
              const accent = profileAccent(profile);
              return (
                <button
                  key={profile}
                  type="button"
                  className={`profile-filter-chip profile-filter-chip-profile${active ? " active" : ""}`}
                  style={{ "--chip-accent": accent } as React.CSSProperties}
                  onClick={() => onToggleProfile(profile)}
                  aria-pressed={active}
                >
                  {profile}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="profile-filter-panel-empty">Sem perfis disponíveis.</p>
        )}
      </div>

      <div className="profile-filter-panel profile-filter-panel-stats">
        <div className="profile-filter-panel-head">
          <h3 className="profile-filter-panel-title">Stats</h3>
          <span className="profile-filter-panel-hint">Nota mínima na família</span>
        </div>

        <div className="profile-filter-chip-grid profile-filter-chip-grid-stats">
          {statSections.map((section) => {
            const active = statSectionFilter === section.title;
            const accent = STAT_SECTION_ACCENT[section.title] ?? "#67e8f9";
            return (
              <button
                key={section.title}
                type="button"
                className={`profile-filter-chip profile-filter-chip-stat${active ? " active" : ""}`}
                style={{ "--chip-accent": accent } as React.CSSProperties}
                onClick={() => handleStatCardClick(section.title)}
                aria-pressed={active}
              >
                {section.title}
                {active && statLetterFilter ? (
                  <GradeBadge letter={statLetterFilter} size="sm" />
                ) : null}
              </button>
            );
          })}
        </div>

        {statSectionFilter ? (
          <div className="stat-letter-slicer">
            <span className="stat-letter-slicer-label">{statSectionFilter}</span>
            <div className="stat-letter-chips stat-letter-chips-compact">
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
        ) : (
          <p className="profile-filter-panel-empty profile-filter-panel-empty-stats">
            Selecione uma família de stats para filtrar por letra.
          </p>
        )}
      </div>
    </div>
  );
}
