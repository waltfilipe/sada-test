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
    <details className="sc-panel aspect-matrix">
      <summary className="aspect-summary">
        <div className="aspect-summary-copy">
          <p className="sc-eyebrow">Avaliação técnica</p>
          <h2>Aspectos de jogo</h2>
        </div>

        <div className="aspect-summary-aside">
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
          <span className="aspect-chevron" aria-hidden>
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path
                d="M2.5 4.5 6 8l3.5-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </summary>

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
    </details>
  );
}
