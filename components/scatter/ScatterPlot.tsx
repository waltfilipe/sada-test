"use client";

import { useMemo } from "react";

export type ScatterPoint = {
  player_id: string;
  label: string;
  x: number;
  y: number;
};

type Props = {
  points: ScatterPoint[];
  avgX: number;
  avgY: number;
  highlightA?: string;
  highlightB?: string;
  xLabel: string;
  yLabel: string;
};

const WIDTH = 720;
const HEIGHT = 480;
const PAD = { top: 28, right: 28, bottom: 52, left: 56 };

function formatAxis(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function bounds(values: number[], anchor: number) {
  const min = Math.min(...values, anchor);
  const max = Math.max(...values, anchor);
  const span = max - min || 1;
  return { min: min - span * 0.08, max: max + span * 0.08 };
}

export function ScatterPlot({
  points,
  avgX,
  avgY,
  highlightA,
  highlightB,
  xLabel,
  yLabel,
}: Props) {
  const chart = useMemo(() => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const xb = bounds(xs, avgX);
    const yb = bounds(ys, avgY);

    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;

    const scaleX = (value: number) =>
      PAD.left + ((value - xb.min) / (xb.max - xb.min || 1)) * plotW;
    const scaleY = (value: number) =>
      PAD.top + plotH - ((value - yb.min) / (yb.max - yb.min || 1)) * plotH;

    const ticks = 4;
    const xTicks = Array.from({ length: ticks + 1 }, (_, index) => {
      const value = xb.min + ((xb.max - xb.min) * index) / ticks;
      return { value, x: scaleX(value) };
    });
    const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
      const value = yb.min + ((yb.max - yb.min) * index) / ticks;
      return { value, y: scaleY(value) };
    });

    return { xb, yb, scaleX, scaleY, xTicks, yTicks, plotW, plotH };
  }, [points, avgX, avgY]);

  const { scaleX, scaleY, xTicks, yTicks } = chart;
  const plotLeft = PAD.left;
  const plotTop = PAD.top;
  const plotRight = WIDTH - PAD.right;
  const plotBottom = HEIGHT - PAD.bottom;
  const avgLineX = scaleX(avgX);
  const avgLineY = scaleY(avgY);

  const renderPoint = (point: ScatterPoint) => {
    const isA = point.player_id === highlightA;
    const isB = point.player_id === highlightB;
    const cx = scaleX(point.x);
    const cy = scaleY(point.y);
    const size = isA || isB ? 7 : 4;
    const fill = isA ? "var(--side-a)" : isB ? "var(--side-b)" : "rgba(107, 124, 147, 0.55)";
    const opacity = isA || isB ? 1 : 0.72;

    return (
      <g key={point.player_id} className={isA ? "pt-a" : isB ? "pt-b" : "pt-pool"} opacity={opacity}>
        {(isA || isB) && (
          <circle cx={cx} cy={cy} r={size + 7} fill={fill} opacity={0.14} />
        )}
        <rect
          x={cx - size}
          y={cy - size}
          width={size * 2}
          height={size * 2}
          transform={`rotate(45 ${cx} ${cy})`}
          fill={fill}
          stroke={isA || isB ? "rgba(255,255,255,0.35)" : "none"}
          strokeWidth={isA || isB ? 1 : 0}
        />
        {(isA || isB) && (
          <text
            x={cx}
            y={cy - size - 10}
            textAnchor="middle"
            className={`scatter-tag ${isA ? "tag-a" : "tag-b"}`}
          >
            {point.label}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="scatter-plot-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="scatter-plot" role="img" aria-label={`Dispersão: ${xLabel} vs ${yLabel}`}>
        <defs>
          <linearGradient id="scatter-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(20, 27, 38, 0.95)" />
            <stop offset="100%" stopColor="rgba(12, 17, 25, 0.98)" />
          </linearGradient>
        </defs>

        <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} fill="url(#scatter-bg)" rx="14" />

        {/* Quadrant washes */}
        <rect x={avgLineX} y={plotTop} width={plotRight - avgLineX} height={avgLineY - plotTop} fill="rgba(52, 211, 153, 0.03)" />
        <rect x={plotLeft} y={plotTop} width={avgLineX - plotLeft} height={avgLineY - plotTop} fill="rgba(167, 139, 250, 0.025)" />
        <rect x={avgLineX} y={avgLineY} width={plotRight - avgLineX} height={plotBottom - avgLineY} fill="rgba(94, 234, 212, 0.025)" />
        <rect x={plotLeft} y={avgLineY} width={avgLineX - plotLeft} height={plotBottom - avgLineY} fill="rgba(148, 163, 184, 0.02)" />

        {/* Grid */}
        {xTicks.map((tick) => (
          <line
            key={`gx-${tick.value}`}
            x1={tick.x}
            y1={plotTop}
            x2={tick.x}
            y2={plotBottom}
            className="scatter-grid"
          />
        ))}
        {yTicks.map((tick) => (
          <line
            key={`gy-${tick.value}`}
            x1={plotLeft}
            y1={tick.y}
            x2={plotRight}
            y2={tick.y}
            className="scatter-grid"
          />
        ))}

        {/* Average crosshairs */}
        <line x1={avgLineX} y1={plotTop} x2={avgLineX} y2={plotBottom} className="scatter-avg-line" />
        <line x1={plotLeft} y1={avgLineY} x2={plotRight} y2={avgLineY} className="scatter-avg-line" />

        {/* Pool points first, highlights on top */}
        {points
          .filter((point) => point.player_id !== highlightA && point.player_id !== highlightB)
          .map(renderPoint)}
        {points
          .filter((point) => point.player_id === highlightA || point.player_id === highlightB)
          .map(renderPoint)}

        {/* Axis ticks */}
        {xTicks.map((tick) => (
          <text key={`tx-${tick.value}`} x={tick.x} y={plotBottom + 20} textAnchor="middle" className="scatter-tick">
            {formatAxis(tick.value)}
          </text>
        ))}
        {yTicks.map((tick) => (
          <text key={`ty-${tick.value}`} x={plotLeft - 10} y={tick.y + 4} textAnchor="end" className="scatter-tick">
            {formatAxis(tick.value)}
          </text>
        ))}

        <text x={(plotLeft + plotRight) / 2} y={HEIGHT - 10} textAnchor="middle" className="scatter-axis-label">
          {xLabel}
        </text>
        <text
          x={14}
          y={(plotTop + plotBottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(plotTop + plotBottom) / 2})`}
          className="scatter-axis-label"
        >
          {yLabel}
        </text>

        <text x={avgLineX + 6} y={plotTop + 14} className="scatter-avg-tag">
          média
        </text>
      </svg>
    </div>
  );
}
