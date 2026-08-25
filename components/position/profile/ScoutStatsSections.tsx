"use client";

import { useMemo } from "react";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

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

function metricValue(item: AspectItem): string {
  if (item.display_value) return item.display_value;
  if (item.certos_per90 != null) return item.certos_per90.toFixed(1).replace(".", ",");
  return "—";
}

function sectionLetter(items: AspectItem[]): string | undefined {
  if (!items.length) return undefined;
  return items[0]?.grade;
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
            <details key={section.title} className="report-pass-accordion-item" open>
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
                    <div key={item.label} className="pass-metric-block">
                      <div className="pass-metric-head">
                        <span className="pass-metric-label">{item.label}</span>
                        <span className="pass-metric-value tabular">{metricValue(item)}</span>
                        <GradeBadge letter={item.grade} size="sm" />
                      </div>
                      <MetricGradientBar
                        score={item.percentile ?? null}
                        letter={item.grade}
                        scale="percent"
                      />
                    </div>
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
