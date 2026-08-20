"use client";

import { ZAG_ARCHETYPE_META, archetypeTone, type ZagCluster } from "@/lib/clusterMeta";
import { clampPercent } from "@/lib/scoutTheme";

type Props = {
  cluster: ZagCluster;
};

const SHARE_KEYS = {
  "Defensor de Área": "defensor_area",
  Construtor: "construtor",
  Combativo: "combativo",
} as const;

const CX = 100;
const CY = 100;
const MAX_R = 72;

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function ringPoints(level: number): string {
  return ZAG_ARCHETYPE_META.map((_, index) => {
    const angle = index * 120;
    const [x, y] = polar(angle, MAX_R * level);
    return `${x},${y}`;
  }).join(" ");
}

export function ArchetypeRadarChart({ cluster }: Props) {
  const values = ZAG_ARCHETYPE_META.map((item) => {
    const key = SHARE_KEYS[item.archetype];
    return clampPercent(cluster.shares[key]);
  });

  const polygon = values
    .map((value, index) => {
      const [x, y] = polar(index * 120, (MAX_R * value) / 100);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="archetype-radar" aria-label="Radar de perfis táticos">
      <svg viewBox="0 0 200 200" className="archetype-radar-svg" role="img">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            key={level}
            points={ringPoints(level)}
            className="archetype-radar-grid"
            fill="none"
          />
        ))}

        {ZAG_ARCHETYPE_META.map((item, index) => {
          const [x, y] = polar(index * 120, MAX_R);
          const [lx, ly] = polar(index * 120, MAX_R + 16);
          return (
            <g key={item.archetype}>
              <line x1={CX} y1={CY} x2={x} y2={y} className="archetype-radar-spoke" />
              <text
                x={lx}
                y={ly}
                className={`archetype-radar-label cluster-${archetypeTone(item.archetype)}`}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {item.archetype === "Defensor de Área" ? "Def. Área" : item.archetype}
              </text>
            </g>
          );
        })}

        <polygon points={polygon} className="archetype-radar-fill" />
        {values.map((value, index) => {
          const [x, y] = polar(index * 120, (MAX_R * value) / 100);
          const tone = archetypeTone(ZAG_ARCHETYPE_META[index].archetype);
          return <circle key={index} cx={x} cy={y} r={3.2} className={`archetype-radar-dot cluster-${tone}`} />;
        })}
      </svg>

      <ul className="archetype-radar-legend">
        {ZAG_ARCHETYPE_META.map((item) => {
          const key = SHARE_KEYS[item.archetype];
          const share = cluster.shares[key];
          const active = item.archetype === cluster.archetype;
          return (
            <li key={item.archetype} className={active ? "active" : ""}>
              <span className={`cluster-${archetypeTone(item.archetype)}`}>{item.archetype}</span>
              <strong>{Math.round(share)}%</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
