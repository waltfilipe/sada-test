"use client";

import { profileMetaForFamily } from "@/lib/profileMeta";
import type { PlayerProfile } from "@/lib/types";

export function ProfileDna({ player }: { player: PlayerProfile }) {
  const segments = profileMetaForFamily(player.position_family).map((item) => ({
    ...item,
    value: player.profile_shares[item.key] ?? 0,
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
              <div className={`profile-bar-fill tone-${segment.tone}`} style={{ width: `${segment.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
