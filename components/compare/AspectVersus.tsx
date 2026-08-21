"use client";

import { resolveAspectBadge } from "@/lib/aspectBadges";
import { aspectGroupsForPlayers } from "@/lib/aspectGroups";
import { gradeTier, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { AccuracyBadge } from "@/components/position/AccuracyBadge";

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
  return resolveAspectBadge(item);
}

function matchByLabel(itemsA: AspectItem[] | undefined, itemsB: AspectItem[] | undefined) {
  const mapB = new Map((itemsB ?? []).map((item) => [item.label, item]));
  const labels = new Set([...(itemsA ?? []).map((item) => item.label), ...(itemsB ?? []).map((item) => item.label)]);

  return [...labels].map((label) => ({
    label,
    itemA: (itemsA ?? []).find((item) => item.label === label),
    itemB: mapB.get(label),
  }));
}

function GradeChip({ grade }: { grade: string }) {
  return (
    <span className="grade-chip" style={tierVars(gradeTier(grade))}>
      {grade}
    </span>
  );
}

function AspectCell({ item }: { item?: AspectItem }) {
  if (!item) {
    return <span className="aspect-cell-empty">—</span>;
  }

  const score = aspectScore(item);
  const token = percentileTier(score);
  const badge = rowBadge(item);

  return (
    <>
      {badge ? <AccuracyBadge badge={badge} size={11} showLabel={false} /> : null}
      {item.grade ? <GradeChip grade={item.grade} /> : null}
      <span className="aspect-metric-value" style={tierVars(token)}>
        {displayValue(item)}
      </span>
    </>
  );
}

export function AspectVersus({ a, b }: { a: PlayerProfile; b: PlayerProfile }) {
  const groups = aspectGroupsForPlayers(a, b);

  return (
    <div className="aspect-versus">
      {groups.map((group) => {
        const rowsA = a.aspects[group.key];
        const rowsB = b.aspects[group.key];
        const rows = matchByLabel(rowsA, rowsB);

        return (
          <article key={group.key} className="aspect-versus-group">
            <h3>{group.title}</h3>

            <ul>
              {rows.map(({ label, itemA, itemB }) => {
                const scoreA = itemA ? aspectScore(itemA) : -1;
                const scoreB = itemB ? aspectScore(itemB) : -1;
                const leads =
                  scoreA === scoreB ? "tie" : scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : "tie";

                return (
                  <li key={label} className={`aspect-versus-row leads-${leads}`}>
                    <span className="aspect-cell side-a">
                      <AspectCell item={itemA} />
                    </span>

                    <span className="aspect-versus-label">{label}</span>

                    <span className="aspect-cell side-b">
                      <AspectCell item={itemB} />
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
