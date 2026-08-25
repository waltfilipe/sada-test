"use client";

import {
  barPosition,
  letterGradePillColor,
  passGradeGradientColor,
  passGradePct,
  percentBarPosition,
} from "@/lib/gradeColors";

type Props = {
  score: number | null | undefined;
  letter?: string | null;
  displayScore?: number | null;
  scale?: "grade" | "percent";
};

export function MetricGradientBar({ score, letter, displayScore, scale = "grade" }: Props) {
  const pos = scale === "percent" ? percentBarPosition(score) : barPosition(score);
  const sectionColor = letterGradePillColor(letter, displayScore);
  const metricColor =
    score != null
      ? scale === "percent"
        ? passGradeGradientColor(score)
        : passGradeGradientColor(passGradePct(score))
      : sectionColor;

  return (
    <div className={`metric-gradient-bar${score == null ? " metric-gradient-bar-empty" : ""}`}>
      <div className="metric-gradient-bar-track">
        <div className="metric-gradient-bar-spectrum" aria-hidden="true" />
        <div className="metric-gradient-bar-midline" aria-hidden="true" />
        {score != null && (
          <>
            <div
              className="metric-gradient-bar-fill"
              style={{
                width: `${pos}%`,
                background: `linear-gradient(90deg, ${sectionColor}33 0%, ${metricColor}88 100%)`,
              }}
            />
            <span className="metric-gradient-bar-marker" style={{ left: `${pos}%` }} />
          </>
        )}
      </div>
    </div>
  );
}
