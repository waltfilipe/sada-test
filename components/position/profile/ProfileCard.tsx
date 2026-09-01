"use client";

import { useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  latArchetypeMetaFor,
  archetypeMetaFor,
  type ArchetypeTrait,
} from "@/lib/clusterMeta";
import { activeProfileKeys, archetypeRank, profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
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

export function ProfileCard({ player, family, players }: Props) {
  const shareRows = useMemo(() => sortedProfileShareRows(player), [player]);
  const activeKeys = useMemo(() => activeProfileKeys(player, shareRows), [player, shareRows]);
  const poolSize = players.length;

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
    <div className="player-card profile-perfil-card profile-perfil-card-score">
      <div className="profile-card-head">
        <span className="section-label">Perfil</span>
        <span className="profile-card-head-hint">Afinidade com cada arquétipo</span>
      </div>
      <ul className="profile-perfil-list">
        {shareRows.map((row) => {
          const token = ratingTier(row.rating);
          const active = activeKeys.has(row.key);
          const accent = profileAccent(row.label);
          const shareWidth = Math.max(3, Math.min(100, row.share));
          return (
            <li key={row.key}>
              <Tooltip
                content={<ProfileTooltipContent label={row.label} rating={row.rating} family={family} />}
                block
              >
                <div
                  className={`profile-perfil-row cluster-${row.tone}${active ? " active" : ""}`}
                  style={{ "--profile-accent": accent } as React.CSSProperties}
                >
                  <div className="profile-perfil-row-top">
                    <div className="profile-perfil-row-copy">
                      <span className="profile-perfil-row-label">
                        {row.label}
                        <i className="fa-solid fa-circle-info profile-perfil-row-info" aria-hidden="true" />
                      </span>
                      <span className="profile-perfil-row-rating tabular" style={tierVars(token)}>
                        Rating {formatRating(row.rating)}
                        <span className="profile-perfil-row-rank">
                          {archetypeRank(player, players, row.label, family) ?? "—"}/{poolSize}
                        </span>
                      </span>
                    </div>
                    <span className="profile-perfil-row-share tabular">{Math.round(row.share)}%</span>
                  </div>
                  <span className="profile-perfil-row-bar" aria-hidden="true">
                    <span style={{ width: `${shareWidth}%` }} />
                  </span>
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
