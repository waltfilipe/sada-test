"use client";

import { clampPercent, SPECTRUM_BAR_GRADIENT } from "@/lib/scoutTheme";
import type { AspectItem } from "@/lib/types";

function formatPct(value: number, decimals = 0): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function formatRatio(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function MetricOnlyRow({ item }: { item: AspectItem }) {
  return (
    <div className="constr-metric-row">
      <span className="constr-share-label">{item.label}</span>
      <span className="constr-metric-value">{item.display_value ?? "—"}</span>
    </div>
  );
}

function GradientShareBar({ item }: { item: AspectItem }) {
  const share = item.share_pct ?? 0;
  const scale = Math.max(item.scale_max_pct ?? 100, 1);
  const playerPos = clampPercent((share / scale) * 100);
  const isPassTendency = item.bar_key === "pass_tendency";
  const isDefStyle = item.bar_key === "def_contact_style";
  const tooltipText = isPassTendency
    ? `${formatPct(share, 1)} de passes longos`
    : isDefStyle
      ? `Índice ${item.display_value ?? formatRatio(share)}`
      : `${formatPct(share, 1)} de passes progressivos`;
  const tooltipAvg = isDefStyle
    ? `Média da posição: ${formatRatio(item.pool_avg_pct ?? 0)}`
    : `Média da posição: ${formatPct(item.pool_avg_pct ?? 0, 1)}`;

  return (
    <div
      className={[
        "constr-gradient-bar",
        isPassTendency ? "is-pass-tendency" : "",
        isDefStyle ? "is-defensive is-def-style" : "is-progressive",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="constr-share-head">
        <span className="constr-share-label">{item.label}</span>
        {isDefStyle ? <span className="constr-share-value">{item.display_value}</span> : null}
      </div>

      <div className="constr-gradient-tip-wrap">
        <div className="constr-gradient-track" aria-hidden style={{ background: SPECTRUM_BAR_GRADIENT }}>
          <span className="constr-gradient-marker" style={{ left: `${playerPos}%` }} />
        </div>
        <span
          className="constr-gradient-tip"
          role="tooltip"
          style={{ left: `${playerPos}%`, transform: "translateX(-50%)" }}
        >
          <strong>{tooltipText}</strong>
          <em>{tooltipAvg}</em>
        </span>
      </div>

      <div className="constr-gradient-foot">
        <span>{item.axis_left ?? "0%"}</span>
        <span>{item.axis_right ?? formatPct(scale)}</span>
      </div>
    </div>
  );
}

type Props = {
  items: AspectItem[];
  embedded?: boolean;
};

export function ConstructionProfileBars({ items, embedded = false }: Props) {
  const stack = (
    <div className="constr-share-stack">
      {items.map((item) => {
        if (item.kind === "metric") {
          return <MetricOnlyRow key={item.label} item={item} />;
        }
        if (item.bar_key) {
          return <GradientShareBar key={item.label} item={item} />;
        }
        return <ShareBarClassic key={item.label} item={item} />;
      })}
    </div>
  );

  if (embedded) return stack;

  return (
    <article className="dossier-profile-card-panel aspect-group-constr">
      <header>
        <h3>Perfil de construção</h3>
      </header>
      {stack}
    </article>
  );
}
