"use client";

import { MedalBadge } from "@/components/position/MedalBadge";
import { gradeScore, gradeTier, normalizeGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

const GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

export function AspectVersus({ a, b }: { a: PlayerProfile; b: PlayerProfile }) {
  return (
    <div className="aspect-versus">
      {GROUPS.map((group) => {
        const rowsA = a.aspects[group.key];
        const rowsB = b.aspects[group.key];

        return (
          <article key={group.key} className="aspect-versus-group">
            <h3>{group.title}</h3>

            <ul>
              {rowsA.map((item, index) => {
                const other = rowsB[index];
                if (!other) return null;

                const tokenA = gradeTier(item.grade);
                const tokenB = gradeTier(other.grade);
                const scoreA = gradeScore(item.grade);
                const scoreB = gradeScore(other.grade);
                const leads = scoreA === scoreB ? "tie" : scoreA > scoreB ? "a" : "b";

                return (
                  <li key={item.label} className={`aspect-versus-row leads-${leads}`}>
                    <span className="aspect-cell side-a">
                      {item.medal && <MedalBadge medal={item.medal} size={16} />}
                      <span className="grade-chip" style={tierVars(tokenA)}>
                        {normalizeGrade(item.grade)}
                      </span>
                    </span>

                    <span className="aspect-versus-label">{item.label}</span>

                    <span className="aspect-cell side-b">
                      <span className="grade-chip" style={tierVars(tokenB)}>
                        {normalizeGrade(other.grade)}
                      </span>
                      {other.medal && <MedalBadge medal={other.medal} size={16} />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
