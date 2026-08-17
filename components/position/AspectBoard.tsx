"use client";

import { gradeTone } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

const GROUPS = [
  { key: "defensivos", title: "Defensivos", subtitle: "Confrontos e intervenções" },
  { key: "construcao", title: "Construção", subtitle: "Passes e progressão" },
  { key: "ofensivos", title: "Ofensivos", subtitle: "Segurança ofensiva" },
] as const;

type Props = {
  player: PlayerProfile;
  compact?: boolean;
};

export function AspectBoard({ player, compact = false }: Props) {
  return (
    <section className={`aspect-board ${compact ? "aspect-board-compact" : ""}`}>
      {GROUPS.map((group) => {
        const items = player.aspects[group.key];
        return (
          <article key={group.key} className={`scout-card aspect-group ${compact ? "aspect-group-compact" : ""}`}>
            <header>
              <p className="scout-kicker">{group.subtitle}</p>
              <h2>{group.title}</h2>
            </header>
            <div className="aspect-cards">
              {items.map((item) => (
                <div key={item.label} className={`aspect-card ${compact ? "aspect-card-compact" : ""}`}>
                  <div className="aspect-card-top">
                    <span>{item.label}</span>
                    {item.medal && <i className={`medal-pill ${item.medal}`} />}
                  </div>
                  <strong className={`grade-gradient tone-${gradeTone(item.grade)}`}>{item.grade}</strong>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
