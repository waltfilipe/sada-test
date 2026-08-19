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
import { ClubLogo } from "@/components/ClubLogo";
import { MinutesStat } from "@/components/position/MinutesStat";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import type { PlayerSearchRow } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

export function PlayerResultRow({ player }: { player: PlayerSearchRow }) {
  const token = ratingTier(player.rating);
  const age = player.birth_year ? CURRENT_YEAR - player.birth_year : null;
  const tm = player.transfermarkt;

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: player.foot ?? "—" },
    { label: "G/A", value: `${player.goals}/${player.assists}` },
  ];

  return (
    <Link
      href={`/posicao/${player.position_family}?atleta=${player.player_id}`}
      className="result-row"
      style={tierVars(token)}
    >
      <div className="row-photo">
        {tm?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tm.photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </div>

      <div className="row-identity">
        <div className="row-name">
          <h3>{player.name}</h3>
          <ProfileTag {...profileTagProps(player)} />
        </div>
        <p className="row-club">
          <ClubLogo club={player.club} size={16} />
          {player.club}
          <i aria-hidden>·</i>
          <span>{player.position}</span>
        </p>

        <dl className="row-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.value}
                {fact.unit && <em>{fact.unit}</em>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="row-indices">
        {TENDENCY_META.map((item) => {
          const value = clampPercent(player.tendencies[item.key]);
          const indexToken = percentileTier(value);
          return (
            <div key={item.key} className="row-index" style={tierVars(indexToken)} title={item.hint}>
              <span className="row-index-label">{item.compact}</span>
              <strong>{Math.round(value)}</strong>
              <span className="row-index-track">
                <i style={{ width: `${Math.max(3, value)}%` }} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="row-aside">
        <MinutesStat
          minutes={player.minutes}
          minutesPct={player.minutes_pct}
          variant="compact"
          className="row-minutes"
        />

        <div className="row-rating">
          <strong>{formatRating(player.rating)}</strong>
          <span>Rating</span>
        </div>

        <div className="row-market">
          <div>
            <span>Valor</span>
            <strong>{tm?.market_value ?? "—"}</strong>
          </div>
          <div>
            <span>Contrato</span>
            <strong>{tm?.contract_remaining ?? "—"}</strong>
          </div>
        </div>
      </div>
    </Link>
  );
}
