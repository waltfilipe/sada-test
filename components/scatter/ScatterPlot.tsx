"use client";

import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useLoading } from "@/components/LoadingProvider";

export type ScatterPoint = {
  player_id: string;
  label: string;
  name: string;
  club: string;
  href: string;
  x: number;
  y: number;
};

export type ScatterHighlight = {
  id: string;
  tone: "a" | "b" | "c";
};

type Props = {
  points: ScatterPoint[];
  avgX: number;
  avgY: number;
  highlights: ScatterHighlight[];
  xLabel: string;
  yLabel: string;
  /** Fixed canvas size (print / thumbnails). Skips resize observer when set. */
  fixedSize?: { width: number; height: number };
  /** Unique id for SVG defs when multiple plots share one document. */
  instanceId?: string;
  /** When false, points are not clickable and tooltips are off. */
  interactive?: boolean;
};

const PAD = { top: 26, right: 20, bottom: 56, left: 88 };

const TONE_FILL = {
  a: "var(--side-a)",
  b: "var(--side-b)",
  c: "var(--side-c)",
} as const;

function formatAxis(value: number): string {
  const digits = Math.abs(value) >= 10 ? 1 : 2;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function bounds(values: number[], anchor: number) {
  const min = Math.min(...values, anchor);
  const max = Math.max(...values, anchor);
  const span = max - min || 1;
  const pad = span * 0.18;
  let lo = min - pad;
  const hi = max + pad;
  if (min >= 0) lo = Math.max(0, lo);
  return { min: lo, max: hi };
}

export function ScatterPlot({
  points,
  avgX,
  avgY,
  highlights,
  xLabel,
  yLabel,
  fixedSize,
  instanceId = "main",
  interactive = true,
}: Props) {
  const router = useRouter();
  const { beginLoad } = useLoading();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => fixedSize ?? { width: 720, height: 640 });
  const [tip, setTip] = useState<{ name: string; club: string; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (fixedSize) {
      setSize(fixedSize);
      return;
    }
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width < 80 || height < 80) return;
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fixedSize?.width, fixedSize?.height]);
  const width = size.width;
  const height = size.height;
  const toneById = useMemo(() => {
    const map = new Map<string, ScatterHighlight["tone"]>();
    for (const highlight of highlights) {
      if (highlight.id && !map.has(highlight.id)) map.set(highlight.id, highlight.tone);
    }
    return map;
  }, [highlights]);

  const chart = useMemo(() => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const xb = bounds(xs.length ? xs : [0], avgX);
    const yb = bounds(ys.length ? ys : [0], avgY);

    const plotW = Math.max(48, width - PAD.left - PAD.right);
    const plotH = Math.max(48, height - PAD.top - PAD.bottom);

    const scaleX = (value: number) => PAD.left + ((value - xb.min) / (xb.max - xb.min || 1)) * plotW;
    const scaleY = (value: number) => PAD.top + plotH - ((value - yb.min) / (yb.max - yb.min || 1)) * plotH;

    const ticks = 4;
    const xTicks = Array.from({ length: ticks + 1 }, (_, index) => {
      const value = xb.min + ((xb.max - xb.min) * index) / ticks;
      return { value, x: scaleX(value) };
    });
    const yTicks = Array.from({ length: ticks + 1 }, (_, index) => {
      const value = yb.min + ((yb.max - yb.min) * index) / ticks;
      return { value, y: scaleY(value) };
    });

    return { scaleX, scaleY, xTicks, yTicks };
  }, [points, avgX, avgY, width, height]);

  const { scaleX, scaleY, xTicks, yTicks } = chart;
  const plotLeft = PAD.left;
  const plotTop = PAD.top;
  const plotRight = width - PAD.right;
  const plotBottom = height - PAD.bottom;
  const avgLineX = scaleX(avgX);
  const avgLineY = scaleY(avgY);
  const quietPool = toneById.size > 0;

  const showTip = (event: MouseEvent, point: ScatterPoint) => {
    const boundsRect = wrapRef.current?.getBoundingClientRect();
    if (!boundsRect) return;
    setTip({
      name: point.name,
      club: point.club,
      x: event.clientX - boundsRect.left,
      y: event.clientY - boundsRect.top,
    });
  };

  const openPlayer = (point: ScatterPoint) => {
    if (!interactive) return;
    beginLoad();
    router.push(point.href);
  };

  const renderPoint = (point: ScatterPoint) => {
    const tone = toneById.get(point.player_id);
    const cx = scaleX(point.x);
    const cy = scaleY(point.y);
    const highlighted = Boolean(tone);
    const size = highlighted ? 8 : 5;
    const fill = tone ? TONE_FILL[tone] : "rgba(148, 163, 184, 0.9)";
    const opacity = highlighted ? 1 : quietPool ? 0.38 : 0.78;

    return (
      <g
        key={point.player_id}
        className={tone ? `pt-${tone} scatter-point` : "pt-pool scatter-point"}
        opacity={opacity}
        data-player-id={point.player_id}
        data-player-name={point.name}
        cursor="pointer"
        onMouseEnter={interactive ? (event) => showTip(event, point) : undefined}
        onMouseMove={interactive ? (event) => showTip(event, point) : undefined}
        onMouseLeave={interactive ? () => setTip(null) : undefined}
        onClick={() => openPlayer(point)}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPlayer(point);
                }
              }
            : undefined
        }
        role={interactive ? "link" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${point.name}, ${point.club}` : undefined}
      >
        <circle cx={cx} cy={cy} r={14} fill="transparent" />
        {highlighted && <circle cx={cx} cy={cy} r={size + 7} fill={fill} opacity={0.16} />}
        <rect
          x={cx - size}
          y={cy - size}
          width={size * 2}
          height={size * 2}
          transform={`rotate(45 ${cx} ${cy})`}
          fill={fill}
          stroke={highlighted ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.16)"}
          strokeWidth={highlighted ? 1 : 0.6}
        />
        {tone && (
          <text x={cx} y={cy - size - 10} textAnchor="middle" className={`scatter-tag tag-${tone}`}>
            {point.label}
          </text>
        )}
      </g>
    );
  };

  const pool = points.filter((point) => !toneById.has(point.player_id));
  const marked = points.filter((point) => toneById.has(point.player_id));

  return (
    <div className="scatter-plot-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="scatter-plot"
        role="img"
        aria-label={`Dispersão: ${xLabel} vs ${yLabel}`}
        data-x-label={xLabel}
        data-y-label={yLabel}
      >
        <defs>
          <linearGradient id={`scatter-bg-${instanceId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(20, 27, 38, 0.95)" />
            <stop offset="100%" stopColor="rgba(12, 17, 25, 0.98)" />
          </linearGradient>
        </defs>

        <rect
          x={plotLeft}
          y={plotTop}
          width={plotRight - plotLeft}
          height={plotBottom - plotTop}
          fill={`url(#scatter-bg-${instanceId})`}
          rx="14"
        />

        <rect x={avgLineX} y={plotTop} width={plotRight - avgLineX} height={avgLineY - plotTop} fill="rgba(52, 211, 153, 0.03)" />
        <rect x={plotLeft} y={plotTop} width={avgLineX - plotLeft} height={avgLineY - plotTop} fill="rgba(167, 139, 250, 0.025)" />
        <rect x={avgLineX} y={avgLineY} width={plotRight - avgLineX} height={plotBottom - avgLineY} fill="rgba(94, 234, 212, 0.025)" />
        <rect x={plotLeft} y={avgLineY} width={avgLineX - plotLeft} height={plotBottom - avgLineY} fill="rgba(148, 163, 184, 0.02)" />

        {xTicks.map((tick) => (
          <line key={`gx-${tick.value}`} x1={tick.x} y1={plotTop} x2={tick.x} y2={plotBottom} className="scatter-grid" />
        ))}
        {yTicks.map((tick) => (
          <line key={`gy-${tick.value}`} x1={plotLeft} y1={tick.y} x2={plotRight} y2={tick.y} className="scatter-grid" />
        ))}

        <line x1={avgLineX} y1={plotTop} x2={avgLineX} y2={plotBottom} className="scatter-avg-line" />
        <line x1={plotLeft} y1={avgLineY} x2={plotRight} y2={avgLineY} className="scatter-avg-line" />

        {pool.map(renderPoint)}
        {marked.map(renderPoint)}

        {xTicks.map((tick) => (
          <text key={`tx-${tick.value}`} x={tick.x} y={plotBottom + 20} textAnchor="middle" className="scatter-tick">
            {formatAxis(tick.value)}
          </text>
        ))}
        {yTicks.map((tick) => (
          <text key={`ty-${tick.value}`} x={plotLeft - 14} y={tick.y + 4} textAnchor="end" className="scatter-tick">
            {formatAxis(tick.value)}
          </text>
        ))}

        <text x={(plotLeft + plotRight) / 2} y={height - 16} textAnchor="middle" className="scatter-axis-label">
          {xLabel}
        </text>
        <text
          x={18}
          y={(plotTop + plotBottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${(plotTop + plotBottom) / 2})`}
          className="scatter-axis-label"
        >
          {yLabel}
        </text>

        <text x={avgLineX + 6} y={plotTop + 14} className="scatter-avg-tag">
          média
        </text>
      </svg>

      {tip && (
        <div className="scatter-tooltip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <strong className="scatter-tip-name">{tip.name}</strong>
          {tip.club ? <span className="scatter-tip-club">{tip.club}</span> : null}
        </div>
      )}
    </div>
  );
}
