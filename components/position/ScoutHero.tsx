"use client";

import { formatRating, ratingColor } from "@/lib/positions";
import { playerInitials, profileTone } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";
import { RatingsMatrix } from "./RatingsMatrix";

type Props = {
  player: PlayerProfile;
  poolSize: number;
};

export function ScoutHero({ player, poolSize }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const geralColor = ratingColor(player.ratings.geral);

  return (
    <section className="scout-hero">
      <div className="scout-hero-main">
        <div className="scout-avatar" aria-hidden>
          {playerInitials(player.name)}
        </div>
        <div className="scout-hero-copy">
          <div className="scout-chip-row">
            <span className="scout-chip">Zagueiro</span>
            <span className={`scout-chip profile-${profileTone(player.profile)}`}>{player.profile}</span>
            <span className="scout-chip muted">Pool · {poolSize} atletas</span>
          </div>
          <h1>{player.name}</h1>
          <p className="scout-club">{player.club}</p>
          <div className="scout-meta-row">
            <span>{player.nationality ?? "—"}</span>
            <span>{age ? `${age} anos` : "—"}</span>
            <span>{player.height ? `${player.height} cm` : "—"}</span>
            <span>{player.foot ?? "—"}</span>
            <span>{player.minutes.toLocaleString("pt-BR")} min</span>
            <span>
              {player.goals}G · {player.assists}A
            </span>
          </div>
        </div>
      </div>

      <div className="scout-hero-ratings">
        <div className="scout-hero-score">
          <span>Rating geral</span>
          <strong style={{ color: geralColor }}>{formatRating(player.ratings.geral)}</strong>
          <em>#{player.ranks.geral} no pool</em>
        </div>
        <RatingsMatrix player={player} variant="compact" />
      </div>
    </section>
  );
}
