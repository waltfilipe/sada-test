"use client";

import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem } from "@/lib/types";

const SHORT_LABELS: Record<string, string> = {
  "Tendência de Passes Longos": "Longos",
  "Tendência de Passes Progressivos": "Progressivos",
  "Tendência de Lateralização": "Lateralização",
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
  const pct = clampPercent(item.percentile ?? 0);
  const token = percentileTier(pct);
  const sweep = 200;
  const start = -100;
  const needleAngle = start + sweep * (pct / 100);
  const cx = 50;
  const cy = 52;
  const r = 34;
  const needleTip = polar(cx, cy, r - 6, needleAngle);
  const label = SHORT_LABELS[item.label] ?? item.label;
  const value = item.display_value ?? "—";

  return (
    <div className="constr-gauge" style={tierVars(token)}>
      <svg viewBox="0 0 100 58" className="constr-gauge-svg" aria-hidden>
        <path d={arcPath(cx, cy, r, start, start + sweep)} className="constr-gauge-track" />
        <path
          d={arcPath(cx, cy, r, start, needleAngle)}
          className="constr-gauge-fill"
          stroke={token.color}
        />
        <circle cx={cx} cy={cy} r="3.2" className="constr-gauge-hub" />
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          className="constr-gauge-needle"
          stroke={token.color}
        />
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
