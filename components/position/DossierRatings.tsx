"use client";

import type { CSSProperties } from "react";

import { profileMetaForFamily } from "@/lib/profileMeta";
import { clampPercent, formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

function ratingAccentStyle(value: number, rank: number): CSSProperties {
  const token = ratingTier(value);
  const tierColor = tierVars(token)["--tier-color" as keyof ReturnType<typeof tierVars>] as string;

  if (rank <= 5) {
    return {
      ["--rating-accent" as string]: "#93c5fd",
      ["--rating-glow" as string]: "rgba(96, 165, 250, 0.35)",
    };
  }

  return {
    ["--rating-accent" as string]: tierColor ?? "#34d399",
    ["--rating-glow" as string]: "rgba(52, 211, 153, 0.22)",
  };
}

function secondaryAxes(family: PositionFamily) {
  if (family === "zagueiros") return [];

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
  const minutesPct = player.minutes_pct ?? null;

  return (
    <div className={`dossier-ratings ${axes.length === 0 ? "dossier-ratings-solo" : ""}`}>
      <article
        className="dossier-rating-hero dossier-rating-hero-modern"
        style={{ ...tierVars(geralToken), ...ratingAccentStyle(geral, geralRank) }}
      >
        <div className="dossier-rating-ring" aria-hidden>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="dossier-rating-ring-track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="dossier-rating-ring-fill"
              style={{
                strokeDasharray: `${clampPercent(geral * 10) * 3.27} 999`,
              }}
            />
          </svg>
          <div className="dossier-rating-ring-center">
            <strong className="dossier-rating-value">{formatRating(geral)}</strong>
            <span className="dossier-rating-label">Rating</span>
          </div>
        </div>

        <div className="dossier-rating-side">
          <div className="dossier-rating-meta">
            <span className="dossier-rating-rank">#{geralRank}</span>
            <span>Top {percentile}%</span>
          </div>
          {minutesPct != null ? (
            <div className="dossier-minutes-inline">
              <div className="dossier-minutes-head">
                <span>{player.minutes.toLocaleString("pt-BR")} min</span>
                <strong>{minutesPct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong>
              </div>
              <div className="dossier-minutes-track" aria-hidden>
                <i style={{ width: `${clampPercent(minutesPct)}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </article>

      {axes.length > 0 ? (
        <div className="dossier-rating-cluster">
          {axes.map((axis) => {
            const value = player.ratings[axis.key] ?? 0;
            const rank = player.ranks[axis.key] ?? poolSize;
            const token = ratingTier(value);

            return (
              <article
                key={axis.key}
                className={`dossier-rating-axis ${rank <= 5 ? "is-top5" : ""}`}
                style={{ ...tierVars(token), ...ratingAccentStyle(value, rank) }}
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
      ) : null}
    </div>
  );
}
