"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { activeProfileKeys, profileAccent, type ProfileShareRow } from "@/lib/profileShares";
import { formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

const SIZE = 300;
const CENTER = SIZE / 2;
const MAX_RADIUS = 96;
const LABEL_RADIUS = 118;
const MIN_RADIUS = MAX_RADIUS * 0.14;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

type Props = {
  player: PlayerProfile;
  rows: ProfileShareRow[];
  tooltipContent: (row: ProfileShareRow) => ReactNode;
};

type TooltipCoords = { x: number; y: number };

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function sectorPath(
  cx: number,
  cy: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  if (outerRadius <= 0.5) return "";

  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const start = polarPoint(cx, cy, outerRadius, startAngle);
  const end = polarPoint(cx, cy, outerRadius, endAngle);

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function labelLayout(midAngle: number, point: { x: number; y: number }) {
  const cos = Math.cos(midAngle);
  const sin = Math.sin(midAngle);
  const pad = 12;

  if (Math.abs(cos) > Math.abs(sin)) {
    if (cos > 0) {
      return {
        x: point.x + pad,
        y: point.y,
        textAnchor: "start" as const,
        dominantBaseline: "middle" as const,
      };
    }
    return {
      x: point.x - pad,
      y: point.y,
      textAnchor: "end" as const,
      dominantBaseline: "middle" as const,
    };
  }

  if (sin > 0) {
    return {
      x: point.x,
      y: point.y + pad,
      textAnchor: "middle" as const,
      dominantBaseline: "hanging" as const,
    };
  }

  return {
    x: point.x,
    y: point.y - pad,
    textAnchor: "middle" as const,
    dominantBaseline: "auto" as const,
  };
}

export function ProfilePolarChart({ player, rows, tooltipContent }: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<TooltipCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const activeKeys = useMemo(() => activeProfileKeys(player, rows), [player, rows]);
  const count = rows.length;
  const gap = count > 1 ? 0.035 : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const showTooltip = useCallback((key: string, coords: TooltipCoords) => {
    setHoveredKey(key);
    setTooltipCoords(coords);
  }, []);

  const hideTooltip = useCallback(() => {
    setHoveredKey(null);
    setTooltipCoords(null);
  }, []);

  const sectors = useMemo(() => {
    const slice = (Math.PI * 2) / count;
    return rows.map((row, index) => {
      const startAngle = -Math.PI / 2 + index * slice + gap / 2;
      const endAngle = -Math.PI / 2 + (index + 1) * slice - gap / 2;
      const midAngle = (startAngle + endAngle) / 2;
      const outerRadius = Math.max(MIN_RADIUS, (row.share / 100) * MAX_RADIUS);
      const labelPoint = polarPoint(CENTER, CENTER, LABEL_RADIUS, midAngle);
      const label = labelLayout(midAngle, labelPoint);
      const accent = profileAccent(row.label);
      const active = activeKeys.has(row.key);
      const hovered = hoveredKey === row.key;

      return {
        row,
        startAngle,
        endAngle,
        midAngle,
        outerRadius,
        labelPoint,
        label,
        accent,
        active,
        hovered,
        path: sectorPath(CENTER, CENTER, outerRadius, startAngle, endAngle),
      };
    });
  }, [rows, count, gap, activeKeys, hoveredKey]);

  const hoveredRow = hoveredKey ? rows.find((row) => row.key === hoveredKey) ?? null : null;

  const tooltipPortal =
    mounted && hoveredRow && tooltipCoords
      ? createPortal(
          <div
            className="profile-polar-tip-portal"
            style={{ left: tooltipCoords.x, top: tooltipCoords.y }}
            role="tooltip"
          >
            {tooltipContent(hoveredRow)}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={chartRef}
      className="profile-polar-chart"
      role="img"
      aria-label="Polar chart de afinidade com arquétipos"
      onMouseLeave={hideTooltip}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="profile-polar-svg" aria-hidden="true">
        <defs>
          <radialGradient id={`profile-polar-bg-${gradientId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(27, 231, 255, 0.04)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
          </radialGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={MAX_RADIUS + 8} className="profile-polar-bg-glow" />
        <circle cx={CENTER} cy={CENTER} r={MAX_RADIUS} fill={`url(#profile-polar-bg-${gradientId})`} />

        {GRID_LEVELS.map((level) => (
          <circle
            key={level}
            cx={CENTER}
            cy={CENTER}
            r={MAX_RADIUS * level}
            className="profile-polar-grid-ring"
          />
        ))}

        {sectors.map((sector) => {
          const dividerEnd = polarPoint(CENTER, CENTER, MAX_RADIUS, sector.startAngle);
          return (
            <line
              key={`divider-${sector.row.key}`}
              x1={CENTER}
              y1={CENTER}
              x2={dividerEnd.x}
              y2={dividerEnd.y}
              className="profile-polar-grid-spoke"
            />
          );
        })}

        {sectors.map((sector) => (
          <g
            key={sector.row.key}
            className={`profile-polar-sector${sector.active ? " is-active" : ""}${sector.hovered ? " is-hovered" : ""}`}
            style={{ "--sector-accent": sector.accent } as CSSProperties}
            onMouseEnter={(event) => showTooltip(sector.row.key, { x: event.clientX, y: event.clientY })}
            onMouseMove={(event) => showTooltip(sector.row.key, { x: event.clientX, y: event.clientY })}
          >
            <path d={sector.path} className="profile-polar-sector-hit" />
            <path d={sector.path} className="profile-polar-sector-fill" />
          </g>
        ))}

        {sectors.map((sector) => (
          <text
            key={`label-${sector.row.key}`}
            x={sector.label.x}
            y={sector.label.y}
            textAnchor={sector.label.textAnchor}
            dominantBaseline={sector.label.dominantBaseline}
            className="profile-polar-label-name"
            style={{ fill: sector.accent }}
          >
            {sector.row.label}
          </text>
        ))}
      </svg>

      <ul className="profile-polar-legend" aria-label="Legenda de arquétipos">
        {rows.map((row) => {
          const accent = profileAccent(row.label);
          const active = activeKeys.has(row.key);
          const hovered = hoveredKey === row.key;
          return (
            <li
              key={row.key}
              className={`profile-polar-legend-item${active ? " is-active" : ""}${hovered ? " is-hovered" : ""}`}
              style={{ "--sector-accent": accent } as CSSProperties}
              onMouseEnter={(event) => showTooltip(row.key, { x: event.clientX, y: event.clientY })}
              onMouseMove={(event) => showTooltip(row.key, { x: event.clientX, y: event.clientY })}
            >
              <span className="profile-polar-legend-label">{row.label}</span>
              <span className="profile-polar-legend-share tabular">{Math.round(row.share)}%</span>
            </li>
          );
        })}
      </ul>

      {tooltipPortal}
    </div>
  );
}
