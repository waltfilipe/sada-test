"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import type { StatSectionTone } from "@/lib/aspectStatSections";
import type { StatMetricBadge } from "@/lib/statBadges";

type StripProps = {
  badges: StatMetricBadge[];
  tone: StatSectionTone;
  size?: "sm" | "md";
};

export function StatBadgeStrip({ badges, tone, size = "sm" }: StripProps) {
  if (!badges.length) {
    return <span className="stat-badge-strip stat-badge-strip-empty">Nenhum badge nesta seção</span>;
  }

  return (
    <div
      className={`stat-badge-strip tone-${tone}${size === "md" ? " stat-badge-strip-md" : ""}`}
      role="list"
      aria-label="Badges conquistados"
    >
      {badges.map((badge) => (
        <Tooltip key={badge.key} content={badge.title}>
          <span className="stat-badge-chip" role="listitem" title={badge.title}>
            <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

type PanelProps = {
  badges: StatMetricBadge[];
  tone: StatSectionTone;
};

export function StatBadgesPanel({ badges, tone }: PanelProps) {
  return (
    <section className={`stat-badges-panel tone-${tone}`} aria-label="Badges da seção">
      <header className="stat-badges-panel-head">
        <span className="stat-badges-panel-label">Badges</span>
        <span className="stat-badges-panel-count tabular">{badges.length}</span>
      </header>
      <StatBadgeStrip badges={badges} tone={tone} />
    </section>
  );
}

type MedalCountProps = {
  count: number;
  tone?: StatSectionTone;
};

export function StatMedalCount({ count, tone = "passes" }: MedalCountProps) {
  if (count <= 0) return null;

  return (
    <span className={`stat-medal-count tone-${tone}`} title={`${count} medalha${count === 1 ? "" : "s"}`}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className="fa-solid fa-medal" aria-hidden="true" />
      ))}
    </span>
  );
}
