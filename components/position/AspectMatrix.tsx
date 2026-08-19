"use client";

import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { AccuracyBadge } from "./AccuracyBadge";

const GROUPS = [
  { key: "defensivos", title: "Defensivos" },
  { key: "construcao", title: "Construção" },
  { key: "perfil_construcao", title: "Perfil de construção" },
  { key: "ofensivos", title: "Ofensivos" },
] as const;

function passTooltip(item: AspectItem): string {
  const value = item.certos_per90?.toFixed(1).replace(".", ",") ?? "—";
  return `${value} passes certos / 90`;
}

function MetricAspectRow({ item }: { item: AspectItem }) {
  const pct = item.percentile ?? 0;
  const token = percentileTier(pct);

  return (
    <li className="aspect-row aspect-row-metric">
      <div className="aspect-metric-head">
        <div className="aspect-metric-copy">
          <span className="aspect-name">{item.label}</span>
          {item.sublabel ? <span className="aspect-sublabel">{item.sublabel}</span> : null}
        </div>
        {item.accuracy_badge ? <AccuracyBadge badge={item.accuracy_badge} /> : null}
      </div>
      <div
        className="aspect-metric-track"
        style={tierVars(token)}
        title={item.kind === "pass_certos" ? passTooltip(item) : undefined}
      >
        <div className="aspect-stat-bar aspect-metric-bar">
          <i style={{ width: `${clampPercent(pct)}%` }} />
        </div>
        <span className="aspect-metric-pct">{Math.round(pct)}</span>
      </div>
    </li>
  );
}

function AspectRow({ item }: { item: AspectItem }) {
  if (item.kind === "metric" || item.kind === "pass_certos") {
    return <MetricAspectRow item={item} />;
  }

  const pct =
    item.percentile ??
    (item.stats.length ? item.stats.reduce((sum, stat) => sum + stat.percentile, 0) / item.stats.length : 0);

  return <MetricAspectRow item={{ ...item, kind: "metric", percentile: pct }} />;
}

export function AspectMatrix({ player }: { player: PlayerProfile }) {
  return (
    <div className="aspect-groups aspect-groups-quad">
      {GROUPS.map((group) => (
        <article key={group.key} className="aspect-group">
          <header>
            <h3>{group.title}</h3>
          </header>

          <ul>
            {player.aspects[group.key].map((item) => (
              <AspectRow key={item.label} item={item} />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
