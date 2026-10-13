"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  if (label.includes(" / ") || label.includes("/90") || label.includes("/ 90")) return label;
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

function sectionEntries(player: PlayerProfile, family: PositionFamily): SectionEntry[] {
  const all = flattenAspects(player);
  const sections = statSectionsForFamily(family);
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
    list.push({
      title: section.title,
      tone: section.tone,
      badges: earnedStatBadges(metrics.map((metric) => metric.item), titleByItem),
      metrics,
    });
  }
  return list;
}

export function StatWindow({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="stat-window-backdrop" onClick={onClose}>
      <div
        className="stat-window"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <h3>{title}</h3>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>
        <div className="stat-window-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function StatSectionPanel({
  player,
  family,
  title,
  peers = NO_PEERS,
  heading,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  title: string;
  peers?: PlayerProfile[];
  heading?: string;
}) {
  const entry = useMemo(
    () => sectionEntries(player, family).find((item) => item.title === title) ?? null,
    [player, family, title],
  );
  const peerAspects = useMemo(() => peers.map((peer) => flattenAspects(peer)), [peers]);

  if (!entry) return null;

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
    <section className="stat-window-column" aria-label={heading ?? player.name}>
      {heading ? <h4>{heading}</h4> : null}
      <div className="stat-cards-stack">
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
    </section>
  );
}

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
  const entries = useMemo(() => sectionEntries(player, family), [player, family]);
  const allBadges = useMemo<TonedStatBadge[]>(
    () => entries.flatMap((entry) => entry.badges.map((badge) => ({ ...badge, tone: entry.tone }))),
    [entries],
  );
  const activeEntry = active ? entries.find((entry) => entry.title === active) ?? null : null;

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
                <button
                  key={entry.title}
                  type="button"
                  className={`stats-nav-row tone-${entry.tone}${open ? " is-open" : ""}`}
                  aria-expanded={open}
                  onClick={() => setActive(open ? null : entry.title)}
                >
                  <span className="stats-nav-row-title">{entry.title}</span>
                  <span className="stats-nav-row-meta">
                    <StatMedalCount count={entry.badges.length} />
                    <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {!onActiveChange && activeEntry ? (
        <StatWindow title={activeEntry.title} onClose={() => setActive(null)}>
          <StatSectionPanel player={player} family={family} title={activeEntry.title} peers={peers} />
        </StatWindow>
      ) : null}
    </div>
  );
}
