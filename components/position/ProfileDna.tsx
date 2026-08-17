"use client";

import { profileMetaForFamily } from "@/lib/profileMeta";
import type { PlayerProfile } from "@/lib/types";

export function ProfileDna({ player }: { player: PlayerProfile }) {
  const segments = profileMetaForFamily(player.position_family).map((item) => ({
    ...item,
    value: Math.max(0, player.profile_shares[item.key] ?? 0),
  }));

  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const normalized = segments.map((segment) => ({
    ...segment,
    share: (segment.value / total) * 100,
  }));

  const spread = Math.max(...normalized.map((s) => s.share)) - Math.min(...normalized.map((s) => s.share));
  const balance = spread < 12 ? "Perfil equilibrado" : spread < 28 ? "Leve inclinação" : "Perfil especialista";

  return (
    <section className="sc-panel profile-dna">
      <header className="sc-panel-head">
        <div>
          <p className="sc-eyebrow">Composição tática</p>
          <h2>DNA de perfil</h2>
        </div>
      </header>

      <div className="dna-stack" role="img" aria-label="Distribuição do perfil tático">
        {normalized.map((segment) => (
          <span
            key={segment.key}
            className={`dna-seg tone-${segment.tone}`}
            style={{ width: `${segment.share}%` }}
            title={`${segment.label}: ${Math.round(segment.share)}%`}
          />
        ))}
      </div>

      <ul className="dna-legend">
        {normalized.map((segment) => (
          <li key={segment.key}>
            <span className={`dna-dot tone-${segment.tone}`} aria-hidden />
            <span className="dna-label">{segment.label}</span>
            <strong>{Math.round(segment.share)}%</strong>
          </li>
        ))}
      </ul>

      <p className="dna-summary">
        <strong>{player.profile}</strong>
        <em>{balance}</em>
      </p>
    </section>
  );
}
