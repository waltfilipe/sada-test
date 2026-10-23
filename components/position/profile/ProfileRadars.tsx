"use client";

import { buildProfileShareRows, profileAccent } from "@/lib/profileShares";
import type { PlayerProfile } from "@/lib/types";

type Axis = { title: string; score: number; color: string };

const VB_W = 720;
const VB_H = 560;
const CX = 360;
const CY = 278;
const RADIUS = 132;

function wrapTitle(title: string): string[] {
  const words = title.split(" ");
  if (words.length === 1 || title.length <= 14) return [title];
  if (words.length === 2) return words;
  return [words.slice(0, -1).join(" "), words[words.length - 1]];
}

function RadarChart({ title, hint, axes }: { title: string; hint: string; axes: Axis[] }) {
  const count = axes.length;
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const r = (RADIUS * Math.max(0, Math.min(100, value))) / 100;
    return [CX + r * Math.cos(angle(index)), CY + r * Math.sin(angle(index))] as const;
  };
  const ring = (value: number) => axes.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  const shape = axes
    .map((item, index) => point(index, Math.max(6, item.score)).map((n) => n.toFixed(1)).join(","))
    .join(" ");

  return (
    <figure className="profile-radar-card">
      <figcaption>
        <strong>{title}</strong>
        <span>{hint}</span>
      </figcaption>
      <svg className="scout-radar" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label={title}>
        {[25, 50, 75, 100].map((value) => (
          <polygon key={value} points={ring(value)} className={value === 50 ? "scout-radar-ring is-median" : "scout-radar-ring"} />
        ))}
        {axes.map((item, index) => {
          const [x, y] = point(index, 100);
          return <line key={`${item.title}-axis`} x1={CX} y1={CY} x2={x} y2={y} className="scout-radar-axis" />;
        })}
        <polygon points={shape} className="scout-radar-shape" />
        {axes.map((item, index) => {
          const [x, y] = point(index, Math.max(6, item.score));
          return <circle key={`${item.title}-dot`} cx={x} cy={y} r={5.5} fill={item.color} className="scout-radar-dot" />;
        })}
        {[25, 50, 75].map((value) => {
          const [x, y] = point(0, value);
          return (
            <text key={`scale-${value}`} x={x + 8} y={y + 4} className="scout-radar-scale">
              {value}
            </text>
          );
        })}
        {axes.map((item, index) => {
          const a = angle(index);
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          const x = CX + (RADIUS + 36) * cos;
          const y = CY + (RADIUS + 28) * sin;
          const anchor = Math.abs(cos) < 0.35 ? "middle" : cos > 0 ? "start" : "end";
          const lines = wrapTitle(item.title);
          const lineH = 18;
          const block = lines.length + 1;
          const start = sin < -0.35 ? y - block * lineH + 10 : sin > 0.35 ? y + 8 : y - ((block - 1) * lineH) / 2;
          return (
            <text key={`${item.title}-label`} x={x} y={start} textAnchor={anchor} className="scout-radar-label">
              {lines.map((line, lineIndex) => (
                <tspan key={line} x={x} dy={lineIndex === 0 ? 0 : lineH}>
                  {line}
                </tspan>
              ))}
              <tspan x={x} dy={lineH + 2} className="scout-radar-score" fill={item.color}>
                {Math.round(item.score)}
              </tspan>
            </text>
          );
        })}
      </svg>
    </figure>
  );
}

export function ProfileRadars({ player }: { player: PlayerProfile }) {
  const rows = buildProfileShareRows(player).filter((row) => row.label !== "Híbrido");
  if (rows.length < 3) {
    return <p className="profile-radar-empty">Este atleta ainda não tem arquétipos suficientes para os radares.</p>;
  }

  const affinity: Axis[] = rows.map((row) => ({
    title: row.label,
    score: Math.max(0, Math.min(100, row.share)),
    color: profileAccent(row.label),
  }));
  const classification: Axis[] = rows.map((row) => ({
    title: row.label,
    score: Math.max(0, Math.min(100, row.rating * 10)),
    color: profileAccent(row.label),
  }));

  return (
    <div className="profile-radar-grid">
      <RadarChart title="Afinidade" hint="Quanto o jogo se aproxima de cada arquétipo. Escala de 0 a 100." axes={affinity} />
      <RadarChart
        title="Classificação"
        hint="Nota do arquétipo neste nível, também de 0 a 100. O tracejado é a mediana."
        axes={classification}
      />
    </div>
  );
}
