"use client";

import { useState } from "react";

import { clampPercent, gradeTier, normalizeGrade, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

const GROUPS = [
  { key: "defensivos", title: "Defensivos", hint: "Duelos e intervenções" },
  { key: "construcao", title: "Construção", hint: "Passes e progressão" },
  { key: "ofensivos", title: "Ofensivos", hint: "Condução e duelos ofensivos" },
] as const;

function AspectRow({ item }: { item: PlayerProfile["aspects"]["defensivos"][number] }) {
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
    <section className="sc-panel aspect-matrix">
      <header className="aspect-panel-head">
        <div>
          <p className="sc-eyebrow">Avaliação técnica</p>
          <h2>Aspectos de jogo</h2>
        </div>

        <div className="grade-legend">
          {["A", "B", "C", "D"].map((grade) => {
            const token = gradeTier(grade);
            return (
              <span key={grade} style={tierVars(token)}>
                <i aria-hidden />
                {grade}
              </span>
            );
          })}
        </div>
      </header>

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
    </section>
  );
}
