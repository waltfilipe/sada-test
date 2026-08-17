"use client";

import { PROFILE_META } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

export function ProfileDna({ player }: { player: PlayerProfile }) {
  const segments = PROFILE_META.map((item) => ({
    ...item,
    value: player.profile_shares[item.key as keyof PlayerProfile["profile_shares"]],
  }));

  return (
    <section className="scout-card profile-dna">
      <header>
        <p className="scout-kicker">Composição tática</p>
        <h2>DNA de perfil</h2>
        <p className="scout-sub">
          Perfil dominante: <strong>{player.profile}</strong>
        </p>
      </header>

      <div className="profile-stack" aria-hidden>
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="profile-stack-segment"
            style={{ width: `${segment.value}%`, background: segment.color }}
            title={`${segment.label} ${segment.value}%`}
          />
        ))}
      </div>

      <div className="profile-legend">
        {segments.map((segment) => (
          <div key={segment.key} className="profile-legend-item">
            <span style={{ background: segment.color }} />
            <div>
              <strong>{segment.label}</strong>
              <em>{Math.round(segment.value)}%</em>
            </div>
          </div>
        ))}
      </div>

      <div className="profile-triangle">
        <svg viewBox="0 0 220 190" role="img" aria-label="Distribuição de perfil">
          <polygon
            points={trianglePoints(
              segments[0].value,
              segments[1].value,
              segments[2].value,
            )}
            fill="rgba(52, 211, 153, 0.16)"
            stroke="rgba(52, 211, 153, 0.8)"
            strokeWidth="2"
          />
          <text x="110" y="18" textAnchor="middle">Combativo</text>
          <text x="24" y="176" textAnchor="middle">Construtor</text>
          <text x="196" y="176" textAnchor="middle">Posicional</text>
        </svg>
      </div>
    </section>
  );
}

function trianglePoints(combativo: number, construtor: number, posicional: number) {
  const center = 110;
  const top = 28 + (100 - combativo) * 0.45;
  const leftX = 34 + (100 - construtor) * 0.2;
  const rightX = 186 - (100 - posicional) * 0.2;
  const baseY = 162;
  return `${center},${top} ${leftX},${baseY} ${rightX},${baseY}`;
}
