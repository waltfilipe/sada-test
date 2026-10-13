"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import type { FamilyBadgeOption } from "@/lib/statBadges";

type Props = {
  options: FamilyBadgeOption[];
  selected: string[];
  onToggle: (key: string) => void;
};

export function BadgeFilterBox({ options, selected, onToggle }: Props) {
  return (
    <details className="badge-filter-box">
      <summary>
        <span>Badges</span>
        <em>{selected.length ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}` : "Filtrar"}</em>
      </summary>
      <div className="badge-filter-icons" role="group" aria-label="Badges">
        {options.map((badge) => {
          const active = selected.includes(badge.key);
          return (
            <Tooltip key={badge.key} content={`${badge.label}. ${badge.title}`}>
              <button
                type="button"
                className={`badge-filter-icon tone-${badge.tone}${active ? " active" : ""}`}
                aria-pressed={active}
                aria-label={badge.label}
                onClick={() => onToggle(badge.key)}
              >
                <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </details>
  );
}
