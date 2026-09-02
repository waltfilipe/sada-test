"use client";

import { useMemo } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useFamilyGradeLookup } from "@/hooks/useFamilyGradeLookup";
import { usePlayerProfile } from "@/hooks/usePlayerProfileCache";
import { sortedProfileShareRows } from "@/lib/profileShares";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { getPlayerSectionGrade } from "@/lib/sectionGrades";
import { sectionShortLabel } from "@/lib/sectionLabels";
import {
  formatRating,
  ratingTier,
  ratingToLetterGrade,
  tierVars,
} from "@/lib/scoutTheme";
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

export function ShadowPlayerMiniReport({ player }: { player: PlayerSearchRow }) {
  const { profile, loading } = usePlayerProfile(player.player_id, true);
  const { lookup: gradeLookup } = useFamilyGradeLookup(player.position_family, true);

  const tm = player.transfermarkt ?? profile?.transfermarkt;
  const overall = profile?.ratings.geral ?? player.rating;
  const overallToken = ratingTier(overall);
  const overallLetter = ratingToLetterGrade(overall);

  const dominant = useMemo(() => {
    if (profile) {
      const rows = sortedProfileShareRows(profile);
      if (rows.length) return rows[0];
    }
    return {
      label: player.cluster?.archetype_label ?? player.profile,
      rating: overall,
    };
  }, [profile, player.cluster?.archetype_label, player.profile, overall]);

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
        <span className="shadow-mini-report-grade" style={tierVars(overallToken)}>
          {overallLetter}
        </span>
        <div className="shadow-mini-report-dominant">
          <span className="shadow-mini-report-dominant-rating tabular">
            {formatRating(dominant.rating)}
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
          <span className="shadow-mini-report-section-label">Valor</span>
          <strong>{tm?.market_value ?? "—"}</strong>
        </div>
        <div>
          <span className="shadow-mini-report-section-label">Contrato</span>
          <strong>{monthsRemaining(tm?.contract_until)}</strong>
        </div>
      </div>

      {loading ? <p className="shadow-mini-report-loading">Carregando perfil…</p> : null}
    </div>
  );
}

export function ShadowPlayerTooltip({
  player,
  children,
  block,
}: {
  player: PlayerSearchRow;
  children: React.ReactNode;
  block?: boolean;
}) {
  return (
    <Tooltip content={<ShadowPlayerMiniReport player={player} />} block={block}>
      {children}
    </Tooltip>
  );
}
