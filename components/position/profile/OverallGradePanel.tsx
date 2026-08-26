"use client";

import { passGradeGradientColor, passGradePct } from "@/lib/gradeColors";
import { Tooltip } from "@/components/ui/Tooltip";

type Props = {
  score?: number | null;
  title?: string;
  rank?: number | null;
  poolSize?: number | null;
};

export function OverallGradePanel({ score, title = "Rating Geral", rank, poolSize }: Props) {
  if (score == null) {
    return (
      <div className="overall-grade-panel overall-grade-panel-horizontal">
        <span className="overall-grade-title">{title}</span>
        <p className="muted overall-grade-unavailable">Indisponível</p>
      </div>
    );
  }

  const color = passGradeGradientColor(passGradePct(score));
  const rankLabel = rank != null && poolSize ? `${rank}º de ${poolSize}` : null;

  return (
    <Tooltip content="Nota geral do atleta no pool da posição." block>
      <div className="overall-grade-panel overall-grade-panel-horizontal">
        <div className="overall-grade-heading">
          <span className="overall-grade-title">{title}</span>
          {rankLabel ? <span className="overall-grade-rank tabular">{rankLabel}</span> : null}
        </div>
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
