"use client";

import { useMemo } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useFamilyGradeLookup } from "@/hooks/useFamilyGradeLookup";
import { usePlayerProfile } from "@/hooks/usePlayerProfileCache";
import { formatFoot } from "@/lib/feet";
import { sortedProfileShareRows } from "@/lib/profileShares";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { getPlayerSectionGrade } from "@/lib/sectionGrades";
import { sectionShortLabel } from "@/lib/sectionLabels";
import {
  gradeTier,
  ratingToLetterGrade,
  tierVars,
} from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import type { PlayerSearchRow } from "@/lib/types";

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

export function formatDominantFoot(foot: string | null | undefined): string {
  return formatFoot(foot) ?? "—";
}

function CompareColumn({
  title,
  player,
}: {
  title: string;
  player: PlayerSearchRow | null;
}) {
  const letter = player ? ratingToLetterGrade(player.rating) : null;
  return (
    <div className="shadow-mini-compare-col">
      <span className="shadow-mini-report-section-label">{title}</span>
      {player ? (
        <>
          <strong className="shadow-mini-compare-name">{player.name}</strong>
          <span className="shadow-mini-compare-meta">
            <span className="shadow-mini-letter" style={tierVars(gradeTier(letter ?? "C"))}>
              {letter}
            </span>
            {player.profile}
          </span>
          <span className="shadow-mini-compare-foot">Pé {formatDominantFoot(player.foot)}</span>
        </>
      ) : (
        <span className="shadow-mini-compare-empty">Sem titular nesta vaga</span>
      )}
    </div>
  );
}

export function ShadowPlayerMiniReport({
  player,
  compareWith,
  compareLabel = "Time sombra",
}: {
  player: PlayerSearchRow;
  /** Titular do outro time na mesma vaga (usado no time próprio). */
  compareWith?: PlayerSearchRow | null;
  compareLabel?: string;
}) {
  const { profile, loading } = usePlayerProfile(player.player_id, true);
  const { lookup: gradeLookup } = useFamilyGradeLookup(player.position_family, true);

  const tm = player.transfermarkt ?? profile?.transfermarkt;
  const profileRating = profile ? positionRating(profile) : player.rating;

  const dominant = useMemo(() => {
    if (profile) {
      const rows = sortedProfileShareRows(profile);
      if (rows.length) return rows[0];
    }
    return {
      label: player.cluster?.archetype_label ?? player.profile,
      rating: profileRating,
    };
  }, [profile, player.cluster?.archetype_label, player.profile, profileRating]);

  const sectionGrades = useMemo(() => {
    if (!gradeLookup) return [];
    return statSectionsForFamily(player.position_family)
      .map((section) => {
        const letter = getPlayerSectionGrade(gradeLookup, player.player_id, section.title);
        if (!letter) return null;
        return { title: section.title, short: sectionShortLabel(section.title), letter };
      })
      .filter((entry): entry is { title: string; short: string; letter: string } => Boolean(entry));
  }, [gradeLookup, player.player_id, player.position_family]);

  return (
    <div className="shadow-mini-report">
      <div className="shadow-mini-report-head">
        <strong>{player.name}</strong>
        <span className="shadow-mini-report-club">
          <ClubLogo club={player.club} size={14} />
          {player.club} · {player.position}
        </span>
      </div>

      <div className="shadow-mini-report-hero">
        <div className="shadow-mini-report-dominant shadow-mini-report-dominant-only">
          <span className="shadow-mini-report-dominant-rating tabular" style={tierVars(gradeTier(ratingToLetterGrade(profileRating)))}>
            {ratingToLetterGrade(profileRating)}
          </span>
          <span className="shadow-mini-report-profile">{dominant.label}</span>
        </div>
      </div>

      {sectionGrades.length > 0 ? (
        <div className="shadow-mini-report-blocks">
          <span className="shadow-mini-report-section-label">Blocos de posição</span>
          <div className="shadow-mini-report-block-grid">
            {sectionGrades.map((section) => (
              <div key={section.title} className="shadow-mini-report-block">
                <GradeBadge letter={section.letter} size="sm" />
                <span>{section.short}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shadow-mini-report-market">
        <div>
          <span className="shadow-mini-report-section-label">Pé</span>
          <strong>{formatDominantFoot(player.foot)}</strong>
        </div>
        <div>
          <span className="shadow-mini-report-section-label">Valor</span>
          <strong>{tm?.market_value ?? "—"}</strong>
        </div>
        <div>
          <span className="shadow-mini-report-section-label">Contrato</span>
          <strong>{monthsRemaining(tm?.contract_until)}</strong>
        </div>
      </div>

      {compareWith !== undefined ? (
        <div className="shadow-mini-compare">
          <CompareColumn title="Time próprio" player={player} />
          <CompareColumn title={compareLabel} player={compareWith} />
        </div>
      ) : null}

      {loading ? <p className="shadow-mini-report-loading">Carregando perfil…</p> : null}
    </div>
  );
}

export function ShadowPlayerTooltip({
  player,
  children,
  block,
  compareWith,
}: {
  player: PlayerSearchRow;
  children: React.ReactNode;
  block?: boolean;
  compareWith?: PlayerSearchRow | null;
}) {
  return (
    <Tooltip
      content={<ShadowPlayerMiniReport player={player} compareWith={compareWith} />}
      block={block}
    >
      {children}
    </Tooltip>
  );
}
