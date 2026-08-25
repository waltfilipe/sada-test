"use client";

import { passGradeGradientColor, passGradePct } from "@/lib/gradeColors";
import { Tooltip } from "@/components/ui/Tooltip";

type Props = {
  score?: number | null;
  title?: string;
};

export function OverallGradePanel({ score, title = "Rating Geral" }: Props) {
  if (score == null) {
    return (
      <div className="overall-grade-panel overall-grade-panel-compact">
        <span className="overall-grade-title-vertical">{title}</span>
        <p className="muted overall-grade-unavailable">Indisponível</p>
      </div>
    );
  }

  const color = passGradeGradientColor(passGradePct(score));

  return (
    <Tooltip content="Nota geral do atleta no pool da posição." block>
      <div className="overall-grade-panel overall-grade-panel-compact">
        <span className="overall-grade-title-vertical">{title}</span>
        <div className="overall-grade-display">
          <span className="overall-grade-score tabular" style={{ color }}>
            {score.toFixed(1)}
          </span>
          <span className="overall-grade-scale">/ 10</span>
        </div>
      </div>
    </Tooltip>
  );
}
