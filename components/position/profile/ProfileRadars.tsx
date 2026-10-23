"use client";

import { buildProfileShareRows, profileAccent } from "@/lib/profileShares";
import type { PlayerProfile } from "@/lib/types";

type Axis = { title: string; score: number; color: string };

function RadarChart({ title, hint, axes }: { title: string; hint: string; axes: Axis[] }) {
  const width = 420;
  const height = 340;
  const cx = width / 2;
  const cy = height / 2 + 6;
  const radius = 112;
  const count = Math.max(axes.length, 3);
  const padded = axes.length >= 3 ? axes : [...axes, ...Array.from({ length: 3 - axes.length }, () => ({ title: "—", score: 0, color: "#64748b" }))];
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const r = (radius * Math.max(0, Math.min(100, value))) / 100;
    return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))] as const;
  };
  const ring = (value: number) =>
    padded.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  const shape = padded.map((item, index) => point(index, Math.max(4, item.score)).map((n) => n.toFixed(1)).join(",")).join(" ");

  return (
    <figure className="profile-radar-card">
      <figcaption>
        <strong>{title}</strong>
        <span>{hint}</span>
      </figcaption>
      <svg className="player-report-radar profile-radar-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[25, 75, 100].map((value) => (
          <polygon key={value} points={ring(value)} className="radar-ring" />
        ))}
        <polygon points={ring(50)} className="radar-ring is-median" />
        {padded.map((item, index) => {
          const [x, y] = point(index, 100);
          return <line key={`${item.title}-axis`} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
        })}
        <polygon points={shape} className="radar-shape" />
        {padded.map((item, index) => {
          const [x, y] = point(index, Math.max(4, item.score));
          return <circle key={`${item.title}-dot`} cx={x} cy={y} r={4} fill={item.color} className="radar-dot" />;
        })}
        {padded.map((item, index) => {
          const a = angle(index);
          const x = cx + (radius + 18) * Math.cos(a);
          const y = cy + (radius + 18) * Math.sin(a);
          const cos = Math.cos(a);
          const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
          const dy = Math.sin(a) < -0.45 ? -6 : Math.sin(a) > 0.45 ? 12 : 0;
          return (
            <text key={`${item.title}-label`} x={x} y={y + dy} textAnchor={anchor} className="radar-label">
              <tspan>{item.title}</tspan>
              <tspan x={x} dy={13} className="radar-score" fill={item.color}>
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
  if (!rows.length) {
    return <p className="profile-radar-empty">Este atleta ainda não tem arquétipos para os radares.</p>;
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
      <RadarChart title="Afinidade" hint="Quanto o jogo se aproxima de cada arquétipo (0–100)." axes={affinity} />
      <RadarChart title="Classificação" hint="Nota do arquétipo no nível, na escala 0–100. O tracejado é a mediana." axes={classification} />
    </div>
  );
}
