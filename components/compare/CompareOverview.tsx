"use client";

import { useMemo } from "react";
import { SectionGradeStack } from "@/components/ui/SectionGradeStack";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { SectionGradeLookup } from "@/lib/sectionGrades";
import { getPlayerSectionGrades, playerSectionScore } from "@/lib/sectionGrades";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  playerA: PlayerProfile;
  playerB: PlayerProfile;
  family: PositionFamily;
  sectionGradeLookup: SectionGradeLookup;
  verdict: { winsA: number; winsB: number; total: number } | null;
};

type SectionSnapshot = {
  title: string;
  gradesA?: ReturnType<typeof getPlayerSectionGrades>;
  gradesB?: ReturnType<typeof getPlayerSectionGrades>;
  scoreA: number | null;
  scoreB: number | null;
  leader: "a" | "b" | "tie";
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function CompareOverview({ playerA, playerB, family, sectionGradeLookup, verdict }: Props) {
  const sections = useMemo<SectionSnapshot[]>(() => {
    const list: SectionSnapshot[] = [];
    for (const section of statSectionsForFamily(family)) {
      const scoreA = playerSectionScore(playerA, family, section.title);
      const scoreB = playerSectionScore(playerB, family, section.title);
      if (scoreA == null && scoreB == null) continue;
      const leader =
        scoreA != null && scoreB != null
          ? scoreA === scoreB
            ? "tie"
            : scoreA > scoreB
              ? "a"
              : "b"
          : "tie";
      list.push({
        title: section.title,
        gradesA: getPlayerSectionGrades(sectionGradeLookup, playerA.player_id, section.title),
        gradesB: getPlayerSectionGrades(sectionGradeLookup, playerB.player_id, section.title),
        scoreA: scoreA ?? null,
        scoreB: scoreB ?? null,
        leader,
      });
    }
    return list;
  }, [family, playerA, playerB, sectionGradeLookup]);

  const ratingDelta = (playerA.ratings.geral ?? playerA.rating) - (playerB.ratings.geral ?? playerB.rating);
  const ratingLeader = ratingDelta === 0 ? "tie" : ratingDelta > 0 ? "a" : "b";

  return (
    <section className="compare-overview" aria-label="Resumo da comparação">
      <div className="compare-overview-head">
        <div className="compare-overview-player side-a">
          <span className="compare-overview-name">{shortName(playerA.name)}</span>
          <strong className="compare-overview-rating tabular">
            {(playerA.ratings.geral ?? playerA.rating)?.toFixed(1) ?? "—"}
          </strong>
        </div>

        <div className="compare-overview-center">
          {verdict ? (
            <p className="compare-overview-score tabular">
              <b className="side-a">{verdict.winsA}</b>
              <span>–</span>
              <b className="side-b">{verdict.winsB}</b>
            </p>
          ) : null}
          <span className="compare-overview-caption">indicadores vencidos</span>
          <span
            className={`compare-overview-rating-delta tabular leader-${ratingLeader}`}
            title="Diferença de rating geral"
          >
            {ratingDelta > 0 ? "+" : ""}
            {ratingDelta.toFixed(1)} rating
          </span>
        </div>

        <div className="compare-overview-player side-b">
          <span className="compare-overview-name">{shortName(playerB.name)}</span>
          <strong className="compare-overview-rating tabular">
            {(playerB.ratings.geral ?? playerB.rating)?.toFixed(1) ?? "—"}
          </strong>
        </div>
      </div>

      <div className="compare-overview-sections">
        {sections.map((section) => (
          <article
            key={section.title}
            className={`compare-overview-chip leader-${section.leader}`}
            title={
              section.scoreA != null && section.scoreB != null
                ? `${section.title}: ${section.scoreA.toFixed(0)} vs ${section.scoreB.toFixed(0)} (percentil médio)`
                : section.title
            }
          >
            <span className="compare-overview-chip-title">{section.title}</span>
            <span className="compare-overview-chip-grades">
              <SectionGradeStack grades={section.gradesA} size="sm" />
              <span className="compare-overview-chip-vs">vs</span>
              <SectionGradeStack grades={section.gradesB} size="sm" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
