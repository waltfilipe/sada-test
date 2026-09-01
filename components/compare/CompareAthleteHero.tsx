"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { ClusterTag, clusterTagProps } from "@/components/position/ClusterTag";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { Tooltip } from "@/components/ui/Tooltip";
import { playerInitials, ratingGradientStyle } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  side: "a" | "b";
  player: PlayerProfile;
  players: PlayerProfile[];
  family: PositionFamily;
  onChange: (playerId: string) => void;
};

function monthsRemaining(iso?: string | null): number | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return null;
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}

function HeroFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hero-fact">
      <span className="hero-fact-label">{label}</span>
      <span className="hero-fact-value">{children}</span>
    </div>
  );
}

export function CompareAthleteHero({ side, player, players, family, onChange }: Props) {
  const tm = player.transfermarkt;
  const overall = player.ratings.geral ?? player.rating;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const months = monthsRemaining(tm?.contract_until);
  const onLoanFrom = tm?.on_loan_from ?? null;
  const clusterProps = clusterTagProps(player);

  return (
    <section className={`compare-hero slot side-${side}`} aria-label={`Atleta ${side === "a" ? "1" : "2"}: ${player.name}`}>
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

      <div className="compare-hero-body">
        <div className="player-hero-photo compare-hero-photo">
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt={player.name} />
          ) : (
            <span className="player-hero-photo-fallback">{playerInitials(player.name)}</span>
          )}
        </div>

        <div className="compare-hero-copy">
          <div className="compare-hero-title-row">
            <div>
              <h2 className="player-hero-name">{player.name}</h2>
              <p className="player-hero-club">
                <ClubLogo club={player.club} size={17} />
                <span className="player-hero-club-name">{player.club}</span>
                <span className="player-hero-club-sep" aria-hidden="true">
                  ·
                </span>
                <span className="player-hero-position">{player.position}</span>
              </p>
              {clusterProps ? <ClusterTag {...clusterProps} /> : <ProfileTag {...profileTagProps(player)} />}
            </div>

            {overall != null ? (
              <Tooltip content={`Rating geral · #${player.ranks.geral} no pool`}>
                <div className="compare-hero-rating" style={ratingGradientStyle(overall)}>
                  <span className="player-hero-rating-label">Rating Geral</span>
                  <span className="player-hero-rating-value tabular">
                    {overall.toFixed(1).replace(".", ",")}
                    <small>/10</small>
                  </span>
                </div>
              </Tooltip>
            ) : null}
          </div>

          <div className="hero-market-strip compare-hero-market">
            <div className="hero-market-card">
              <span className="hero-market-icon" aria-hidden="true">
                <i className="fa-solid fa-coins" />
              </span>
              <span className="hero-market-copy">
                <span className="hero-market-label">Valor</span>
                <span className="hero-market-value">{tm?.market_value ?? "—"}</span>
              </span>
            </div>
            <div
              className={`hero-market-card${months != null && months < 6 ? " hero-market-card-danger" : months != null && months < 12 ? " hero-market-card-warn" : ""}`}
            >
              <span className="hero-market-icon" aria-hidden="true">
                <i className={`fa-solid ${onLoanFrom ? "fa-right-left" : "fa-file-signature"}`} />
              </span>
              <span className="hero-market-copy">
                <span className="hero-market-label">{onLoanFrom ? "Empréstimo" : "Contrato"}</span>
                <span className="hero-market-value hero-contract-value">
                  {months != null ? `${months} ${months === 1 ? "mês" : "meses"}` : "—"}
                  {onLoanFrom ? (
                    <span className="hero-loan-pill">
                      <i className="fa-solid fa-right-left" aria-hidden="true" /> {onLoanFrom}
                    </span>
                  ) : null}
                </span>
              </span>
            </div>
            <div className="hero-market-card">
              <span className="hero-market-icon" aria-hidden="true">
                <i className="fa-solid fa-clock" />
              </span>
              <span className="hero-market-copy">
                <span className="hero-market-label">Minutos</span>
                <span className="hero-market-value hero-market-minutes tabular">
                  {player.minutes.toLocaleString("pt-BR")}
                  {player.minutes_pct != null ? (
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
                  ) : null}
                </span>
              </span>
            </div>
          </div>

          <dl className="player-hero-facts compare-hero-facts">
            {age != null ? <HeroFact label="Idade">{age}</HeroFact> : null}
            {player.height ? <HeroFact label="Altura">{player.height} cm</HeroFact> : null}
            {player.foot ? <HeroFact label="Pé">{player.foot}</HeroFact> : null}
            {player.nationality ? <HeroFact label="País">{player.nationality}</HeroFact> : null}
          </dl>

          <div className="compare-hero-links">
            <Link className="btn btn-ghost btn-sm" href={`/posicao/${family}?atleta=${player.player_id}`}>
              <i className="fa-solid fa-user" aria-hidden="true" /> Ver perfil
            </Link>
            {tm?.profile_url ? (
              <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
