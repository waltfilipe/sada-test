"use client";

import { gradeTone } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

const GROUPS = [
  { key: "defensivos", title: "Aspectos defensivos", subtitle: "Confrontos, aéreo e intervenções" },
  { key: "construcao", title: "Construção", subtitle: "Passes verticais, PCF e longos" },
  { key: "ofensivos", title: "Aspectos ofensivos", subtitle: "Segurança e progressão" },
] as const;

export function AspectBoard({ player }: { player: PlayerProfile }) {
  return (
    <section className="aspect-board">
      {GROUPS.map((group) => {
        const items = player.aspects[group.key];
        return (
          <article key={group.key} className="scout-card aspect-group">
            <header>
              <p className="scout-kicker">{group.subtitle}</p>
              <h2>{group.title}</h2>
            </header>
            <div className="aspect-cards">
              {items.map((item) => (
                <div key={item.label} className={`aspect-card tone-${gradeTone(item.grade)}`}>
                  <div className="aspect-card-top">
                    <span>{item.label}</span>
                    {item.medal && <i className={`medal-pill ${item.medal}`} />}
                  </div>
                  <strong>{item.grade}</strong>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
