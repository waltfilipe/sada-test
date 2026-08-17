"use client";

import { formatRating, ratingColor } from "@/lib/positions";
import type { PlayerProfile } from "@/lib/types";

const RATING_ITEMS = [
  { key: "geral", label: "Geral", rankKey: "geral" },
  { key: "combativo", label: "Combativo", rankKey: "combativo" },
  { key: "construtor", label: "Construtor", rankKey: "construtor" },
  { key: "posicional", label: "Posicional", rankKey: "posicional" },
] as const;

export function RatingsMatrix({ player }: { player: PlayerProfile }) {
  return (
    <section className="scout-card ratings-matrix">
      <header>
        <p className="scout-kicker">Notas por perfil</p>
        <h2>Matriz de ratings</h2>
      </header>
      <div className="ratings-grid">
        {RATING_ITEMS.map((item) => {
          const value = player.ratings[item.key];
          const rank = player.ranks[item.rankKey];
          return (
            <article key={item.key} className={`rating-tile tone-${item.key}`}>
              <span>{item.label}</span>
              <strong style={{ color: ratingColor(value) }}>{formatRating(value)}</strong>
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
