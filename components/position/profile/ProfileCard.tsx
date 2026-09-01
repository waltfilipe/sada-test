"use client";

import { useMemo } from "react";
import {
  latArchetypeMetaFor,
  archetypeMetaFor,
  type ArchetypeTrait,
} from "@/lib/clusterMeta";
import { activeProfileKeys, profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { ProfilePolarChart } from "./ProfilePolarChart";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

function profileMetaForLabel(label: string, family: PositionFamily) {
  if (family === "laterais") {
    return latArchetypeMetaFor(label as "Defensivo" | "Construtor" | "Ofensivo" | "Híbrido");
  }
  if (family === "zagueiros") {
    return archetypeMetaFor(label as "Defensor de Área" | "Construtor" | "Combativo");
  }
  return undefined;
}

function ProfileTooltipContent({
  label,
  rating,
  family,
}: {
  label: string;
  rating: number;
  family: PositionFamily;
}) {
  const meta = profileMetaForLabel(label, family);
  const accent = profileAccent(label);
  const ups = meta?.traits.filter((item) => item.direction === "up") ?? [];
  const downs = meta?.traits.filter((item) => item.direction === "down") ?? [];

  return (
    <div className="profile-archetype-tip">
      <div className="profile-archetype-tip-head">
        <span className="profile-archetype-tip-label">{label}</span>
        <span className="profile-archetype-tip-rating tabular" style={{ color: accent }}>
          Rating {formatRating(rating)}
        </span>
      </div>
      {meta?.description ? <p className="profile-archetype-tip-copy">{meta.description}</p> : null}
      <TraitList title="Valoriza" traits={ups} direction="up" />
      <TraitList title="Desvaloriza" traits={downs} direction="down" />
    </div>
  );
}

function TraitList({
  title,
  traits,
  direction,
}: {
  title: string;
  traits: ArchetypeTrait[];
  direction: "up" | "down";
}) {
  if (!traits.length) return null;
  return (
    <div className="profile-archetype-tip-traits">
      <span className="profile-archetype-tip-traits-title">{title}</span>
      <ul className={`profile-archetype-tip-list profile-archetype-tip-list-${direction}`}>
        {traits.map((trait) => (
          <li key={trait.label}>{trait.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function ProfileCard({ player, family }: Props) {
  const shareRows = useMemo(() => sortedProfileShareRows(player), [player]);
  const activeKeys = useMemo(() => activeProfileKeys(player, shareRows), [player, shareRows]);

  if (!shareRows.length) {
    return player.profile ? (
      <div className="player-card profile-perfil-card profile-perfil-card-score">
        <div className="profile-card-head">
          <span className="section-label">Perfil</span>
        </div>
        <p className="profile-share-inline-fallback">{player.profile}</p>
      </div>
    ) : null;
  }

  return (
    <div className="player-card profile-perfil-card profile-perfil-card-polar">
      <div className="profile-card-head">
        <span className="section-label">Perfil</span>
        <span className="profile-card-head-hint">Afinidade com cada arquétipo</span>
      </div>

      <ProfilePolarChart
        player={player}
        rows={shareRows}
        tooltipContent={(row) => (
          <ProfileTooltipContent label={row.label} rating={row.rating} family={family} />
        )}
      />

      <div className="profile-polar-active-tags" aria-label="Arquétipos em destaque">
        {shareRows
          .filter((row) => activeKeys.has(row.key))
          .map((row) => (
            <span
              key={row.key}
              className="profile-polar-active-tag"
              style={{ "--sector-accent": profileAccent(row.label) } as React.CSSProperties}
            >
              {row.label}
            </span>
          ))}
      </div>
    </div>
  );
}
