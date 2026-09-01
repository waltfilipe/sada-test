"use client";

import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { activeProfileKeys, profileAccent, type ProfileShareRow } from "@/lib/profileShares";
import { formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

const SIZE = 300;
const CENTER = SIZE / 2;
const MAX_RADIUS = 96;
const LABEL_RADIUS = 126;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

type Props = {
  player: PlayerProfile;
  rows: ProfileShareRow[];
  tooltipContent: (row: ProfileShareRow) => ReactNode;
};

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

function shortArchetypeLabel(label: string): string {
  if (label === "Defensor de Área") return "Def. Área";
  return label;
}

export function ProfilePolarChart({ player, rows, tooltipContent }: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const activeKeys = useMemo(() => activeProfileKeys(player, rows), [player, rows]);
  const count = rows.length;
  const gap = count > 1 ? 0.035 : 0;

  const sectors = useMemo(() => {
    const slice = (Math.PI * 2) / count;
    return rows.map((row, index) => {
      const startAngle = -Math.PI / 2 + index * slice + gap / 2;
      const endAngle = -Math.PI / 2 + (index + 1) * slice - gap / 2;
      const midAngle = (startAngle + endAngle) / 2;
      const outerRadius = Math.max(6, (row.share / 100) * MAX_RADIUS);
      const labelPoint = polarPoint(CENTER, CENTER, LABEL_RADIUS, midAngle);
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
        accent,
        active,
        hovered,
        path: sectorPath(CENTER, CENTER, outerRadius, startAngle, endAngle),
      };
    });
  }, [rows, count, gap, activeKeys, hoveredKey]);

  const primaryArchetype = player.cluster?.archetype ?? rows[0]?.label ?? "Perfil";

  return (
    <div className="profile-polar-chart" role="img" aria-label={`Polar chart de afinidade: ${primaryArchetype}`}>
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
            onMouseEnter={() => setHoveredKey(sector.row.key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{ "--sector-accent": sector.accent } as CSSProperties}
          >
            <path d={sector.path} className="profile-polar-sector-hit" />
            <path d={sector.path} className="profile-polar-sector-fill" />
            <title>
              {sector.row.label}: {Math.round(sector.row.share)}% · Rating {formatRating(sector.row.rating)}
            </title>
          </g>
        ))}

        {sectors.map((sector) => {
          const labelRotation = (sector.midAngle * 180) / Math.PI;
          const flip = sector.midAngle > Math.PI / 2 || sector.midAngle < -Math.PI / 2;
          return (
            <g
              key={`label-${sector.row.key}`}
              transform={`translate(${sector.labelPoint.x} ${sector.labelPoint.y}) rotate(${flip ? labelRotation + 180 : labelRotation})`}
              className="profile-polar-label"
            >
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                className="profile-polar-label-name"
                style={{ fill: sector.accent }}
              >
                {shortArchetypeLabel(sector.row.label)}
              </text>
              <text
                y={12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="profile-polar-label-share tabular"
              >
                {Math.round(sector.row.share)}%
              </text>
            </g>
          );
        })}

        <circle cx={CENTER} cy={CENTER} r={34} className="profile-polar-center-disc" />
        <text x={CENTER} y={CENTER - 4} textAnchor="middle" className="profile-polar-center-kicker">
          Perfil
        </text>
        <text x={CENTER} y={CENTER + 12} textAnchor="middle" className="profile-polar-center-title">
          {primaryArchetype.length > 14 ? `${primaryArchetype.slice(0, 13)}…` : primaryArchetype}
        </text>
      </svg>

      <div className="profile-polar-hover-slot" aria-live="polite">
        {hoveredKey ? (
          <div className="profile-polar-hover-panel">
            {tooltipContent(sectors.find((sector) => sector.row.key === hoveredKey)!.row)}
          </div>
        ) : (
          <p className="profile-polar-hover-hint">Passe o mouse sobre um setor para ver detalhes do arquétipo</p>
        )}
      </div>

      <ul className="profile-polar-legend" aria-label="Legenda de arquétipos">
        {rows.map((row) => {
          const accent = profileAccent(row.label);
          const active = activeKeys.has(row.key);
          return (
            <li
              key={row.key}
              className={`profile-polar-legend-item${active ? " is-active" : ""}`}
              style={{ "--sector-accent": accent } as CSSProperties}
            >
              <span className="profile-polar-legend-swatch" aria-hidden="true" />
              <span className="profile-polar-legend-copy">
                <span className="profile-polar-legend-label">{row.label}</span>
                <span className="profile-polar-legend-meta tabular">
                  {Math.round(row.share)}% · Rating {formatRating(row.rating)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
