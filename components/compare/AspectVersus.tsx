"use client";

import { dualMetricBadge } from "@/lib/aspectBadges";
import { percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { AccuracyBadge } from "@/components/position/AccuracyBadge";

const GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "ofensivos", title: "Ofensivos" },
  { key: "perfil_construcao", title: "Perfil de construção" },
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

function displayValue(item: AspectItem): string {
  if (item.display_value) return item.display_value;
  if (item.certos_per90 != null) return item.certos_per90.toFixed(1).replace(".", ",");
  return "—";
}

function rowBadge(item: AspectItem) {
  if (item.kind === "def_efficiency_group" && item.pair_badge) {
    return dualMetricBadge(item.pair_badge[0], item.pair_badge[1]);
  }
  if (item.efficiency_pct != null && item.percentile != null) {
    return dualMetricBadge(item.percentile, item.efficiency_pct);
  }
  return null;
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
                const badgeA = rowBadge(item);
                const badgeB = rowBadge(other);

                return (
                  <li key={item.label} className={`aspect-versus-row leads-${leads}`}>
                    <span className="aspect-cell side-a">
                      {badgeA ? <AccuracyBadge badge={badgeA} size={11} showLabel={false} /> : null}
                      <span className="aspect-metric-value" style={tierVars(tokenA)}>
                        {displayValue(item)}
                      </span>
                    </span>

                    <span className="aspect-versus-label">{item.label}</span>

                    <span className="aspect-cell side-b">
                      <span className="aspect-metric-value" style={tierVars(tokenB)}>
                        {displayValue(other)}
                      </span>
                      {badgeB ? <AccuracyBadge badge={badgeB} size={11} showLabel={false} /> : null}
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
