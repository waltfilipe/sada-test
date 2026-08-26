"use client";

import { useMemo, useState } from "react";
import {
  LAT_ARCHETYPE_META,
  LAT_HYBRID_BADGE_META,
  ZAG_ARCHETYPE_META,
  latArchetypeTone,
  archetypeTone,
} from "@/lib/clusterMeta";
import { profileAccent } from "@/lib/profileShares";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { STAT_LETTER_OPTIONS, type StatLetterFilters } from "@/lib/playerStatFilters";
import type { PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  clusterMode: boolean;
  clusterFilters: string[];
  profilesFilter: string[];
  onToggleClusterFilter: (key: string) => void;
  onToggleProfile: (profile: string) => void;
  profilesAvailable: string[];
  statLetterFilters: StatLetterFilters;
  onStatLetterFilterChange: (sectionTitle: string, letter: string | null) => void;
};

export function PositionFilterBar({
  family,
  clusterMode,
  clusterFilters,
  profilesFilter,
  onToggleClusterFilter,
  onToggleProfile,
  profilesAvailable,
  statLetterFilters,
  onStatLetterFilterChange,
}: Props) {
  const statSections = useMemo(() => statSectionsForFamily(family), [family]);

  const archetypeFilters =
    family === "laterais" ? LAT_ARCHETYPE_META : family === "zagueiros" ? ZAG_ARCHETYPE_META : null;

  const hybridFilters = family === "laterais" ? LAT_HYBRID_BADGE_META : null;

  return (
    <div className="profile-top-filters">
      <div className="profile-filter-panel profile-filter-panel-perfil">
        <div className="profile-filter-panel-head">
          <h3 className="profile-filter-panel-title">Perfil</h3>
          <span className="profile-filter-panel-hint">Filtre por arquétipo</span>
        </div>

        {clusterMode && archetypeFilters ? (
          <div className="profile-filter-card-grid">
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
                    className={`profile-archetype-card player-card cluster-${tone}${active ? " active" : ""}`}
                    style={{ "--chip-accent": accent } as React.CSSProperties}
                    onClick={() => onToggleClusterFilter(item.archetype)}
                    aria-pressed={active}
                  >
                    <span className="profile-archetype-card-title">{item.archetype}</span>
                    <span className="profile-archetype-card-copy">{item.description}</span>
                  </button>
                );
              })}
            {hybridFilters?.map((item) => {
              const active = clusterFilters.includes(item.badge);
              return (
                <button
                  key={item.badge}
                  type="button"
                  className={`profile-archetype-card player-card cluster-hibrido${active ? " active" : ""}`}
                  style={{ "--chip-accent": "#fbbf24" } as React.CSSProperties}
                  onClick={() => onToggleClusterFilter(item.badge)}
                  aria-pressed={active}
                >
                  <span className="profile-archetype-card-title">{item.short_label}</span>
                  <span className="profile-archetype-card-copy">{item.description}</span>
                </button>
              );
            })}
          </div>
        ) : profilesAvailable.length ? (
          <div className="profile-filter-card-grid">
            {profilesAvailable.map((profile) => {
              const active = profilesFilter.includes(profile);
              const accent = profileAccent(profile);
              return (
                <button
                  key={profile}
                  type="button"
                  className={`profile-archetype-card player-card${active ? " active" : ""}`}
                  style={{ "--chip-accent": accent } as React.CSSProperties}
                  onClick={() => onToggleProfile(profile)}
                  aria-pressed={active}
                >
                  <span className="profile-archetype-card-title">{profile}</span>
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
          <span className="profile-filter-panel-hint">Filtre por nota mínima em cada família</span>
        </div>

        <div className="profile-stat-filter-grid">
          {statSections.map((section) => (
            <StatSectionFilterCard
              key={section.title}
              title={section.title}
              selectedFilter={statLetterFilters[section.title] ?? null}
              onFilterChange={(letter) => onStatLetterFilterChange(section.title, letter)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatSectionFilterCard({
  title,
  selectedFilter,
  onFilterChange,
}: {
  title: string;
  selectedFilter: string | null;
  onFilterChange: (letter: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="profile-stat-filter-card player-card">
      <div className="profile-stat-filter-card-head">
        <span className="profile-stat-filter-card-title">{title}</span>
        <div className="profile-stat-filter-card-actions">
          <div className="profile-stat-letter-filter">
            <button
              type="button"
              className={`profile-stat-letter-trigger${selectedFilter ? " active" : ""}`}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label={`Filtrar ${title} por nota mínima`}
              onClick={() => setOpen((value) => !value)}
            >
              {selectedFilter ?? "—"}
            </button>
            {open ? (
              <ul className="profile-stat-letter-menu" role="listbox">
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedFilter}
                    className={!selectedFilter ? "active" : ""}
                    onClick={() => {
                      onFilterChange(null);
                      setOpen(false);
                    }}
                  >
                    —
                  </button>
                </li>
                {STAT_LETTER_OPTIONS.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedFilter === option}
                      className={selectedFilter === option ? "active" : ""}
                      onClick={() => {
                        onFilterChange(selectedFilter === option ? null : option);
                        setOpen(false);
                      }}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
