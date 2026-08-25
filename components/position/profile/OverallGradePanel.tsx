"use client";

import { passGradeGradientColor, passGradePct, gradeTier } from "@/lib/gradeColors";
import { Tooltip } from "@/components/ui/Tooltip";

type Props = {
  score?: number | null;
  title?: string;
  embedded?: boolean;
};

export function OverallGradePanel({ score, title = "Rating Geral", embedded = true }: Props) {
  const shellClass = embedded ? "pass-grade-section" : "player-card pass-grade-card";

  if (score == null) {
    return (
      <div className={shellClass}>
        <div className="pass-grade-head">
          <span className="pass-grade-title">{title}</span>
        </div>
        <p className="muted">Indisponível</p>
      </div>
    );
  }

  const color = passGradeGradientColor(passGradePct(score));
  const tier = gradeTier(score);
  const tierClass =
    score >= 8.2 ? "elite" : score >= 7 ? "very-good" : score >= 6 ? "good" : score >= 5 ? "average" : "below-average";

  return (
    <Tooltip content="Nota geral do atleta no pool da posição." block>
      <div className={`${shellClass} pass-grade-inline pass-grade-tier-${tierClass}`}>
        <div className="pass-grade-inline-row">
          <span className="pass-grade-title">{title}</span>
          <span
            className="pass-grade-tier"
            style={{ color, borderColor: `${color}55`, background: `${color}1a` }}
          >
            {tier}
          </span>
          <div className="pass-grade-value">
            <span className="pass-grade-score tabular" style={{ color }}>
              {score.toFixed(1)}
            </span>
            <span className="pass-grade-scale">/ 10</span>
          </div>
        </div>
      </div>
    </Tooltip>
  );
}
