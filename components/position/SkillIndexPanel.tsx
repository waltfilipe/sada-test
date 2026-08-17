"use client";

import { TENDENCY_META, percentileLabel } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

export function SkillIndexPanel({ player }: { player: PlayerProfile }) {
  return (
    <section className="scout-card skill-index">
      <header>
        <p className="scout-kicker">Índices normalizados</p>
        <h2>Skill index</h2>
        <p className="scout-sub">Percentis dentro do pool de zagueiros</p>
      </header>

      <div className="skill-list">
        {TENDENCY_META.map((item) => {
          const value = player.tendencies[item.key as keyof PlayerProfile["tendencies"]];
          return (
            <article key={item.key} className="skill-row">
              <div className="skill-row-head">
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </div>
                <div className="skill-value">
                  <em>{percentileLabel(value)}</em>
                  <strong>{Math.round(value)}</strong>
                </div>
              </div>
              <div className="skill-track">
                <div className="skill-fill" style={{ width: `${value}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
