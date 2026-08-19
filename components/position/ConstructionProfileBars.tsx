"use client";

import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem } from "@/lib/types";

function formatPct(value: number): string {
  return `${Math.round(value).toString().replace(".", ",")}%`;
}

function ShareBar({ item }: { item: AspectItem }) {
  const share = item.share_pct ?? 0;
  const avg = item.pool_avg_pct ?? 0;
  const scale = Math.max(item.scale_max_pct ?? 40, share, avg, 1);
  const avgPos = clampPercent((avg / scale) * 100);
  const playerPos = clampPercent((share / scale) * 100);
  const token = percentileTier(item.percentile ?? 0);

  return (
    <div className="constr-share-bar" style={tierVars(token)}>
      <div className="constr-share-head">
        <span className="constr-share-label">{item.label}</span>
        <span className="constr-share-value">{item.display_value ?? formatPct(share)}</span>
      </div>

      <div className="constr-share-track" aria-hidden>
        <span className="constr-share-rail" />
        <span
          className="constr-share-center"
          style={{ left: `${avgPos}%` }}
          title={`Média da posição: ${formatPct(avg)}`}
        />
        <span
          className="constr-share-dot"
          style={{ left: `${playerPos}%` }}
          title={`${item.label}: ${formatPct(share)}`}
        />
      </div>

      <div className="constr-share-foot">
        <span>0%</span>
        <span className="constr-share-avg">média {formatPct(avg)}</span>
        <span>{formatPct(scale)}</span>
      </div>
    </div>
  );
}

export function ConstructionProfileBars({ items }: { items: AspectItem[] }) {
  return (
    <article className="aspect-group aspect-group-constr">
      <header>
        <h3>Perfil de construção</h3>
      </header>
      <div className="constr-share-stack">
        {items.map((item) => (
          <ShareBar key={item.label} item={item} />
        ))}
      </div>
    </article>
  );
}
