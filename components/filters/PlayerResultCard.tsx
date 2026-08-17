"use client";

import Link from "next/link";
import {
  TENDENCY_META,
  clampPercent,
  formatRating,
  percentileTier,
  playerInitials,
  ratingTier,
  tierVars,
} from "@/lib/scoutTheme";
import { profileTone } from "@/lib/scoutUi";
import type { PlayerSearchRow } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

export function PlayerResultCard({ player }: { player: PlayerSearchRow }) {
  const token = ratingTier(player.rating);
  const age = player.birth_year ? CURRENT_YEAR - player.birth_year : null;
  const tm = player.transfermarkt;

  const facts = [
    age ? `${age} anos` : null,
    player.height ? `${player.height} cm` : null,
    player.foot,
    `${player.minutes.toLocaleString("pt-BR")} min`,
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/posicao/${player.position_family}?atleta=${player.player_id}`}
      className="result-card"
      style={tierVars(token)}
    >
      <div className="result-head">
        <span className="result-photo">
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt="" loading="lazy" />
          ) : (
            playerInitials(player.name)
          )}
        </span>

        <span className="result-identity">
          <strong>{player.name}</strong>
          <em>{player.club}</em>
        </span>

        <span className="result-rating">{formatRating(player.rating)}</span>
      </div>

      <div className="result-tags">
        <span className={`profile-tag profile-${profileTone(player.profile)}`}>{player.profile}</span>
        <span className="result-position">{player.position}</span>
      </div>

      <p className="result-facts">
        {facts.map((fact, index) => (
          <span key={fact}>
            {index > 0 && <i aria-hidden>·</i>}
            {fact}
          </span>
        ))}
      </p>

      <div className="result-indices">
        {TENDENCY_META.map((item) => {
          const value = clampPercent(player.tendencies[item.key]);
          const indexToken = percentileTier(value);
          return (
            <span
              key={item.key}
              className="result-index"
              style={tierVars(indexToken)}
              title={`${item.label}: percentil ${Math.round(value)}`}
            >
              <i>{item.short}</i>
              <span className="result-index-track">
                <b style={{ height: `${Math.max(6, value)}%` }} />
              </span>
            </span>
          );
        })}
      </div>

      <footer className="result-market">
        <span>{tm?.market_value ?? "Valor n/d"}</span>
        <span>{tm?.contract_remaining ?? "Contrato n/d"}</span>
      </footer>
    </Link>
  );
}
