"use client";

import { ClubLogo } from "@/components/ClubLogo";
import { ClusterTag, clusterTagProps } from "@/components/position/ClusterTag";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { MinutesStat } from "@/components/position/MinutesStat";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { formatFoot } from "@/lib/feet";
import { dominantRatingKey } from "@/lib/profileMeta";
import { formatRating, playerInitials, ratingTier, tierVars } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

type Props = {
  side: "a" | "b";
  player: PlayerProfile;
  players: PlayerProfile[];
  onChange: (playerId: string) => void;
  compact?: boolean;
};

export function AthleteSlot({ side, player, players, onChange, compact = false }: Props) {
  const token = ratingTier(positionRating(player));
  const age = player.birth_year ? CURRENT_YEAR - player.birth_year : null;
  const tm = player.transfermarkt;
  const clusterProps = clusterTagProps(player);
  const rating = formatRating(positionRating(player));

  const picker = (
    <label className="slot-picker">
      <span>Atleta {side === "a" ? "1" : "2"}</span>
      <select value={player.player_id} onChange={(event) => onChange(event.target.value)}>
        {players.map((option) => (
          <option key={option.player_id} value={option.player_id}>
            {option.name} — {option.club}
          </option>
        ))}
      </select>
    </label>
  );

  if (compact) {
    return (
      <section className={`slot slot-compact side-${side}`} style={tierVars(token)}>
        {picker}
        <div className="slot-compact-row">
          <div className="slot-photo">
            {tm?.photo ? <PlayerPhoto src={tm.photo} alt="" /> : <span>{playerInitials(player.name)}</span>}
          </div>
          <div className="slot-identity">
            <h2>{player.name}</h2>
            <p className="slot-club">
              <ClubLogo club={player.club} size={16} />
              {player.club}
              <i aria-hidden>·</i>
              <span>{player.position}</span>
            </p>
            <p className="slot-compact-meta">
              {age != null ? `${age} anos` : "Idade —"}
              <i aria-hidden>·</i>
              {player.minutes.toLocaleString("pt-BR")} min
            </p>
          </div>
        </div>
      </section>
    );
  }

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: formatFoot(player.foot) ?? "—" },
    {
      label: "G / A",
      value: `${player.goals} / ${player.assists}`,
    },
    { label: "Nacionalidade", value: player.nationality ?? "—" },
  ];

  return (
    <section className={`slot side-${side}`} style={tierVars(token)}>
      {picker}

      <div className="slot-body">
        <div className="slot-photo">
          {tm?.photo ? (
            <PlayerPhoto src={tm.photo} alt="" />
          ) : (
            <span>{playerInitials(player.name)}</span>
          )}
        </div>

        <div className="slot-identity">
          <h2>{player.name}</h2>
          <p className="slot-club">
            <ClubLogo club={player.club} size={18} />
            {player.club}
            <i aria-hidden>·</i>
            <span>{player.position}</span>
          </p>
          {clusterProps ? <ClusterTag {...clusterProps} /> : <ProfileTag {...profileTagProps(player)} />}

          <div className="slot-rating">
            <strong>{rating}</strong>
            <em>
              {player.profile} · #{player.ranks[dominantRatingKey(player.profile, player.position_family, player.hybrid_lean) ?? "geral"] ?? player.ranks.geral}
            </em>
          </div>
        </div>
      </div>

      <MinutesStat
        minutes={player.minutes}
        minutesPct={player.minutes_pct}
        variant="prominent"
        className="slot-minutes"
      />

      <dl className="slot-facts">
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

      <footer className="slot-market">
        <div>
          <span>Valor de mercado</span>
          <strong>{tm?.market_value ?? "—"}</strong>
        </div>
        <div>
          <span>Contrato</span>
          <strong>{tm?.contract_remaining ?? "—"}</strong>
        </div>
      </footer>
    </section>
  );
}
