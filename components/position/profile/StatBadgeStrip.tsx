"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import type { StatMetricBadge } from "@/lib/statBadges";

type Props = {
  badges: StatMetricBadge[];
  size?: "sm" | "md";
};

export function StatBadgeStrip({ badges, size = "sm" }: Props) {
  if (!badges.length) {
    return <span className="stat-badge-strip stat-badge-strip-empty">—</span>;
  }

  return (
    <div className={`stat-badge-strip${size === "md" ? " stat-badge-strip-md" : ""}`} role="list" aria-label="Badges conquistados">
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

type MedalCountProps = {
  count: number;
};

export function StatPassMedalCount({ count }: MedalCountProps) {
  if (count <= 0) return null;

  return (
    <span className="stat-pass-medal-count" title={`${count} badge${count === 1 ? "" : "s"} de passe`}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className="fa-solid fa-medal" aria-hidden="true" />
      ))}
      <span className="sr-only">{count} medalhas de passe</span>
    </span>
  );
}
