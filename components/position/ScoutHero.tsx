"use client";

import { formatRating, ratingColor, familyBySlug, POSITION_FAMILIES } from "@/lib/positions";
import { playerInitials, profileTone } from "@/lib/scoutUi";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { RatingsMatrix } from "./RatingsMatrix";

type Props = {
  player: PlayerProfile;
  poolSize: number;
  family: PositionFamily;
};

export function ScoutHero({ player, poolSize, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const familyLabel = familyBySlug(family).label;
  const positionLabel = player.position || familyLabel;
  const tm = player.transfermarkt;

  const infoItems = [
    { label: "Nacionalidade", value: player.nationality ?? "—" },
    { label: "Idade", value: age ? `${age} anos` : "—" },
    { label: "Altura", value: player.height ? `${player.height} cm` : "—" },
    { label: "Pé", value: player.foot ?? "—" },
    { label: "Clube", value: player.club },
    { label: "Valor de mercado", value: tm?.market_value ?? "—" },
    {
      label: "Contrato restante",
      value: tm?.contract_remaining ?? (tm?.contract_until ? `até ${tm.contract_until}` : "—"),
    },
  ];

  return (
    <section className="scout-hero">
      <div className="scout-hero-main">
        <div className="scout-avatar" aria-hidden>
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt="" className="scout-avatar-photo" />
          ) : (
            playerInitials(player.name)
          )}
        </div>

        <div className="scout-hero-copy">
          <div className="scout-chip-row">
            <span className="scout-chip">{positionLabel}</span>
            <span className={`scout-chip profile-${profileTone(player.profile)}`}>{player.profile}</span>
            <span className="scout-chip muted">Pool · {poolSize} atletas</span>
            {tm?.profile_url && (
              <a className="scout-chip tm-link" href={tm.profile_url} target="_blank" rel="noreferrer">
                Transfermarkt
              </a>
            )}
          </div>
          <h1>{player.name}</h1>

          <dl className="scout-info-list">
            {infoItems.map((item) => (
              <div key={item.label} className="scout-info-item">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="scout-stats-highlight">
            <div className="scout-stat">
              <span>Minutos</span>
              <strong>{player.minutes.toLocaleString("pt-BR")}</strong>
            </div>
            <div className="scout-stat">
              <span>Gols</span>
              <strong>{player.goals}</strong>
            </div>
            <div className="scout-stat">
              <span>Assistências</span>
              <strong>{player.assists}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="scout-hero-ratings">
        <div className="scout-hero-score">
          <span>Rating geral</span>
          <strong style={{ color: ratingColor(player.ratings.geral) }}>{formatRating(player.ratings.geral)}</strong>
          <em>#{player.ranks.geral} no pool</em>
        </div>
        <RatingsMatrix player={player} variant="compact" />
      </div>
    </section>
  );
}

export function ScoutPositionNav({ family }: { family: PositionFamily }) {
  return (
    <nav className="scout-position-nav" aria-label="Posições">
      {POSITION_FAMILIES.map((item) => (
        <a
          key={item.key}
          href={`/posicao/${item.slug}`}
          className={item.key === family ? "active" : ""}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
