"use client";

import { AccuracyBadge } from "@/components/position/AccuracyBadge";
import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";

const GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "perfil_construcao", title: "Perfil de construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

function aspectScore(item: AspectItem): number {
  if (item.percentile != null) {
    return item.percentile;
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

                const scoreA = aspectScore(item);
                const scoreB = aspectScore(other);
                const leads = scoreA === scoreB ? "tie" : scoreA > scoreB ? "a" : "b";
                const tokenA = percentileTier(scoreA);
                const tokenB = percentileTier(scoreB);

                return (
                  <li key={item.label} className={`aspect-versus-row leads-${leads}`}>
                    <span className="aspect-cell side-a">
                      {item.accuracy_badge && <AccuracyBadge badge={item.accuracy_badge} size={12} showLabel={false} />}
                      <span className="aspect-metric-pct" style={tierVars(tokenA)}>
                        {Math.round(scoreA)}
                      </span>
                    </span>

                    <span className="aspect-versus-label">{item.label}</span>

                    <span className="aspect-cell side-b">
                      <span className="aspect-metric-pct" style={tierVars(tokenB)}>
                        {Math.round(scoreB)}
                      </span>
                      {other.accuracy_badge && <AccuracyBadge badge={other.accuracy_badge} size={12} showLabel={false} />}
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
