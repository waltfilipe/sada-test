"use client";

import { useMemo } from "react";
import {
  StatBadgeChip,
  StatMedalCount,
} from "@/components/position/profile/StatBadgeStrip";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import { Tooltip } from "@/components/ui/Tooltip";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import { earnedStatBadges, statBadgeForMetric } from "@/lib/statBadges";
import type { StatMetricBadge } from "@/lib/statBadges";
import type { AspectItem, AspectSubMetric, PlayerProfile, PositionFamily } from "@/lib/types";

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

function metricValue(value?: string | null): string {
  return value ?? "—";
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const DEF_EFFICIENCY_TIP =
  "Índice que combina volume de ações defensivas bem-sucedidas (interceptações, rebatidas) com baixo custo — duelos perdidos e faltas desnecessárias em relação ao total de ações defensivas.";

type MetricVersusProps = {
  label: string;
  valueA?: string | null;
  valueB?: string | null;
  percentileA?: number | null;
  percentileB?: number | null;
};

function CompareMetricVersus({
  label,
  valueA,
  valueB,
  percentileA,
  percentileB,
}: MetricVersusProps) {
  const leads =
    percentileA != null && percentileB != null
      ? percentileA === percentileB
        ? "tie"
        : percentileA > percentileB
          ? "a"
          : "b"
      : "tie";

  const delta =
    percentileA != null && percentileB != null ? Math.round(percentileA - percentileB) : null;

  return (
    <div className={`compare-stat-metric leads-${leads}`}>
      <div className="compare-stat-side side-a">
        <span className="compare-stat-value tabular">{metricValue(valueA)}</span>
        <MetricGradientBar score={percentileA ?? null} scale="percent" />
        {delta != null && delta > 0 ? (
          <span className="compare-stat-delta side-a tabular">+{delta}</span>
        ) : null}
      </div>
      <span className="compare-stat-label">{label}</span>
      <div className="compare-stat-side side-b">
        <span className="compare-stat-value tabular">{metricValue(valueB)}</span>
        <MetricGradientBar score={percentileB ?? null} scale="percent" />
        {delta != null && delta < 0 ? (
          <span className="compare-stat-delta side-b tabular">+{Math.abs(delta)}</span>
        ) : null}
      </div>
    </div>
  );
}

function CompareAspectBlock({
  itemA,
  itemB,
  groupTitle,
  tone,
}: {
  itemA?: AspectItem;
  itemB?: AspectItem;
  groupTitle?: string;
  tone: StatSectionTone;
}) {
  const item = itemA ?? itemB;
  if (!item) return null;

  const title = groupTitle ?? item.label;
  const hasSubMetrics =
    (item.kind === "def_efficiency_group" || item.kind === "metric_group") &&
    Boolean(itemA?.sub_metrics?.length || itemB?.sub_metrics?.length);
  const isDefEfficiency = item.kind === "def_efficiency_group";
  const badgeA = itemA ? statBadgeForMetric(itemA, title) : null;
  const badgeB = itemB ? statBadgeForMetric(itemB, title) : null;
  const hasBadge = Boolean(badgeA || badgeB);

  if (hasSubMetrics) {
    const labels = new Set([
      ...(itemA?.sub_metrics ?? []).map((row) => row.label),
      ...(itemB?.sub_metrics ?? []).map((row) => row.label),
    ]);

    return (
      <div className={`compare-stat-group${hasBadge ? " has-stat-badge" : ""}`}>
        <div className="compare-stat-group-head">
          <span className="compare-stat-group-title">
            {title}
            {badgeA ? <StatBadgeChip badge={badgeA} tone={tone} /> : null}
            {badgeB ? <StatBadgeChip badge={badgeB} tone={tone} /> : null}
            {isDefEfficiency ? (
              <Tooltip content={DEF_EFFICIENCY_TIP}>
                <span className="stat-def-eff-star" aria-label="Destaque — Eficiência Defensiva">
                  <i className="fa-solid fa-star" aria-hidden="true" />
                </span>
              </Tooltip>
            ) : null}
          </span>
        </div>
        <div className="compare-stat-group-body">
          {[...labels].map((label) => {
            const subA = itemA?.sub_metrics?.find((row: AspectSubMetric) => row.label === label);
            const subB = itemB?.sub_metrics?.find((row: AspectSubMetric) => row.label === label);
            return (
              <CompareMetricVersus
                key={label}
                label={rowLabel(label)}
                valueA={subA?.display_value}
                valueB={subB?.display_value}
                percentileA={subA?.percentile}
                percentileB={subB?.percentile}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`compare-stat-group${hasBadge ? " has-stat-badge" : ""}`}>
      <div className="compare-stat-group-head">
        <span className="compare-stat-group-title">
          {title}
          {badgeA ? <StatBadgeChip badge={badgeA} tone={tone} /> : null}
          {badgeB ? <StatBadgeChip badge={badgeB} tone={tone} /> : null}
        </span>
      </div>
      <div className="compare-stat-group-body">
        <CompareMetricVersus
          label={volumeRowLabel(item)}
          valueA={itemA?.display_value ?? (itemA?.certos_per90 != null ? itemA.certos_per90.toFixed(1).replace(".", ",") : undefined)}
          valueB={itemB?.display_value ?? (itemB?.certos_per90 != null ? itemB.certos_per90.toFixed(1).replace(".", ",") : undefined)}
          percentileA={itemA?.percentile}
          percentileB={itemB?.percentile}
        />
        {(itemA?.efficiency_pct != null || itemB?.efficiency_pct != null) && (
          <CompareMetricVersus
            label="Eficiência"
            valueA={itemA?.efficiency_value}
            valueB={itemB?.efficiency_value}
            percentileA={itemA?.efficiency_pct}
            percentileB={itemB?.efficiency_pct}
          />
        )}
      </div>
    </div>
  );
}

type SectionEntry = {
  title: string;
  tone: StatSectionTone;
  badgesA: StatMetricBadge[];
  badgesB: StatMetricBadge[];
  metrics: { label: string; groupTitle?: string }[];
};

type Props = {
  playerA: PlayerProfile;
  playerB: PlayerProfile;
  family: PositionFamily;
};

function sectionBadgesForPlayer(aspects: AspectItem[], labels: string[], titleByItem: Map<string, string>) {
  const items = labels
    .map((label) => findAspect(aspects, label))
    .filter((item): item is AspectItem => Boolean(item));
  return earnedStatBadges(items, titleByItem);
}

export function CompareStatsSections({ playerA, playerB, family }: Props) {
  const aspectsA = useMemo(() => flattenAspects(playerA), [playerA]);
  const aspectsB = useMemo(() => flattenAspects(playerB), [playerB]);
  const sections = statSectionsForFamily(family);

  const entries = useMemo<SectionEntry[]>(() => {
    const list: SectionEntry[] = [];
    for (const section of sections) {
      const metrics: SectionEntry["metrics"] = [];
      const titleByItem = new Map<string, string>();
      const labels: string[] = [];

      for (const label of section.labels) {
        if (!findAspect(aspectsA, label) && !findAspect(aspectsB, label)) continue;
        const groupTitle = label === "Conduções Progressivas" ? "Progressão" : undefined;
        if (groupTitle) titleByItem.set(label, groupTitle);
        labels.push(label);
        metrics.push({ label, groupTitle });
      }
      if (metrics.length) {
        list.push({
          title: section.title,
          tone: section.tone,
          badgesA: sectionBadgesForPlayer(aspectsA, labels, titleByItem),
          badgesB: sectionBadgesForPlayer(aspectsB, labels, titleByItem),
          metrics,
        });
      }
    }
    return list;
  }, [sections, aspectsA, aspectsB]);

  return (
    <section className="player-card compare-stats-panel" aria-label="Estatísticas comparadas">
      <div className="profile-card-head compare-stats-panel-head">
        <h3 className="section-label">Stats</h3>
        <span className="profile-card-head-hint">Volume e eficiência por grupo</span>
      </div>

      <div className="compare-stats-columns-head">
        <span className="compare-stats-columns-a">{shortName(playerA.name)}</span>
        <span aria-hidden="true"> </span>
        <span className="compare-stats-columns-b">{shortName(playerB.name)}</span>
      </div>

      <div className="stats-groups-stack compare-stats-groups">
        {entries.map((entry) => (
          <details key={entry.title} className={`stats-group-accordion tone-${entry.tone}`} open>
            <summary className="stats-group-title">
              <span className="stats-group-title-text">{entry.title}</span>
              <span className="stats-group-title-meta">
                <span className="stats-group-medals-duel">
                  <StatMedalCount count={entry.badgesA.length} />
                  <span className="compare-section-vs">vs</span>
                  <StatMedalCount count={entry.badgesB.length} />
                </span>
                <i className="fa-solid fa-chevron-down stats-group-chevron" aria-hidden="true" />
              </span>
            </summary>
            <div className="compare-stat-cards-stack">
              {entry.metrics.map(({ label, groupTitle }) => (
                <CompareAspectBlock
                  key={label}
                  itemA={findAspect(aspectsA, label)}
                  itemB={findAspect(aspectsB, label)}
                  groupTitle={groupTitle}
                  tone={entry.tone}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
