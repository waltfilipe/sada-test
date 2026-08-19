"use client";

import { clampPercent } from "@/lib/scoutTheme";
import type { AspectItem } from "@/lib/types";

function formatPct(value: number, decimals = 0): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function ShareBarClassic({ item }: { item: AspectItem }) {
  const share = item.share_pct ?? 0;
  const avg = item.pool_avg_pct ?? 0;
  const scale = Math.max(item.scale_max_pct ?? 40, share, avg, 1);
  const avgPos = clampPercent((avg / scale) * 100);
  const playerPos = clampPercent((share / scale) * 100);

  return (
    <div className="constr-share-bar">
      <div className="constr-share-head">
        <span className="constr-share-label">{item.label}</span>
        <span className="constr-share-value">{item.display_value ?? formatPct(share)}</span>
      </div>

      <div className="constr-share-track" aria-hidden>
        <span className="constr-share-rail" />
        <span className="constr-share-center" style={{ left: `${avgPos}%` }} />
        <span className="constr-share-dot" style={{ left: `${playerPos}%` }} />
      </div>

      <div className="constr-share-foot">
        <span>0%</span>
        <span className="constr-share-avg">média {formatPct(avg)}</span>
        <span>{formatPct(scale)}</span>
      </div>
    </div>
  );
}

function GradientShareBar({ item }: { item: AspectItem }) {
  const share = item.share_pct ?? 0;
  const scale = Math.max(item.scale_max_pct ?? 24, 1);
  const playerPos = clampPercent((share / scale) * 100);
  const isPassTendency = item.bar_key === "pass_tendency";
  const tooltipText = isPassTendency
    ? `${formatPct(share, 1)} de passes longos`
    : `${formatPct(share, 1)} de passes progressivos`;

  return (
    <div className={`constr-gradient-bar ${isPassTendency ? "is-pass-tendency" : "is-progressive"}`}>
      <div className="constr-share-head">
        <span className="constr-share-label">{item.label}</span>
      </div>

      <div className="constr-gradient-tip-wrap">
        <div className="constr-gradient-track" aria-hidden>
          <span className="constr-gradient-fill" />
          <span className="constr-gradient-marker" style={{ left: `${playerPos}%` }} />
        </div>
        <span className="constr-gradient-tip" role="tooltip">
          <strong>{tooltipText}</strong>
          <em>Média da posição: {formatPct(item.pool_avg_pct ?? 0, 1)}</em>
        </span>
      </div>

      <div className="constr-gradient-foot">
        <span>{item.axis_left ?? "0%"}</span>
        <span>{item.axis_right ?? formatPct(scale)}</span>
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
        {items.map((item) =>
          item.bar_key ? (
            <GradientShareBar key={item.label} item={item} />
          ) : (
            <ShareBarClassic key={item.label} item={item} />
          ),
        )}
      </div>
    </article>
  );
}
