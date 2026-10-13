"use client";

/**
 * Pitch slots in the same space as the heatmap:
 * x is depth (0 own goal, 100 opponent goal, attack to the right),
 * y is width (0 team's right, 100 team's left).
 */
const SLOT: Record<string, { x: number; y: number }> = {
  GK: { x: 8, y: 50 },
  RCB: { x: 24, y: 32 },
  CB: { x: 22, y: 50 },
  LCB: { x: 24, y: 68 },
  RB: { x: 42, y: 12 },
  RWB: { x: 54, y: 8 },
  LB: { x: 42, y: 88 },
  LWB: { x: 54, y: 92 },
  RDMF: { x: 40, y: 36 },
  DMF: { x: 36, y: 50 },
  LDMF: { x: 40, y: 64 },
  RCMF: { x: 54, y: 34 },
  CMF: { x: 52, y: 50 },
  LCMF: { x: 54, y: 66 },
  RAMF: { x: 68, y: 28 },
  AMF: { x: 64, y: 50 },
  LAMF: { x: 68, y: 72 },
  RW: { x: 76, y: 14 },
  RWF: { x: 82, y: 24 },
  LW: { x: 76, y: 86 },
  LWF: { x: 82, y: 76 },
  CF: { x: 86, y: 50 },
  SS: { x: 78, y: 50 },
};

type Marker = { code: string; x: number; y: number; primary: boolean };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function placeRoles(codes: string[]): Marker[] {
  const placed: Marker[] = [];
  codes.forEach((code, index) => {
    const slot = SLOT[code] ?? { x: 50, y: 50 };
    let x = slot.x;
    let y = slot.y;
    const primary = index === 0;
    if (!primary) {
      for (let step = 0; step < 10; step += 1) {
        const clash = placed.some((marker) => Math.hypot(marker.x - x, marker.y - y) < 9);
        if (!clash) break;
        const angle = step * 0.85 + 0.4;
        const radius = 8 + step * 1.4;
        x = clamp(slot.x + Math.cos(angle) * radius, 8, 94);
        y = clamp(slot.y + Math.sin(angle) * radius * 0.72, 8, 92);
      }
    }
    placed.push({ code, x, y, primary });
  });
  return placed;
}

type Props = {
  positions: string[];
  playerName: string;
};

export function WyscoutRolePitch({ positions, playerName }: Props) {
  const markers = placeRoles(positions);
  const ordered = [...markers.filter((marker) => !marker.primary), ...markers.filter((marker) => marker.primary)];

  return (
    <div className="heatmap-body heatmap-body-live role-pitch-body">
      <div className="heatmap-pitch-wrap">
        <svg className="role-pitch" viewBox="0 0 105 74" role="img" aria-label={`Posições Wyscout de ${playerName}`}>
          <defs>
            <linearGradient id="role-grass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1c7a45" />
              <stop offset="0.45" stopColor="#176b3c" />
              <stop offset="1" stopColor="#145c34" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="105" height="68" rx="2.2" fill="url(#role-grass)" />
          {Array.from({ length: 5 }, (_, index) => (
            <rect key={index} x={index * 21} y="0" width="10.5" height="68" fill="rgba(255,255,255,0.035)" />
          ))}
          <g fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="0.45">
            <rect x="0.4" y="0.4" width="104.2" height="67.2" />
            <line x1="52.5" y1="0" x2="52.5" y2="68" />
            <circle cx="52.5" cy="34" r="9.15" />
            <rect x="0" y="13.8" width="16.5" height="40.4" />
            <rect x="88.5" y="13.8" width="16.5" height="40.4" />
            <rect x="0" y="24.8" width="5.5" height="18.4" />
            <rect x="99.5" y="24.8" width="5.5" height="18.4" />
            <circle cx="11" cy="34" r="0.7" fill="rgba(255,255,255,0.9)" stroke="none" />
            <circle cx="94" cy="34" r="0.7" fill="rgba(255,255,255,0.9)" stroke="none" />
          </g>
          {ordered.map((marker) => {
            const px = (marker.x / 100) * 105;
            const py = ((100 - marker.y) / 100) * 68;
            const width = Math.max(marker.primary ? 12 : 9, marker.code.length * (marker.primary ? 2.55 : 2));
            const height = marker.primary ? 5.4 : 4;
            return (
              <g key={`${marker.code}-${marker.primary ? "main" : "alt"}`} opacity={marker.primary ? 1 : 0.48}>
                <rect
                  x={px - width / 2}
                  y={py - height / 2}
                  width={width}
                  height={height}
                  rx="1.3"
                  fill={marker.primary ? "#7df1de" : "rgba(15,23,42,0.72)"}
                  stroke={marker.primary ? "rgba(6,32,28,0.35)" : "rgba(255,255,255,0.45)"}
                  strokeWidth="0.35"
                />
                <text
                  x={px}
                  y={py + 0.2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={marker.primary ? "#06201d" : "#f8fafc"}
                  fontSize={marker.primary ? 3.15 : 2.45}
                  fontWeight={700}
                  fontFamily="Sora, DM Sans, sans-serif"
                >
                  {marker.code}
                </text>
              </g>
            );
          })}
          <text x="103" y="72.2" textAnchor="end" fill="rgba(226,232,240,0.72)" fontSize="2.6" fontWeight={600} fontFamily="DM Sans, sans-serif">
            Ataque →
          </text>
        </svg>
      </div>
      <p className="heatmap-meta">
        <strong>{positions[0]}</strong>
        {positions.length > 1 ? ` · ${positions.slice(1).join(" · ")}` : ""}
        {" · "}
        primeira é a mais usada
      </p>
    </div>
  );
}
