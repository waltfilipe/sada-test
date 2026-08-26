"use client";

import {
  LAT_ARCHETYPE_META,
  LAT_HYBRID_BADGE_META,
  ZAG_ARCHETYPE_META,
  latArchetypeTone,
  archetypeTone,
} from "@/lib/clusterMeta";
import { profileAccent } from "@/lib/profileShares";
import type { PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  clusterMode: boolean;
  clusterFilters: string[];
  profilesFilter: string[];
  onToggleClusterFilter: (key: string) => void;
  onToggleProfile: (profile: string) => void;
  profilesAvailable: string[];
  onClearProfileFilters: () => void;
};

export function PositionFilterBar({
  family,
  clusterMode,
  clusterFilters,
  profilesFilter,
  onToggleClusterFilter,
  onToggleProfile,
  profilesAvailable,
  onClearProfileFilters,
}: Props) {
  const hasProfileFilters = clusterFilters.length > 0 || profilesFilter.length > 0;

  const archetypeFilters =
    family === "laterais" ? LAT_ARCHETYPE_META : family === "zagueiros" ? ZAG_ARCHETYPE_META : null;

  const hybridFilters = family === "laterais" ? LAT_HYBRID_BADGE_META : null;

  return (
    <div className="profile-filter-panel profile-filter-panel-perfil">
      <div className="profile-filter-panel-head">
        <h3 className="profile-filter-panel-title">Perfil</h3>
        {hasProfileFilters ? (
          <button type="button" className="profile-filter-clear" onClick={onClearProfileFilters}>
            <i className="fa-solid fa-xmark" aria-hidden="true" /> Limpar
          </button>
        ) : (
          <span className="profile-filter-panel-hint">Filtre por arquétipo</span>
        )}
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
                style={{ "--chip-accent": "#fed766" } as React.CSSProperties}
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
  );
}
