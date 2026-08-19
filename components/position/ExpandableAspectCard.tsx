"use client";

import { useId, useState } from "react";

import { resolveAspectBadge } from "@/lib/aspectBadges";
import { clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem } from "@/lib/types";
import { AccuracyBadge } from "./AccuracyBadge";

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="aspect-chevron">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MetricBar({
  label,
  pct,
  value,
  muted = false,
}: {
  label: string;
  pct: number;
  value?: string;
  muted?: boolean;
}) {
  const token = percentileTier(pct);

  return (
    <div className={`aspect-bar-row ${muted ? "aspect-bar-row-muted" : ""}`} style={tierVars(token)}>
      <div className="aspect-bar-head">
        <span className="aspect-bar-label">{label}</span>
        <span className="aspect-bar-value">{value ?? "—"}</span>
      </div>
      <div className="aspect-stat-bar aspect-metric-bar">
        <i style={{ width: `${clampPercent(pct)}%` }} />
      </div>
    </div>
  );
}

function HeaderBadge({ item }: { item: AspectItem }) {
  const badge = resolveAspectBadge(item);
  if (!badge) return null;
  return <AccuracyBadge badge={badge} size={13} showLabel={false} />;
}

function volumeLabel(item: AspectItem): string {
  if (item.kind === "pass_certos") {
    return item.label;
  }
  return item.label;
}

function ExpandableBody({ item }: { item: AspectItem }) {
  if (item.kind === "def_efficiency_group" && item.sub_metrics?.length) {
    return (
      <div className="aspect-expand-body">
        {item.sub_metrics.map((sub) => (
          <MetricBar
            key={sub.label}
            label={sub.label}
            pct={sub.percentile}
            value={sub.display_value}
            muted={sub.label !== "Eficiência Defensiva" && sub.label !== "Ações bem-sucedidas"}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="aspect-expand-body">
      <MetricBar label={volumeLabel(item)} pct={item.percentile ?? 0} value={displayValue(item)} />
      {item.efficiency_pct != null ? (
        <MetricBar
          label="Eficiência"
          pct={item.efficiency_pct}
          value={item.efficiency_value ?? undefined}
        />
      ) : null}
    </div>
  );
}

function displayValue(item: AspectItem): string {
  if (item.display_value) return item.display_value;
  if (item.certos_per90 != null) return item.certos_per90.toFixed(1).replace(".", ",");
  return "—";
}

export function ExpandableAspectCard({ item, defaultOpen = false }: { item: AspectItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <li className={`aspect-row aspect-row-expand ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="aspect-row-trigger aspect-row-expand-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="aspect-name">{item.label}</span>
        <span className="aspect-row-end">
          <HeaderBadge item={item} />
          <Chevron />
        </span>
      </button>

      {open ? (
        <div id={panelId} className="aspect-expand-panel">
          <ExpandableBody item={item} />
        </div>
      ) : null}
    </li>
  );
}

export function ExpandableAspectCardList({
  items,
  defaultOpenIndex = -1,
}: {
  items: AspectItem[];
  defaultOpenIndex?: number;
}) {
  return (
    <>
      {items.map((item, index) => (
        <ExpandableAspectCard key={item.label} item={item} defaultOpen={index === defaultOpenIndex} />
      ))}
    </>
  );
}
