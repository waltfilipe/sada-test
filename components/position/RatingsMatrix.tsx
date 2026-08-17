"use client";

import { formatRating, ratingColor } from "@/lib/positions";
import { ratingGradientStyle } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

const PROFILE_RATINGS = [
  { key: "combativo", label: "Combativo", rankKey: "combativo", tone: "combativo" },
  { key: "construtor", label: "Construtor", rankKey: "construtor", tone: "construtor" },
  { key: "posicional", label: "Posicional", rankKey: "posicional", tone: "posicional" },
] as const;

type Props = {
  player: PlayerProfile;
  variant?: "full" | "compact";
};

export function RatingsMatrix({ player, variant = "full" }: Props) {
  const items =
    variant === "compact"
      ? PROFILE_RATINGS
      : [{ key: "geral", label: "Geral", rankKey: "geral", tone: "geral" }, ...PROFILE_RATINGS];

  if (variant === "compact") {
    return (
      <div className="ratings-compact">
        {items.map((item) => {
          const value = player.ratings[item.key as keyof typeof player.ratings];
          const rank = player.ranks[item.rankKey as keyof typeof player.ranks];
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

  return (
    <section className="scout-card ratings-matrix">
      <header>
        <p className="scout-kicker">Notas por perfil</p>
        <h2>Matriz de ratings</h2>
      </header>
      <div className="ratings-grid">
        {items.map((item) => {
          const value = player.ratings[item.key as keyof typeof player.ratings];
          const rank = player.ranks[item.rankKey as keyof typeof player.ranks];
          const color = item.key === "geral" ? ratingColor(value) : undefined;
          return (
            <article key={item.key} className={`rating-tile tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong style={color ? { color } : ratingGradientStyle(value)}>{formatRating(value)}</strong>
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
