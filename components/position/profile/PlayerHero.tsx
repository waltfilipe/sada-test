"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { gradeTier } from "@/lib/gradeColors";
import { playerInitials, ratingGradientStyle } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function HeroFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hero-fact">
      <span className="hero-fact-label">{label}</span>
      <span className="hero-fact-value">{children}</span>
    </div>
  );
}

function MarketCard({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hero-market-card">
      <span className="hero-market-icon" aria-hidden="true">
        <i className={`fa-solid ${icon}`} />
      </span>
      <span className="hero-market-copy">
        <span className="hero-market-label">{label}</span>
        <span className="hero-market-value">{children}</span>
      </span>
    </div>
  );
}

export function PlayerHero({ player, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const tm = player.transfermarkt;
  const contract =
    tm?.contract_remaining ?? (tm?.contract_until ? formatDate(tm.contract_until) : null);
  const overall = player.ratings.geral ?? player.rating;

  return (
    <section className="player-hero player-card" aria-label={`Perfil de ${player.name}`}>
      <div className="player-hero-photo">
        {tm?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tm.photo} alt={player.name} />
        ) : (
          <span className="player-hero-photo-fallback">{playerInitials(player.name)}</span>
        )}
      </div>

      <div className="player-hero-copy">
        <div className="player-hero-title-row">
          <div className="player-hero-title-wrap">
            <h2 className="player-hero-name">{player.name}</h2>
            <p className="player-hero-club">
              <ClubLogo club={player.club} size={17} />
              <span className="player-hero-club-name">{player.club}</span>
              <span className="player-hero-club-sep" aria-hidden="true">·</span>
              <span className="player-hero-position">{player.position}</span>
            </p>
          </div>

          <dl className="player-hero-facts">
            {age != null ? <HeroFact label="Idade">{age}</HeroFact> : null}
            {player.height ? <HeroFact label="Altura">{player.height} cm</HeroFact> : null}
            {player.foot ? <HeroFact label="Pé">{player.foot}</HeroFact> : null}
            {player.nationality ? <HeroFact label="País">{player.nationality}</HeroFact> : null}
          </dl>
        </div>

        <div className="player-hero-bottom-row">
          <div className="hero-market-strip">
            <MarketCard icon="fa-coins" label="Valor de mercado">
              {tm?.market_value ?? "—"}
            </MarketCard>
            <MarketCard icon="fa-file-signature" label="Contrato">
              {contract ?? "—"}
            </MarketCard>
            <MarketCard icon="fa-clock" label="Minutos">
              <span className="hero-market-minutes tabular">
                {player.minutes.toLocaleString("pt-BR")}
                {player.minutes_pct != null ? (
                  <Tooltip content={`${Math.round(player.minutes_pct)}% dos minutos possíveis na competição`}>
                    <span
                      className="identity-minutes-track identity-minutes-track-inline"
                      role="img"
                      aria-label={`${Math.round(player.minutes_pct)}% dos minutos possíveis`}
                    >
                      <span
                        className="identity-minutes-cover"
                        style={{ left: `${Math.max(0, Math.min(100, player.minutes_pct))}%` }}
                      />
                    </span>
                  </Tooltip>
                ) : null}
              </span>
            </MarketCard>
          </div>

          <div className="player-hero-actions">
            <Link
              className="btn btn-ghost btn-sm"
              href={`/comparar?posicao=${family}&a=${player.player_id}`}
            >
              <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Comparar
            </Link>
            {tm?.profile_url ? (
              <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {overall != null ? (
        <Tooltip content="Nota geral do atleta no pool da posição.">
          <div className="player-hero-rating" style={ratingGradientStyle(overall)}>
            <span className="player-hero-rating-label">Rating Geral</span>
            <span className="player-hero-rating-value tabular">
              {overall.toFixed(1).replace(".", ",")}
              <small>/10</small>
            </span>
            <span className="player-hero-rating-tier">{gradeTier(overall)}</span>
          </div>
        </Tooltip>
      ) : null}
    </section>
  );
}
