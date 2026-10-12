"use client";

import { useMemo, useState } from "react";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import { earnedStatBadges, statBadgeForMetric } from "@/lib/statBadges";
import type { AspectItem, AspectSubMetric, PlayerProfile, PositionFamily } from "@/lib/types";
import { PlayerBadgesSection, StatBadgeChip, StatMedalCount, type TonedStatBadge } from "./StatBadgeStrip";

function metricValue(value?: string | null): string {
  return value ?? "—";
}

function rowLabel(label: string): string {
  if (
    label === "Eficiência" ||
    label === "Eficiência Defensiva" ||
    label === "Erros Totais" ||
    label === "Eficiência de finalização"
  ) {
    return label;
  }
  if (label.includes("/90") || label.includes("/ 90")) return label;
  return `${label}/90`;
}

function volumeRowLabel(item: AspectItem): string {
  return rowLabel(item.label);
}

export type StatEdge = "up" | "down" | null;

function StatEdgeMark({ edge }: { edge?: StatEdge }) {
  if (!edge) return null;
  const more = edge === "up";
  return (
    <i
      className={`fa-solid fa-arrow-${edge} stat-edge stat-edge-${edge}`}
      aria-label={more ? "Mais que o outro atleta" : "Menos que o outro atleta"}
    />
  );
}

function StatMetricRow({
  label,
  value,
  percentile,
  edge,
}: {
  label: string;
  value?: string | null;
  percentile?: number | null;
  edge?: StatEdge;
}) {
  return (
    <div className="stat-metric-row">
      <div className="stat-metric-head">
        <span className="stat-metric-label">
          {label}
          <StatEdgeMark edge={edge} />
        </span>
        <span className="stat-metric-value tabular">{metricValue(value)}</span>
      </div>
      <MetricGradientBar score={percentile ?? null} scale="percent" />
    </div>
  );
}

function StatAspectBlock({
  item,
  groupTitle,
  tone,
  volumeEdge,
  efficiencyEdge,
  subEdges,
}: {
  item: AspectItem;
  groupTitle?: string;
  tone: StatSectionTone;
  volumeEdge?: StatEdge;
  efficiencyEdge?: StatEdge;
  subEdges?: Record<string, StatEdge>;
}) {
  const hasSubMetrics =
    (item.kind === "def_efficiency_group" || item.kind === "metric_group") &&
    Boolean(item.sub_metrics?.length);
  const title = groupTitle ?? item.label;
  const badge = statBadgeForMetric(item, title);
  const hasBadge = Boolean(badge);

  return (
    <div className={`stat-aspect-group${hasBadge ? " has-stat-badge" : ""}`}>
      <div className="stat-aspect-group-head">
        <span className="stat-aspect-group-title">
          {title}
          {badge ? <StatBadgeChip badge={badge} tone={tone} /> : null}
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
              edge={subEdges?.[sub.label]}
            />
          ))
        ) : (
          <>
            <StatMetricRow
              label={volumeRowLabel(item)}
              value={item.display_value ?? (item.certos_per90 != null ? item.certos_per90.toFixed(1).replace(".", ",") : undefined)}
              percentile={item.percentile}
              edge={volumeEdge}
            />
            {item.efficiency_pct != null ? (
              <StatMetricRow
                label="Eficiência"
                value={item.efficiency_value}
                percentile={item.efficiency_pct}
                edge={efficiencyEdge}
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

const NO_PEERS: PlayerProfile[] = [];

function edgeAgainst(mine: number | null | undefined, others: Array<number | null | undefined>): StatEdge {
  const peers = others.filter((value): value is number => value != null);
  if (mine == null || !peers.length) return null;
  const highest = Math.max(...peers);
  const lowest = Math.min(...peers);
  if (mine > highest) return "up";
  if (mine < lowest) return "down";
  return null;
}

export function ScoutStatsSections({
  player,
  family,
  active: activeProp,
  onActiveChange,
  peers = NO_PEERS,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  active?: string | null;
  onActiveChange?: (title: string | null) => void;
  peers?: PlayerProfile[];
}) {
  const [localActive, setLocalActive] = useState<string | null>(null);
  const active = onActiveChange ? (activeProp ?? null) : localActive;
  const setActive = (title: string | null) => {
    if (onActiveChange) onActiveChange(title);
    else setLocalActive(title);
  };
  const all = useMemo(() => flattenAspects(player), [player]);
  const peerAspects = useMemo(() => peers.map((peer) => flattenAspects(peer)), [peers]);
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
    [entries],
  );

  function peerValues(itemLabel: string, kind: "volume" | "efficiency", subLabel?: string): Array<number | null> {
    return peerAspects.map((aspects) => {
      const item = findAspect(aspects, itemLabel);
      if (!item) return null;
      if (subLabel) return item.sub_metrics?.find((sub) => sub.label === subLabel)?.percentile ?? null;
      if (kind === "efficiency") return item.efficiency_pct ?? null;
      return item.percentile ?? null;
    });
  }

  return (
    <div className="stats-swap-panel" key={`${player.player_id}-index`}>
      <div className="profile-card-head">
        <h3 className="section-label">Stats and Badges</h3>
        <span className="profile-card-head-hint">Badge quando ambas métricas &gt; P60</span>
      </div>

      <div className="stats-and-badges-body">
        <PlayerBadgesSection badges={allBadges} />

        <section className="stats-subsection" aria-label="Estatísticas por grupo">
          <h4 className="stats-subsection-label">Stats</h4>
          <div className="stats-nav-grid">
            {entries.map((entry) => {
              const open = active === entry.title;
              return (
                <div key={entry.title} className={`stats-nav-cell${open ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className={`stats-nav-row tone-${entry.tone}${open ? " is-open" : ""}`}
                    aria-expanded={open}
                    onClick={() => setActive(open ? null : entry.title)}
                  >
                    <span className="stats-nav-row-title">{entry.title}</span>
                    <span className="stats-nav-row-meta">
                      <StatMedalCount count={entry.badges.length} />
                      <i className={`fa-solid ${open ? "fa-chevron-down" : "fa-chevron-right"}`} aria-hidden="true" />
                    </span>
                  </button>
                  {open ? (
                    <div className="stats-nav-cell-body">
                      {entry.metrics.map(({ item, groupTitle }) => {
                        const subEdges: Record<string, StatEdge> = {};
                        for (const sub of item.sub_metrics ?? []) {
                          subEdges[sub.label] = edgeAgainst(sub.percentile, peerValues(item.label, "volume", sub.label));
                        }
                        return (
                          <StatAspectBlock
                            key={item.label}
                            item={item}
                            groupTitle={groupTitle}
                            tone={entry.tone}
                            volumeEdge={edgeAgainst(item.percentile, peerValues(item.label, "volume"))}
                            efficiencyEdge={edgeAgainst(item.efficiency_pct, peerValues(item.label, "efficiency"))}
                            subEdges={subEdges}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
