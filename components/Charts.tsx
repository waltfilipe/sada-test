"use client";

type RadarProps = {
  labels: string[];
  values: number[];
  color?: string;
  size?: number;
};

export function RadarChart({ labels, values, color = "#7dd3fc", size = 220 }: RadarProps) {
  const center = size / 2;
  const radius = size * 0.36;
  const count = labels.length;
  const angleStep = (Math.PI * 2) / count;

  const pointAt = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = (value / 100) * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };

  const polygon = values
    .map((value, index) => {
      const [x, y] = pointAt(index, value);
      return `${x},${y}`;
    })
    .join(" ");

  const rings = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} className="radar-chart">
      {rings.map((ring) => (
        <polygon
          key={ring}
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          points={labels
            .map((_, index) => {
              const [x, y] = pointAt(index, ring);
              return `${x},${y}`;
            })
            .join(" ")}
        />
      ))}
      {labels.map((label, index) => {
        const [x, y] = pointAt(index, 108);
        const [lx, ly] = pointAt(index, 122);
        return (
          <g key={label}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="rgba(148,163,184,0.15)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="radar-label">
              {label}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} fill={`${color}33`} stroke={color} strokeWidth="2" />
    </svg>
  );
}

type ScatterProps = {
  points: { player_id: string; label: string; x: number; y: number }[];
  avgX: number;
  avgY: number;
  highlight?: string;
  color?: string;
  xLabel: string;
  yLabel: string;
};

export function ScatterPlot({
  points,
  avgX,
  avgY,
  highlight,
  color = "#34d399",
  xLabel,
  yLabel,
}: ScatterProps) {
  const width = 520;
  const height = 320;
  const pad = 42;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, avgX) * 0.9;
  const maxX = Math.max(...xs, avgX) * 1.1 || 1;
  const minY = Math.min(...ys, avgY) * 0.9;
  const maxY = Math.max(...ys, avgY) * 1.1 || 1;

  const scaleX = (v: number) => pad + ((v - minX) / (maxX - minX || 1)) * (width - pad * 2);
  const scaleY = (v: number) => height - pad - ((v - minY) / (maxY - minY || 1)) * (height - pad * 2);

  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="scatter-chart">
        <rect x={pad} y={pad} width={width - pad * 2} height={height - pad * 2} fill="rgba(15,23,42,0.55)" rx="12" />
        <line x1={scaleX(avgX)} y1={pad} x2={scaleX(avgX)} y2={height - pad} stroke="rgba(250,204,21,0.45)" />
        <line x1={pad} y1={scaleY(avgY)} x2={width - pad} y2={scaleY(avgY)} stroke="rgba(250,204,21,0.45)" />
        {points.map((point) => {
          const active = point.player_id === highlight;
          return (
            <rect
              key={point.player_id}
              x={scaleX(point.x) - (active ? 5 : 3)}
              y={scaleY(point.y) - (active ? 5 : 3)}
              width={active ? 10 : 6}
              height={active ? 10 : 6}
              transform={`rotate(45 ${scaleX(point.x)} ${scaleY(point.y)})`}
              fill={active ? color : "rgba(148,163,184,0.45)"}
            />
          );
        })}
        <text x={width / 2} y={height - 8} textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
        <text x={12} y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} className="axis-label">
          {yLabel}
        </text>
      </svg>
    </div>
  );
}
