"use client";

import Link from "next/link";
import { useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { flattenAspects } from "@/lib/aspectLookup";
import { formatFoot } from "@/lib/feet";
import type { LeagueId } from "@/lib/leagues";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { PlayerReportButton } from "@/components/position/profile/PlayerReport";
import { SimilarCrossLeagueModal } from "@/components/position/profile/SimilarCrossLeagueModal";
import { PlayerRunModal } from "@/components/position/profile/PlayerRunModal";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { PassTendencies } from "./PassTendencies";
import { PlayerSeasonSlicer } from "@/components/PlayerSeasonSlicer";
import { profileAccent } from "@/lib/profileShares";
import type { BrasileiraoSeason } from "@/lib/seasons";
import { CURRENT_SEASON } from "@/lib/seasons";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  /** Scout 2026 identity when ficha shows another year. */
  scoutPlayer?: PlayerProfile;
  isArchiveView?: boolean;
  fichaSeason?: string;
  similarSource?: { league: LeagueId; season: string };
  seasonSlicer?: {
    active: string;
    years: BrasileiraoSeason[];
    loading?: boolean;
    onSelect: (year: BrasileiraoSeason) => void;
  };
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

function oneDecimal(value: string): string {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function metricDisplay(player: PlayerProfile, label: string): string {
  for (const item of flattenAspects(player)) {
    const value = item.sub_metrics?.find((row) => row.label === label)?.display_value?.trim();
    if (!value) continue;
    return label === "xG" || label === "xA" ? oneDecimal(value) : value;
  }
  return "—";
}

function departureDateLabel(departure: { date?: string | null; to_season?: string | null }): string {
  if (departure.date) {
    const d = new Date(`${departure.date}T12:00:00`);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }
  return `janela de ${departure.to_season ?? "—"}`;
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
  wide,
  tooltip,
  children,
}: {
  icon: string;
  label: string;
  tone?: "warn" | "danger";
  wide?: boolean;
  tooltip?: string;
  children: React.ReactNode;
}) {
  const card = (
    <div className={`hero-market-card${tone ? ` hero-market-card-${tone}` : ""}${wide ? " hero-market-card-wide" : ""}`}>
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

export function PlayerHero({
  player,
  family,
  players,
  scoutPlayer,
  isArchiveView = false,
  fichaSeason,
  similarSource,
  seasonSlicer,
}: Props) {
  const { href, leagueId, season: hubSeason } = useLeague();
  const scout = scoutPlayer ?? player;
  const source = similarSource ?? { league: leagueId, season: hubSeason };
  const [similarOpen, setSimilarOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const showRun = Boolean(scout.physical_run) && !isArchiveView;
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
        : "Tempo restante de contrato.";
  const departure = player.departure ?? null;
  const heroAccent = profileAccent((player.profile ?? "").split("+").pop()!.trim());
  return (
    <section
      className="player-hero player-card"
      aria-label={`Perfil de ${player.name}`}
      style={{ "--hero-accent": heroAccent } as React.CSSProperties}
    >
      <div className="player-hero-main">
        <div className="player-hero-photo">
          <PlayerPhoto
            src={tm?.photo}
            alt={player.name}
            fallback={<span className="player-hero-photo-fallback">{playerInitials(player.name)}</span>}
          />
        </div>

        <div className="player-hero-copy">
          <div className="player-hero-title-wrap">
            <h2 className="player-hero-name">{player.name}</h2>
            {seasonSlicer ? (
              <div className="player-hero-season-row">
                <PlayerSeasonSlicer
                  inline
                  active={seasonSlicer.active}
                  years={seasonSlicer.years}
                  loading={seasonSlicer.loading}
                  onSelect={seasonSlicer.onSelect}
                />
              </div>
            ) : null}
            <p className="player-hero-club">
              <ClubLogo club={player.club} size={22} />
              <span className="player-hero-club-name">{player.club}</span>
              <span className="player-hero-club-sep" aria-hidden="true">·</span>
              <span className="player-hero-position">{player.position}</span>
            </p>
          </div>

          <div className="hero-bio-block">
            <dl className="player-hero-facts">
              {age != null ? <HeroFact label="Idade">{age}</HeroFact> : null}
              {player.height ? <HeroFact label="Altura">{player.height} cm</HeroFact> : null}
              {formatFoot(player.foot) ? <HeroFact label="Pé">{formatFoot(player.foot)}</HeroFact> : null}
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
        </div>
      </div>

      <aside className="hero-side" aria-label="Minutos, contrato e ações">
        <MarketCard
          icon="fa-clock"
          label="Minutos"
          wide
          tooltip={
            player.minutes_pct != null
              ? `${player.minutes.toLocaleString("pt-BR")} minutos, ${Math.round(player.minutes_pct)}% do líder da temporada.`
              : "Minutos jogados na temporada."
          }
        >
          <span className="hero-market-minutes hero-market-minutes-wide tabular">
            <span>{player.minutes.toLocaleString("pt-BR")}</span>
            {player.minutes_pct != null ? (
              <span
                className="identity-minutes-track identity-minutes-track-wide"
                role="img"
                aria-label={`${Math.round(player.minutes_pct)}% dos minutos do líder`}
              >
                <span
                  className="identity-minutes-cover"
                  style={{ left: `${Math.max(0, Math.min(100, player.minutes_pct))}%` }}
                />
              </span>
            ) : null}
          </span>
        </MarketCard>

        <div className="hero-market-pair">
          <MarketCard icon="fa-coins" label="Valor de mercado" tooltip="Estimativa de valor no Transfermarkt.">
            {tm?.market_value ?? "—"}
          </MarketCard>
          <MarketCard
            icon={onLoanFrom ? "fa-right-left" : "fa-file-signature"}
            label={onLoanFrom ? "Contrato · Empréstimo" : "Contrato"}
            tone={contractTone}
            tooltip={onLoanFrom ? `Emprestado por ${onLoanFrom}. ${contractTooltip}` : contractTooltip}
          >
            <span className="hero-contract-value">
              {months != null ? `${months} ${months === 1 ? "mês" : "meses"}` : "—"}
              {onLoanFrom ? (
                <span className="hero-loan-pill">
                  <ClubLogo club={onLoanFrom} size={14} />
                  {onLoanFrom}
                </span>
              ) : null}
            </span>
          </MarketCard>
        </div>

        {departure ? (
          <MarketCard
            icon="fa-right-left"
            label="Saiu do clube"
            wide
            tooltip={
              departure.date
                ? "Não atua mais por este clube. Data e valor conforme o Transfermarkt."
                : "Não atua mais por este clube; data exata indisponível."
            }
          >
            <span className="hero-transfer">
              <span className="hero-transfer-line">
                <i className="fa-solid fa-arrow-right hero-transfer-arrow" aria-hidden="true" />
                <ClubLogo club={departure.to_club} size={16} />
                <span className="hero-transfer-club">{departure.to_club}</span>
              </span>
              <span className="hero-transfer-sub">
                {departure.kind === "loan" ? "Emprestado" : "Transferido"} em{" "}
                {departureDateLabel(departure)}
                {departure.fee ? ` · ${departure.fee}` : ""}
              </span>
            </span>
          </MarketCard>
        ) : null}

        <div className={`hero-action-grid${showRun ? " hero-action-grid-has-run" : ""}`}>
          <div className="hero-action-cell hero-action-tendencies">
            <PassTendencies player={player} players={players} />
          </div>
          <div className="hero-action-cell hero-action-compare">
            <Tooltip content="Abre o comparador já com este atleta.">
              <Link className="btn btn-ghost btn-sm" href={href(`/comparar/${family}?a=${player.player_id}`)}>
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Comparar
              </Link>
            </Tooltip>
          </div>
          <div className="hero-action-cell hero-action-similar">
            <Tooltip content="Escolha a competição e veja o top 5 por estilo de jogo.">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSimilarOpen(true)}>
                <i className="fa-solid fa-shuffle" aria-hidden="true" /> Similares
              </button>
            </Tooltip>
          </div>
          {showRun ? (
            <div className="hero-action-cell hero-action-run">
              <Tooltip content="Distância, velocidade e sprints vs. atletas na mesma posição.">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRunOpen(true)}>
                  <i className="fa-solid fa-person-running" aria-hidden="true" /> GPS
                </button>
              </Tooltip>
            </div>
          ) : null}
          <div className="hero-action-cell hero-action-pdf">
            <Tooltip content="Gera um relatório em PDF deste atleta.">
              <span className="hero-action-slot">
                <PlayerReportButton
                  player={player}
                  scoutPlayer={scout}
                  family={family}
                  players={players}
                  primaryArchiveLabel={fichaSeason}
                />
              </span>
            </Tooltip>
          </div>
          {tm?.profile_url ? (
            <div className="hero-action-cell hero-action-transfermarkt">
              <Tooltip content="Abre o perfil no Transfermarkt.">
                <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
                </a>
              </Tooltip>
            </div>
          ) : null}
          <div className="hero-action-cell hero-action-add">
            <Tooltip content="Adiciona ao elenco ou à lista de observação.">
              <span className="hero-action-slot">
                <AddToShadowMenu playerId={scout.player_id} family={family} />
              </span>
            </Tooltip>
          </div>
        </div>
      </aside>

      {similarOpen ? (
        <SimilarCrossLeagueModal
          player={player}
          family={family}
          currentLeagueId={leagueId}
          sourceLeague={source.league}
          sourceSeason={source.season}
          players={players}
          onClose={() => setSimilarOpen(false)}
        />
      ) : null}
      {runOpen && scout.physical_run ? (
        <PlayerRunModal player={scout} onClose={() => setRunOpen(false)} />
      ) : null}
    </section>
  );
}
