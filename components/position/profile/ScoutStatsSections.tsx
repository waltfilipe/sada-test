"use client";

import { useMemo } from "react";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import { Tooltip } from "@/components/ui/Tooltip";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import { earnedStatBadges, statBadgeForMetric } from "@/lib/statBadges";
import type { AspectItem, AspectSubMetric, PlayerProfile, PositionFamily } from "@/lib/types";
import { PlayerBadgesSection, StatBadgeChip, StatMedalCount, type TonedStatBadge } from "./StatBadgeStrip";

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
    Progressão: ["Progressão", "Conduções Progressivas"],
  };
  const candidates = aliases[label] ?? [label];
  return items.find((item) => candidates.some((c) => item.label === c || item.label.startsWith(c)));
}

function metricValue(value?: string | null): string {
  return value ?? "—";
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

function StatMetricRow({
  label,
  value,
  percentile,
}: {
  label: string;
  value?: string | null;
  percentile?: number | null;
}) {
  return (
    <div className="stat-metric-row">
      <div className="stat-metric-head">
        <span className="stat-metric-label">{label}</span>
        <span className="stat-metric-value tabular">{metricValue(value)}</span>
      </div>
      <MetricGradientBar score={percentile ?? null} scale="percent" />
    </div>
  );
}

const DEF_EFFICIENCY_TIP =
  "Índice que combina volume de ações defensivas bem-sucedidas (interceptações, rebatidas) com baixo custo — duelos perdidos e faltas desnecessárias em relação ao total de ações defensivas.";

function StatAspectBlock({
  item,
  groupTitle,
  tone,
}: {
  item: AspectItem;
  groupTitle?: string;
  tone: StatSectionTone;
}) {
  const hasSubMetrics =
    (item.kind === "def_efficiency_group" || item.kind === "metric_group") &&
    Boolean(item.sub_metrics?.length);
  const title = groupTitle ?? item.label;
  const isDefEfficiency = item.kind === "def_efficiency_group";
  const badge = statBadgeForMetric(item, title);
  const hasBadge = Boolean(badge);

  return (
    <div className={`stat-aspect-group${hasBadge ? " has-stat-badge" : ""}`}>
      <div className="stat-aspect-group-head">
        <span className="stat-aspect-group-title">
          {title}
          {badge ? <StatBadgeChip badge={badge} tone={tone} /> : null}
          {isDefEfficiency ? (
            <Tooltip content={DEF_EFFICIENCY_TIP}>
              <span className="stat-def-eff-star" aria-label="Destaque — Eficiência Defensiva">
                <i className="fa-solid fa-star" aria-hidden="true" />
              </span>
            </Tooltip>
          ) : null}
        </span>
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

type SectionEntry = {
  title: string;
  tone: StatSectionTone;
  badges: ReturnType<typeof earnedStatBadges>;
  metrics: { item: AspectItem; groupTitle?: string }[];
};

export function ScoutStatsSections({
  player,
  family,
}: {
  player: PlayerProfile;
  family: PositionFamily;
}) {
  const all = useMemo(() => flattenAspects(player), [player]);
  const sections = statSectionsForFamily(family);

  const entries = useMemo<SectionEntry[]>(() => {
    const list: SectionEntry[] = [];
    for (const section of sections) {
      const metrics: SectionEntry["metrics"] = [];
      const titleByItem = new Map<string, string>();

      for (const label of section.labels) {
        const item = findAspect(all, label);
        if (!item) continue;
        const groupTitle = label === "Conduções Progressivas" ? "Progressão" : undefined;
        if (groupTitle) titleByItem.set(item.label, groupTitle);
        metrics.push({ item, groupTitle });
      }

      if (!metrics.length) continue;

      const items = metrics.map((metric) => metric.item);
      list.push({
        title: section.title,
        tone: section.tone,
        badges: earnedStatBadges(items, titleByItem),
        metrics,
      });
    }
    return list;
  }, [sections, all]);

  const allBadges = useMemo<TonedStatBadge[]>(
    () => entries.flatMap((entry) => entry.badges.map((badge) => ({ ...badge, tone: entry.tone }))),
    [entries]
  );

  return (
    <div className="stats-swap-panel" key={player.player_id}>
      <div className="profile-card-head">
        <h3 className="section-label">Stats and Badges</h3>
        <span className="profile-card-head-hint">Badge com vol. e efic. &gt; P60</span>
      </div>

      <div className="stats-and-badges-body">
        <PlayerBadgesSection badges={allBadges} />

        <section className="stats-subsection" aria-label="Estatísticas por grupo">
          <h4 className="stats-subsection-label">Stats</h4>
          <div className="stats-groups-stack">
            {entries.map((entry) => (
              <details key={entry.title} className="stats-group-accordion">
                <summary className="stats-group-title">
                  <span className="stats-group-title-text">{entry.title}</span>
                  <span className="stats-group-title-meta">
                    <StatMedalCount count={entry.badges.length} />
                    <i className="fa-solid fa-chevron-down stats-group-chevron" aria-hidden="true" />
                  </span>
                </summary>
                <div className="stat-cards-stack">
                  {entry.metrics.map(({ item, groupTitle }) => (
                    <StatAspectBlock
                      key={item.label}
                      item={item}
                      groupTitle={groupTitle}
                      tone={entry.tone}
                    />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
