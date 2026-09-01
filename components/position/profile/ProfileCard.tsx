"use client";

import { useMemo } from "react";
import { profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { ProfilePolarChart } from "./ProfilePolarChart";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

function ProfilePolarHoverTip({ label, rating }: { label: string; rating: number }) {
  const accent = profileAccent(label);

  return (
    <div className="profile-polar-tip" style={{ "--sector-accent": accent } as React.CSSProperties}>
      <span className="profile-polar-tip-label">{label}</span>
      <strong className="profile-polar-tip-rating tabular">{formatRating(rating)}</strong>
      <span className="profile-polar-tip-kicker">Rating do arquétipo</span>
    </div>
  );
}

export function ProfileCard({ player }: Props) {
  const shareRows = useMemo(() => sortedProfileShareRows(player), [player]);

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
        tooltipContent={(row) => <ProfilePolarHoverTip label={row.label} rating={row.rating} />}
      />
    </div>
  );
}
