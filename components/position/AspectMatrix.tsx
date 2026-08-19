"use client";

import { useState } from "react";

import { clampPercent, gradeTier, normalizeGrade, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { AccuracyBadge } from "./AccuracyBadge";

const GROUPS = [
  { key: "defensivos", title: "Defensivos", hint: "Duelos e intervenções" },
  { key: "construcao", title: "Construção", hint: "Passes certos por 90" },
  { key: "ofensivos", title: "Ofensivos", hint: "Condução e duelos ofensivos" },
] as const;

function PassAspectRow({ item }: { item: AspectItem }) {
  const pct = item.percentile ?? 0;
  const token = percentileTier(pct);
  const gradeToken = gradeTier(item.grade);

  return (
    <li className="aspect-row aspect-row-pass">
      <div className="aspect-pass-head">
        <span className="aspect-name">{item.label}</span>
        <span className="aspect-row-end">
          {item.accuracy_badge && <AccuracyBadge badge={item.accuracy_badge} />}
          <span className="aspect-grade" style={tierVars(gradeToken)}>
            {normalizeGrade(item.grade)}
          </span>
        </span>
      </div>
      <div className="aspect-pass-body" style={tierVars(token)}>
        <div className="aspect-pass-meta">
          <span className="aspect-pass-value">{item.certos_per90?.toFixed(1)} certos/90</span>
          <span className="aspect-pass-pct">{Math.round(pct)}</span>
        </div>
        <div className="aspect-stat-bar aspect-pass-bar">
          <i style={{ width: `${clampPercent(pct)}%` }} />
        </div>
      </div>
    </li>
  );
}

function AspectRow({ item }: { item: AspectItem }) {
  if (item.kind === "pass_certos") {
    return <PassAspectRow item={item} />;
  }

  const [open, setOpen] = useState(false);
  const token = gradeTier(item.grade);
  const expandable = item.stats.length > 0;

  return (
    <li className={`aspect-row${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="aspect-row-trigger"
        style={tierVars(token)}
        onClick={() => expandable && setOpen((value) => !value)}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="aspect-name">{item.label}</span>
        <span className="aspect-row-end">
          {expandable && (
            <svg
              className="aspect-chevron"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              aria-hidden
            >
              <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
          <span className="aspect-grade">{normalizeGrade(item.grade)}</span>
        </span>
      </button>

      {open && expandable && (
        <div className="aspect-stats">
          {item.stats.map((stat) => {
            const statToken = percentileTier(stat.percentile);
            return (
              <div key={stat.label} className="aspect-stat" style={tierVars(statToken)}>
                <div className="aspect-stat-head">
                  <span className="aspect-stat-label">{stat.label}</span>
                  <span className="aspect-stat-pct">{Math.round(stat.percentile)}</span>
                </div>
                <div className="aspect-stat-bar">
                  <i style={{ width: `${clampPercent(stat.percentile)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

export function AspectMatrix({ player }: { player: PlayerProfile }) {
  return (
    <div className="aspect-groups">
      {GROUPS.map((group) => (
        <article key={group.key} className="aspect-group">
          <header>
            <h3>{group.title}</h3>
            <p>{group.hint}</p>
          </header>

          <ul>
            {player.aspects[group.key].map((item) => (
              <AspectRow key={item.label} item={item} />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
