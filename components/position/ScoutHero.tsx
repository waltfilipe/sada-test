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

  const bioItems = [
    player.nationality,
    age ? `${age} anos` : null,
    player.height ? `${player.height} cm` : null,
    player.foot,
  ].filter(Boolean) as string[];

  const contractLabel =
    tm?.contract_remaining ?? (tm?.contract_until ? `até ${tm.contract_until}` : null);

  return (
    <section className="scout-hero">
      <div className="scout-hero-identity">
        <div className="scout-portrait" aria-hidden>
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt="" className="scout-portrait-photo" />
          ) : (
            <span className="scout-portrait-fallback">{playerInitials(player.name)}</span>
          )}
        </div>

        <div className="scout-hero-body">
          <header className="scout-hero-headline">
            <h1>{player.name}</h1>
            <p className="scout-hero-role">
              <span>{positionLabel}</span>
              <span className="scout-role-sep" aria-hidden>
                ·
              </span>
              <span>{player.club}</span>
              <span className="scout-role-sep" aria-hidden>
                ·
              </span>
              <span className={`scout-profile-label profile-${profileTone(player.profile)}`}>
                {player.profile}
              </span>
            </p>
          </header>

          {bioItems.length > 0 && (
            <p className="scout-hero-bio">
              {bioItems.map((item, index) => (
                <span key={item}>
                  {index > 0 && <span className="scout-bio-sep" aria-hidden>·</span>}
                  {item}
                </span>
              ))}
            </p>
          )}

          {(tm?.market_value || contractLabel) && (
            <div className="scout-contract-panel">
              <div className="scout-contract-metric">
                <span>Valor de mercado</span>
                <strong>{tm?.market_value ?? "—"}</strong>
              </div>
              <div className="scout-contract-metric">
                <span>Contrato restante</span>
                <strong>{contractLabel ?? "—"}</strong>
              </div>
              {tm?.profile_url && (
                <a
                  className="scout-tm-link"
                  href={tm.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Ver perfil no Transfermarkt"
                >
                  Transfermarkt ↗
                </a>
              )}
            </div>
          )}

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
          <em>
            #{player.ranks.geral} de {poolSize}
          </em>
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
