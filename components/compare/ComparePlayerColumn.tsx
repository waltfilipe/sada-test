"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { ClusterTag, clusterTagProps } from "@/components/position/ClusterTag";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { ProfileCard } from "@/components/position/profile/ProfileCard";
import { ScoutStatsSections } from "@/components/position/profile/ScoutStatsSections";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { sectionShortLabel } from "@/lib/sectionLabels";
import { allSectionGrades, buildSectionGradeLookup } from "@/lib/sectionGrades";
import { dominantRatingKey } from "@/lib/profileMeta";
import { playerInitials, ratingTier, formatRating, tierVars } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { ComparePlayerTendencies } from "./ComparePlayerTendencies";

export type CompareSide = "a" | "b" | "c";

type Props = {
  side: CompareSide;
  label: string;
  player: PlayerProfile;
  players: PlayerProfile[];
  family: PositionFamily;
  pool: PlayerProfile[];
  excludeIds: Set<string>;
  onChange: (id: string) => void;
};

function monthsRemaining(iso?: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return "—";
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  if (months < 0) return "Expirado";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function ComparePlayerColumn({
  side,
  label,
  player,
  players,
  family,
  pool,
  excludeIds,
  onChange,
}: Props) {
  const tm = player.transfermarkt;
  const profileRating = positionRating(player);
  const profileRank =
    player.ranks[dominantRatingKey(player.profile, family, player.hybrid_lean) ?? "geral"] ??
    player.ranks.geral;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const clusterProps = clusterTagProps(player);

  const gradeLookup = useMemo(() => buildSectionGradeLookup(pool, family), [pool, family]);
  const sectionGrades = useMemo(
    () => allSectionGrades(gradeLookup, player.player_id, family),
    [gradeLookup, player.player_id, family],
  );

  const gradeEntries = useMemo(
    () =>
      statSectionsForFamily(family)
        .map((section) => {
          const triple = sectionGrades[section.title];
          if (!triple?.geral) return null;
          return { title: section.title, short: sectionShortLabel(section.title), letter: triple.geral };
        })
        .filter((entry): entry is { title: string; short: string; letter: string } => Boolean(entry)),
    [family, sectionGrades],
  );

  return (
    <article className={`compare-player-column side-${side}`} aria-label={`Coluna ${label}: ${player.name}`}>
      <label className="compare-col-picker">
        <span>{label}</span>
        <select
          value={player.player_id}
          onChange={(event) => {
            const next = event.target.value;
            if (!excludeIds.has(next)) onChange(next);
          }}
        >
          {players.map((option) => (
            <option
              key={option.player_id}
              value={option.player_id}
              disabled={excludeIds.has(option.player_id) && option.player_id !== player.player_id}
            >
              {option.name} — {option.club}
            </option>
          ))}
        </select>
      </label>

      <header className="compare-col-hero">
        <div className="compare-col-photo">
          {tm?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tm.photo} alt={player.name} />
          ) : (
            <span className="compare-col-photo-fallback">{playerInitials(player.name)}</span>
          )}
        </div>

        <div className="compare-col-identity">
          <h2 className="compare-col-name">{player.name}</h2>
          <p className="compare-col-club">
            <ClubLogo club={player.club} size={16} />
            <span>{player.club}</span>
            <span aria-hidden="true">·</span>
            <span className="compare-col-position">{player.position}</span>
          </p>
          <div className="compare-col-tag-row">
            {clusterProps ? <ClusterTag {...clusterProps} /> : <ProfileTag {...profileTagProps(player)} />}
          </div>
        </div>

        {profileRating != null ? (
          <Tooltip content={`${player.profile} · #${profileRank}`}>
            <div className="compare-col-rating" style={tierVars(ratingTier(profileRating))}>
              <span className="compare-col-rating-letter">{formatRating(profileRating)}</span>
              <span className="compare-col-rating-rank">#{profileRank}</span>
            </div>
          </Tooltip>
        ) : null}
      </header>

      <dl className="compare-col-facts">
        <div>
          <dt>Valor</dt>
          <dd>{tm?.market_value ?? "—"}</dd>
        </div>
        <div>
          <dt>Contrato</dt>
          <dd>{monthsRemaining(tm?.contract_until)}</dd>
        </div>
        <div>
          <dt>Minutos</dt>
          <dd className="tabular">
            {player.minutes.toLocaleString("pt-BR")}
            {player.minutes_pct != null ? ` · ${Math.round(player.minutes_pct)}%` : ""}
          </dd>
        </div>
        {age != null ? (
          <div>
            <dt>Idade</dt>
            <dd>{age}</dd>
          </div>
        ) : null}
      </dl>

      {gradeEntries.length > 0 ? (
        <div className="compare-col-grades">
          {gradeEntries.map((entry) => (
            <span key={entry.title} className="compare-col-grade-chip" title={entry.title}>
              <GradeBadge letter={entry.letter} size="sm" />
              <em>{entry.short}</em>
            </span>
          ))}
        </div>
      ) : null}

      <div className="compare-col-stack">
        <div className="compare-col-profile">
          <ProfileCard player={player} family={family} players={pool} />
        </div>

        <div className="player-card compare-col-stats">
          <ScoutStatsSections player={player} family={family} />
        </div>

        <div className="player-card compare-col-tendencies-wrap">
          <ComparePlayerTendencies player={player} />
        </div>
      </div>

      <footer className="compare-col-foot">
        <Link className="compare-col-link" href={`/posicao/${family}?atleta=${player.player_id}`}>
          <i className="fa-solid fa-user" aria-hidden="true" /> Ver perfil
        </Link>
        {tm?.profile_url ? (
          <a className="compare-col-link" href={tm.profile_url} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
          </a>
        ) : null}
      </footer>
    </article>
  );
}
