"use client";

import Link from "next/link";
import { useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { flattenAspects } from "@/lib/aspectLookup";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { SimilarCrossLeagueModal } from "@/components/position/profile/SimilarCrossLeagueModal";
import { PlayerPhoto } from "@/components/PlayerPhoto";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
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

function metricDisplay(player: PlayerProfile, label: string): string {
  for (const item of flattenAspects(player)) {
    const value = item.sub_metrics?.find((row) => row.label === label)?.display_value?.trim();
    if (value) return value;
  }
  return "—";
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
  tone,
  tooltip,
  children,
}: {
  icon: string;
  label: string;
  tone?: "warn" | "danger";
  tooltip?: string;
  children: React.ReactNode;
}) {
  const card = (
    <div className={`hero-market-card${tone ? ` hero-market-card-${tone}` : ""}`}>
      <span className="hero-market-icon" aria-hidden="true">
        <i className={`fa-solid ${icon}`} />
      </span>
      <span className="hero-market-copy">
        <span className="hero-market-label">{label}</span>
        <span className="hero-market-value">{children}</span>
      </span>
    </div>
  );
  if (!tooltip) return card;
  return <Tooltip content={tooltip}>{card}</Tooltip>;
}

export function PlayerHero({ player, family }: Props) {
  const { href, leagueId } = useLeague();
  const [similarOpen, setSimilarOpen] = useState(false);
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const tm = player.transfermarkt;

  const months = monthsRemaining(tm?.contract_until);
  const onLoanFrom = tm?.on_loan_from ?? null;
  const contractTone: "warn" | "danger" | undefined =
    months != null && months < 6 ? "danger" : months != null && months < 12 ? "warn" : undefined;
  const contractTooltip =
    months != null && months < 6
      ? "Contrato termina em menos de 6 meses."
      : months != null && months < 12
        ? "Contrato termina em menos de 1 ano."
        : undefined;

  return (
    <section className="player-hero player-card" aria-label={`Perfil de ${player.name}`}>
      <div className="player-hero-photo">
        <PlayerPhoto
          src={tm?.photo}
          alt={player.name}
          fallback={<span className="player-hero-photo-fallback">{playerInitials(player.name)}</span>}
        />
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

          <div className="hero-market-strip">
            <MarketCard icon="fa-coins" label="Valor de mercado">
              {tm?.market_value ?? "—"}
            </MarketCard>
            <MarketCard
              icon={onLoanFrom ? "fa-right-left" : "fa-file-signature"}
              label={onLoanFrom ? "Contrato · Empréstimo" : "Contrato"}
              tone={contractTone}
              tooltip={
                onLoanFrom
                  ? `Emprestado por ${onLoanFrom}.${contractTooltip ? ` ${contractTooltip}` : ""}`
                  : contractTooltip
              }
            >
              <span className="hero-contract-value">
                {months != null ? `${months} ${months === 1 ? "mês" : "meses"}` : "—"}
                {onLoanFrom ? (
                  <span className="hero-loan-pill">
                    <i className="fa-solid fa-right-left" aria-hidden="true" /> {onLoanFrom}
                  </span>
                ) : null}
              </span>
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
        </div>

        <div className="player-hero-bottom-row">
          <div className="hero-bio-block">
            <dl className="player-hero-facts">
              {age != null ? <HeroFact label="Idade">{age}</HeroFact> : null}
              {player.height ? <HeroFact label="Altura">{player.height} cm</HeroFact> : null}
              {player.foot ? <HeroFact label="Pé">{player.foot}</HeroFact> : null}
              {player.nationality ? <HeroFact label="País">{player.nationality}</HeroFact> : null}
            </dl>
            <div className="hero-output" aria-label="Produção ofensiva">
              <div>
                <span>Gols</span>
                <strong className="tabular">{player.goals.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>xG</span>
                <strong className="tabular">{metricDisplay(player, "xG")}</strong>
              </div>
              <div>
                <span>Assistências</span>
                <strong className="tabular">{player.assists.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>xA</span>
                <strong className="tabular">{metricDisplay(player, "xA")}</strong>
              </div>
            </div>
          </div>

          <div className="player-hero-actions">
            <Link
              className="btn btn-ghost btn-sm"
              href={href(`/comparar?posicao=${family}&a=${player.player_id}`)}
            >
              <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Comparar
            </Link>
            {tm?.profile_url ? (
              <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
              </a>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSimilarOpen(true)}>
              <i className="fa-solid fa-shuffle" aria-hidden="true" /> Similares
            </button>
            <AddToShadowMenu playerId={player.player_id} family={family} />
          </div>
        </div>
      </div>

      {similarOpen ? (
        <SimilarCrossLeagueModal
          player={player}
          family={family}
          currentLeagueId={leagueId}
          onClose={() => setSimilarOpen(false)}
        />
      ) : null}
    </section>
  );
}
