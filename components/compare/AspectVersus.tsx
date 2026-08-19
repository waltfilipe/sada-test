"use client";

import { AccuracyBadge } from "@/components/position/AccuracyBadge";
import { gradeTier, normalizeGrade, tierVars } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";

const GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

function aspectScore(item: AspectItem): number {
  if (item.kind === "pass_certos") {
    return item.percentile ?? 0;
  }
  if (!item.stats.length) {
    return 0;
  }
  return item.stats.reduce((sum, stat) => sum + stat.percentile, 0) / item.stats.length;
}

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
                const scoreA = aspectScore(item);
                const scoreB = aspectScore(other);
                const leads = scoreA === scoreB ? "tie" : scoreA > scoreB ? "a" : "b";

                return (
                  <li key={item.label} className={`aspect-versus-row leads-${leads}`}>
                    <span className="aspect-cell side-a">
                      {item.accuracy_badge && <AccuracyBadge badge={item.accuracy_badge} />}
                      <span className="aspect-grade" style={tierVars(tokenA)}>
                        {normalizeGrade(item.grade)}
                      </span>
                    </span>

                    <span className="aspect-versus-label">{item.label}</span>

                    <span className="aspect-cell side-b">
                      <span className="aspect-grade" style={tierVars(tokenB)}>
                        {normalizeGrade(other.grade)}
                      </span>
                      {other.accuracy_badge && <AccuracyBadge badge={other.accuracy_badge} />}
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
