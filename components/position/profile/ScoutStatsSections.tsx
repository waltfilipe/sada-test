"use client";

import { useMemo } from "react";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { AspectItem, AspectSubMetric, PlayerProfile, PositionFamily } from "@/lib/types";

function flattenAspects(player: PlayerProfile): AspectItem[] {
  const groups = player.aspects;
  return [
    ...(groups.defensivos ?? []),
    ...(groups.construcao ?? []),
    ...(groups.ofensivos ?? []),
    ...(groups.terco_final ?? []),
  ];
}

function findAspect(items: AspectItem[], label: string): AspectItem | undefined {
  const aliases: Record<string, string[]> = {
    "Passes Finais": ["Passes Finas", "Passes Finais"],
  };
  const candidates = aliases[label] ?? [label];
  return items.find((item) => candidates.some((c) => item.label === c || item.label.startsWith(c)));
}

function metricValue(value?: string | null): string {
  return value ?? "—";
}

function sectionLetter(items: AspectItem[]): string | undefined {
  if (!items.length) return undefined;
  return items[0]?.grade;
}

const ROW_LABEL_ALIASES: Record<string, string> = {
  "Ações bem-sucedidas": "Ações Defensivas/90",
};

function rowLabel(label: string): string {
  if (ROW_LABEL_ALIASES[label]) return ROW_LABEL_ALIASES[label];
  if (label === "Eficiência" || label === "Eficiência Defensiva") return label;
  if (label.includes("/90") || label.includes("/ 90")) return label;
  return `${label}/90`;
}

function volumeRowLabel(item: AspectItem): string {
  return rowLabel(item.label);
}

type MetricRowProps = {
  label: string;
  value?: string | null;
  percentile?: number | null;
  grade?: string;
};

function StatMetricRow({ label, value, percentile, grade }: MetricRowProps) {
  return (
    <div className="stat-metric-row">
      <div className="stat-metric-head">
        <span className="stat-metric-label">{label}</span>
        <span className="stat-metric-value tabular">{metricValue(value)}</span>
      </div>
      <MetricGradientBar score={percentile ?? null} letter={grade} scale="percent" />
    </div>
  );
}

function StatAspectBlock({ item }: { item: AspectItem }) {
  const hasSubMetrics =
    (item.kind === "def_efficiency_group" || item.kind === "metric_group") &&
    Boolean(item.sub_metrics?.length);

  return (
    <div className="stat-aspect-group">
      <div className="stat-aspect-group-head">
        <span className="stat-aspect-group-title">{item.label}</span>
      </div>
      <div className="stat-aspect-group-body">
        {hasSubMetrics ? (
          item.sub_metrics!.map((sub: AspectSubMetric) => (
            <StatMetricRow
              key={sub.label}
              label={rowLabel(sub.label)}
              value={sub.display_value}
              percentile={sub.percentile}
            />
          ))
        ) : (
          <>
            <StatMetricRow
              label={volumeRowLabel(item)}
              value={item.display_value ?? (item.certos_per90 != null ? item.certos_per90.toFixed(1).replace(".", ",") : undefined)}
              percentile={item.percentile}
              grade={item.grade}
            />
            {item.efficiency_pct != null ? (
              <StatMetricRow
                label="Eficiência"
                value={item.efficiency_value}
                percentile={item.efficiency_pct}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function ScoutStatsSections({
  player,
  family,
}: {
  player: PlayerProfile;
  family: PositionFamily;
}) {
  const all = useMemo(() => flattenAspects(player), [player]);
  const sections = statSectionsForFamily(family);

  return (
    <div className="pass-scores-panel">
      <div className="report-pass-accordion">
        {sections.map((section) => {
          const metrics = section.labels
            .map((label) => findAspect(all, label))
            .filter((item): item is AspectItem => Boolean(item));

          if (!metrics.length) return null;

          return (
            <details key={section.title} className="report-pass-accordion-item">
              <summary className="report-pass-accordion-trigger">
                <span className="report-pass-accordion-left">
                  <span className="report-pass-accordion-chevron" aria-hidden="true">
                    ›
                  </span>
                  <span className="report-pass-accordion-title">{section.title}</span>
                </span>
                <span className="report-pass-accordion-right">
                  <GradeBadge letter={sectionLetter(metrics)} size="sm" />
                </span>
              </summary>
              <div className="report-pass-accordion-panel">
                <div className="pass-score-metrics">
                  {metrics.map((item) => (
                    <StatAspectBlock key={item.label} item={item} />
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
