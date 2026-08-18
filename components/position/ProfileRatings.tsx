"use client";

import { dominantRatingKey, profileMetaForFamily } from "@/lib/profileMeta";
import { clampPercent, formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

export function ProfileRatings({ player, poolSize }: { player: PlayerProfile; poolSize: number }) {
  const items = profileMetaForFamily(player.position_family);
  const dominantKey = dominantRatingKey(player.profile, player.position_family, player.hybrid_lean);
  const isZag = player.position_family === "zagueiros";

  return (
    <section className="sc-panel profile-ratings">
      <header className="sc-panel-head">
        <div>
          <p className="sc-eyebrow">Notas por eixo</p>
          <h2>{isZag ? "Construção, defesa e fit no perfil" : "Como ele pontua em cada função"}</h2>
        </div>
        <p className="sc-note">Escala 0–10 · ranking dentro do pool</p>
      </header>

      <div className="rating-cards">
        {items.map((item) => {
          const value = player.ratings[item.key] ?? 0;
          const rank = player.ranks[item.key] ?? poolSize;
          const token = ratingTier(value);
          const isPrimary = isZag && item.key === "perfil";
          const isAxisDominant = dominantKey ? item.key === dominantKey : item.label === player.profile;
          const isBest = isPrimary || isAxisDominant;

          return (
            <article
              key={item.key}
              className={`rating-card ${isBest ? "is-primary" : ""}`}
              style={tierVars(token)}
            >
              <div className="rating-card-head">
                <span className="rating-card-name">{item.label}</span>
                {isPrimary ? <span className="rating-card-flag">Principal</span> : null}
                {!isPrimary && isAxisDominant ? <span className="rating-card-flag">Eixo</span> : null}
              </div>

              <div className="rating-card-body">
                <strong className="rating-card-value">{formatRating(value)}</strong>

                <div className="rating-card-detail">
                  <div className="meter">
                    <i style={{ width: `${clampPercent(value * 10)}%` }} />
                  </div>
                  <div className="rating-card-foot">
                    <span>
                      #{rank} <i>no pool</i>
                    </span>
                    <em>{token.label}</em>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
