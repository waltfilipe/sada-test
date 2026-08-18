"use client";

import type { CSSProperties } from "react";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { clampPercent, formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

const ZAG_KEY_ORDER = ["perfil", "construcao", "defesa"];

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

export function ProfileRatings({ player, poolSize }: { player: PlayerProfile; poolSize: number }) {
  const items = profileMetaForFamily(player.position_family);
  const ordered =
    player.position_family === "zagueiros"
      ? [...items].sort((a, b) => ZAG_KEY_ORDER.indexOf(a.key) - ZAG_KEY_ORDER.indexOf(b.key))
      : items;

  return (
    <section className="sc-panel profile-ratings">
      <header className="sc-panel-head sc-panel-head-compact">
        <div>
          <p className="sc-eyebrow">Notas por eixo</p>
          <h2>Construção, defesa e fit no perfil</h2>
        </div>
        <p className="sc-note">Escala 0–10</p>
      </header>

      <div className="rating-cards">
        {ordered.map((item) => {
          const value = player.ratings[item.key] ?? 0;
          const rank = player.ranks[item.key] ?? poolSize;

          return (
            <article
              key={item.key}
              className={`rating-card rating-card-axis ${rank <= 5 ? "is-top5" : ""}`}
              style={ratingCardStyle(value, rank)}
            >
              <div className="rating-card-head">
                <span className="rating-card-name">{item.label}</span>
                <em className="rating-card-rank">#{rank} no pool</em>
              </div>

              <div className="rating-card-body">
                <strong className="rating-card-value rating-card-value-axis">{formatRating(value)}</strong>
                <div className="rating-card-detail">
                  <div className="meter">
                    <i style={{ width: `${clampPercent(value * 10)}%`, background: "var(--rating-accent, var(--accent))" }} />
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
