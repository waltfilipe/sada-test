"use client";

import { useId } from "react";

import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem } from "@/lib/types";

const SHORT_LABELS: Record<string, string> = {
  "Tendência de Passes Longos": "Longos",
  "Tendência de Passes Progressivos": "Prog.",
  "Tendência de Lateralização": "Lateral.",
};

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number) {
  const start = polar(cx, cy, radius, fromDeg);
  const end = polar(cx, cy, radius, toDeg);
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function MiniGauge({ item }: { item: AspectItem }) {
  const uid = useId().replace(/:/g, "");
  const pct = clampPercent(item.percentile ?? 0);
  const token = percentileTier(pct);
  const sweep = 160;
  const start = -170;
  const needleAngle = start + sweep * (pct / 100);
  const cx = 42;
  const cy = 40;
  const r = 28;
  const needleInner = polar(cx, cy, 5, needleAngle);
  const needleOuter = polar(cx, cy, r - 2, needleAngle);
  const label = SHORT_LABELS[item.label] ?? item.label;
  const value = item.display_value ?? "—";
  const grad = `gauge-${uid}`;

  const ticks = [0, 25, 50, 75, 100].map((tick) => {
    const angle = start + sweep * (tick / 100);
    const inner = polar(cx, cy, r - 5, angle);
    const outer = polar(cx, cy, r, angle);
    return { tick, inner, outer };
  });

  return (
    <div className="constr-gauge" style={tierVars(token)} title={item.label}>
      <svg viewBox="0 0 84 46" className="constr-gauge-svg" aria-hidden>
        <defs>
          <linearGradient id={grad} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={token.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={token.color} stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <path d={arcPath(cx, cy, r, start, start + sweep)} className="constr-gauge-track" />
        <path
          d={arcPath(cx, cy, r, start, needleAngle)}
          stroke={`url(#${grad})`}
          className="constr-gauge-fill"
        />

        {ticks.map(({ tick, inner, outer }) => (
          <line
            key={tick}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className="constr-gauge-tick"
            opacity={tick % 50 === 0 ? 0.55 : 0.28}
          />
        ))}

        <circle cx={cx} cy={cy} r="3.5" className="constr-gauge-hub" />
        <line
          x1={needleInner.x}
          y1={needleInner.y}
          x2={needleOuter.x}
          y2={needleOuter.y}
          className="constr-gauge-needle"
          stroke={token.color}
        />
        <circle cx={needleOuter.x} cy={needleOuter.y} r="1.6" fill={token.color} opacity="0.85" />
      </svg>
      <p className="constr-gauge-value">{value}</p>
      <p className="constr-gauge-label">{label}</p>
    </div>
  );
}

export function ConstructionProfileGauges({ items }: { items: AspectItem[] }) {
  return (
    <article className="aspect-group aspect-group-gauges">
      <header>
        <h3>Perfil de construção</h3>
      </header>
      <div className="constr-gauge-grid">
        {items.map((item) => (
          <MiniGauge key={item.label} item={item} />
        ))}
      </div>
    </article>
  );
}
