"use client";

import { ClubLogo } from "@/components/ClubLogo";
import { formatRating, playerInitials, ratingTier, tierVars } from "@/lib/scoutTheme";
import { MinutesStat } from "@/components/position/MinutesStat";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import type { PlayerProfile } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

type Props = {
  side: "a" | "b";
  player: PlayerProfile;
  players: PlayerProfile[];
  onChange: (playerId: string) => void;
};

export function AthleteSlot({ side, player, players, onChange }: Props) {
  const token = ratingTier(player.ratings.geral);
  const age = player.birth_year ? CURRENT_YEAR - player.birth_year : null;
  const tm = player.transfermarkt;

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: player.foot ?? "—" },
  ];

  return (
    <section className={`slot side-${side}`} style={tierVars(token)}>
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

      <div className="slot-body">
        <div className="slot-photo">
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt="" />
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
          <ProfileTag {...profileTagProps(player)} />

          <div className="slot-rating">
            <strong>{formatRating(player.ratings.geral)}</strong>
            <em>
              Rating geral · #{player.ranks.geral}
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
