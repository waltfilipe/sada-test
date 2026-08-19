"use client";

import type { CSSProperties } from "react";

import { profileMetaForFamily } from "@/lib/profileMeta";
import { clampPercent, formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

function ratingCardStyle(value: number, rank: number): CSSProperties {
  if (rank <= 5) {
    return {
      background:
        "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(96, 165, 250, 0.06) 55%, transparent 100%)",
      borderColor: "rgba(96, 165, 250, 0.32)",
      ["--rating-accent" as string]: "#93c5fd",
    };
  }

  const t = Math.max(0, Math.min(1, (value - 5) / 4));
  const r = Math.round(239 + (52 - 239) * t);
  const g = Math.round(68 + (211 - 68) * t);
  const b = Math.round(68 + (153 - 68) * t);

  return {
    background: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.04) 60%, transparent 100%)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.24)`,
    ["--rating-accent" as string]: `rgb(${r}, ${g}, ${b})`,
  };
}

function secondaryAxes(family: PositionFamily) {
  if (family === "zagueiros") {
    return [
      { key: "construcao", label: "Construção" },
      { key: "defesa", label: "Defesa" },
    ];
  }

  return profileMetaForFamily(family)
    .filter((item) => item.key !== "perfil" && item.key !== "geral")
    .slice(0, 2);
}

type Props = {
  player: PlayerProfile;
  poolSize: number;
  family: PositionFamily;
};

export function DossierRatings({ player, poolSize, family }: Props) {
  const geral = player.ratings.geral;
  const geralRank = player.ranks.geral ?? poolSize;
  const geralToken = ratingTier(geral);
  const percentile = poolSize > 0 ? Math.max(1, 100 - Math.round(((poolSize - geralRank) / poolSize) * 100)) : 0;
  const axes = secondaryAxes(family);

  return (
    <div className="dossier-ratings">
      <article className="dossier-rating-hero" style={{ ...tierVars(geralToken), ...ratingCardStyle(geral, geralRank) }}>
        <span className="dossier-rating-label">Rating geral</span>
        <strong className="dossier-rating-value">{formatRating(geral)}</strong>
        <div className="dossier-rating-meta">
          <span>#{geralRank}</span>
          <i aria-hidden />
          <span>Top {percentile}%</span>
        </div>
        <div className="dossier-rating-meter meter">
          <i style={{ width: `${clampPercent(geral * 10)}%`, background: "var(--rating-accent, var(--tier-color))" }} />
        </div>
      </article>

      <div className="dossier-rating-cluster">
        {axes.map((axis) => {
          const value = player.ratings[axis.key] ?? 0;
          const rank = player.ranks[axis.key] ?? poolSize;
          const token = ratingTier(value);

          return (
            <article
              key={axis.key}
              className={`dossier-rating-axis ${rank <= 5 ? "is-top5" : ""}`}
              style={{ ...tierVars(token), ...ratingCardStyle(value, rank) }}
            >
              <div className="dossier-rating-axis-head">
                <span className="dossier-rating-label">{axis.label}</span>
                <em>#{rank}</em>
              </div>
              <strong className="dossier-rating-axis-value">{formatRating(value)}</strong>
              <div className="dossier-rating-meter meter meter-sm">
                <i style={{ width: `${clampPercent(value * 10)}%`, background: "var(--rating-accent, var(--tier-color))" }} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
