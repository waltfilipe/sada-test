"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAZIL_STATES, BRAZIL_VIEWBOX, REGION_LABEL_POS, STATE_CENTER, type BrazilRegion } from "@/lib/brazilMap";
import { ESTADUAIS_REGIONS } from "@/lib/estaduaisHub";
import type { LeagueId } from "@/lib/leagues";

type Props = {
  season: string;
  available: (id: LeagueId) => boolean;
  players: (id: LeagueId) => number | undefined;
  href: (id: LeagueId) => string;
  fmt: (value: number | undefined) => string;
};

// Rótulos fora dos pinos (Sudeste e Sul ficam sobre o mar / borda oeste).
const LABEL_POS: Record<BrazilRegion, [number, number]> = {
  ...REGION_LABEL_POS,
  Sudeste: [478, 404],
  Sul: [236, 466],
  Norte: [204, 116],
};

const REGION_SLUG: Record<BrazilRegion, string> = {
  Norte: "norte",
  Nordeste: "nordeste",
  "Centro-Oeste": "centro-oeste",
  Sudeste: "sudeste",
  Sul: "sul",
};

export function HubRegionMap({ season, available, players, href, fmt }: Props) {
  const [selected, setSelected] = useState<BrazilRegion>("Sudeste");
  const [hovered, setHovered] = useState<BrazilRegion | null>(null);
  const region = ESTADUAIS_REGIONS.find((r) => r.key === selected)!;
  const regionPlayers = region.members.reduce((sum, m) => sum + (players(m.id) ?? 0), 0);
  const pinUfs = new Map<string, BrazilRegion>();
  for (const r of ESTADUAIS_REGIONS) for (const m of r.members) pinUfs.set(m.uf, r.key);

  return (
    <div className="hb-rmap">
      <div className="hb-rmap-stage">
        <svg viewBox={BRAZIL_VIEWBOX} className="hb-rmap-svg" role="group" aria-label="Mapa do Brasil por região">
          <defs>
            <linearGradient id="hb-rmap-sel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(var(--hx-accent-rgb))" stopOpacity="0.95" />
              <stop offset="100%" stopColor="rgb(var(--hx-accent-rgb))" stopOpacity="0.45" />
            </linearGradient>
            <filter id="hb-rmap-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {(Object.keys(REGION_SLUG) as BrazilRegion[]).map((key) => {
            const isSel = key === selected;
            return (
              <g
                key={key}
                className={`hb-rmap-region${isSel ? " is-sel" : ""}${hovered === key ? " is-hover" : ""}`}
                filter={isSel ? "url(#hb-rmap-glow)" : undefined}
                onClick={() => setSelected(key)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{key}</title>
                {BRAZIL_STATES.filter((s) => s.region === key).map((s) => (
                  <path key={s.uf} d={s.d} />
                ))}
              </g>
            );
          })}
          {[...pinUfs].map(([uf, key]) => {
            const [x, y] = STATE_CENTER[uf];
            return (
              <g key={uf} className={`hb-rmap-pin${key === selected ? " is-sel" : ""}`} transform={`translate(${x} ${y})`}>
                <circle r="9" className="hb-rmap-pin-pulse" />
                <circle r="4.2" />
              </g>
            );
          })}
          {(Object.keys(LABEL_POS) as BrazilRegion[]).map((key) => {
            const [x, y] = LABEL_POS[key];
            return (
              <text key={key} x={x} y={y} className={`hb-rmap-label${key === selected ? " is-sel" : ""}`}>
                {key}
              </text>
            );
          })}
        </svg>
        <div className="hb-rmap-pills" role="tablist" aria-label="Regiões">
          {ESTADUAIS_REGIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === selected}
              className={`hb-rmap-pill${r.key === selected ? " is-sel" : ""}`}
              onClick={() => setSelected(r.key)}
            >
              {r.key}
              <em>{r.members.length}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="hb-rmap-panel" key={selected}>
        <header className="hb-rmap-panel-head">
          <span>Região</span>
          <h3>{selected}</h3>
          <em>
            {region.members.length} {region.members.length === 1 ? "campeonato" : "campeonatos"} ·{" "}
            {fmt(regionPlayers)} atletas
          </em>
        </header>
        <div className="hb-rmap-grid">
          {region.members.map((member, index) => {
            const ok = available(member.id);
            const count = players(member.id);
            return (
              <Link
                key={member.id}
                href={href(member.id)}
                className={`hb-member${ok ? "" : " hb-member-empty"}`}
                style={{ animationDelay: `${index * 50}ms` }}
                title={ok ? member.name : `${member.name} · sem dados em ${season}`}
              >
                <span className="hb-member-lv">N{member.level}</span>
                <span className="hb-member-logo">
                  <img src={member.logo} alt="" />
                </span>
                <strong>{member.name}</strong>
                <small>{ok && count ? `${fmt(count)} atletas` : "sem dados"}</small>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
