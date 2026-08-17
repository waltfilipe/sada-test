"use client";

import { clampPercent, gradeScore, gradeTier, normalizeGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";
import { MedalBadge } from "./MedalBadge";

const GROUPS = [
  { key: "defensivos", title: "Defensivos", hint: "Confrontos e intervenções" },
  { key: "construcao", title: "Construção", hint: "Passes e progressão" },
  { key: "ofensivos", title: "Ofensivos", hint: "Condução e segurança" },
] as const;

export function AspectMatrix({ player }: { player: PlayerProfile }) {
  return (
    <section className="sc-panel aspect-matrix">
      <header className="sc-panel-head">
        <div>
          <p className="sc-eyebrow">Avaliação técnica</p>
          <h2>Aspectos de jogo</h2>
        </div>
        <div className="grade-legend">
          {["A", "B", "C", "D"].map((grade) => {
            const token = gradeTier(grade);
            return (
              <span key={grade} style={tierVars(token)}>
                <i aria-hidden />
                {grade}
              </span>
            );
          })}
        </div>
      </header>

      <div className="aspect-groups">
        {GROUPS.map((group) => (
          <article key={group.key} className="aspect-group">
            <header>
              <h3>{group.title}</h3>
              <p>{group.hint}</p>
            </header>

            <ul>
              {player.aspects[group.key].map((item) => {
                const token = gradeTier(item.grade);
                const score = gradeScore(item.grade);

                return (
                  <li key={item.label} className="aspect-row" style={tierVars(token)}>
                    <div className="aspect-row-top">
                      <span className="aspect-name">{item.label}</span>
                      <div className="aspect-marks">
                        {item.medal && <MedalBadge medal={item.medal} size={19} />}
                        <span className="grade-chip">{normalizeGrade(item.grade)}</span>
                      </div>
                    </div>
                    <div className="meter meter-sm">
                      <i style={{ width: `${clampPercent(score)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
