"use client";

import { profileMetaForFamily } from "@/lib/profileMeta";
import { clampPercent, formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

export function ProfileRatings({ player, poolSize }: { player: PlayerProfile; poolSize: number }) {
  const items = profileMetaForFamily(player.position_family);

  return (
    <section className="sc-panel profile-ratings">
      <header className="sc-panel-head">
        <div>
          <p className="sc-eyebrow">Notas por perfil</p>
          <h2>Como ele pontua em cada função</h2>
        </div>
        <p className="sc-note">Escala 0–10 · ranking dentro do pool</p>
      </header>

      <div className="rating-cards">
        {items.map((item) => {
          const value = player.ratings[item.key] ?? 0;
          const rank = player.ranks[item.key] ?? poolSize;
          const token = ratingTier(value);
          const isBest = item.label === player.profile;

          return (
            <article
              key={item.key}
              className={`rating-card ${isBest ? "is-primary" : ""}`}
              style={tierVars(token)}
            >
              <div className="rating-card-head">
                <span className="rating-card-name">{item.label}</span>
                {isBest && <span className="rating-card-flag">Dominante</span>}
              </div>

              <strong className="rating-card-value">{formatRating(value)}</strong>

              <div className="meter">
                <i style={{ width: `${clampPercent(value * 10)}%` }} />
              </div>

              <div className="rating-card-foot">
                <span>#{rank}</span>
                <em>{token.label}</em>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
