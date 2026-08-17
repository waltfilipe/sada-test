"use client";

import { formatRating } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { ratingGradientStyle } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  variant?: "full" | "compact";
};

export function RatingsMatrix({ player, variant = "full" }: Props) {
  const profileMeta = profileMetaForFamily(player.position_family);

  if (variant === "compact") {
    return (
      <div className="ratings-compact">
        {profileMeta.map((item) => {
          const value = player.ratings[item.key] ?? 0;
          const rank = player.ranks[item.key] ?? 0;
          return (
            <article key={item.key} className={`rating-compact tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong style={ratingGradientStyle(value)}>{formatRating(value)}</strong>
              <em>#{rank}</em>
            </article>
          );
        })}
      </div>
    );
  }

  const items = [{ key: "geral", label: "Geral", tone: "geral" }, ...profileMeta];

  return (
    <section className="scout-card ratings-matrix">
      <header>
        <p className="scout-kicker">Notas por perfil</p>
        <h2>Matriz de ratings</h2>
      </header>
      <div className="ratings-grid">
        {items.map((item) => {
          const value = player.ratings[item.key] ?? 0;
          const rank = player.ranks[item.key] ?? 0;
          return (
            <article key={item.key} className={`rating-tile tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong style={ratingGradientStyle(value)}>{formatRating(value)}</strong>
              <div className="rating-tile-foot">
                <em>Rank #{rank}</em>
                <div className="rating-meter">
                  <i style={{ width: `${Math.min(100, (value / 10) * 100)}%` }} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
