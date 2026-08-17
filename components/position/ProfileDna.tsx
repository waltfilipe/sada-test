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

      <div className="profile-bars">
        {segments.map((segment) => (
          <div key={segment.key} className="profile-bar-row">
            <div className="profile-bar-head">
              <span>{segment.label}</span>
              <strong>{Math.round(segment.value)}%</strong>
            </div>
            <div className="profile-bar-track">
              <div className="profile-bar-fill" style={{ width: `${segment.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
