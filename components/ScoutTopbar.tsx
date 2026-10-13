"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LEAGUES } from "@/lib/leagues";
import { useLeague } from "@/components/LeagueProvider";

const NAV = [
  { key: "inicio", path: "/", label: "Início" },
  { key: "posicoes", path: "/posicao/zagueiros", label: "Posições" },
  { key: "filtros", path: "/filtros", label: "Filtros" },
  { key: "comparar", path: "/comparar", label: "Comparar" },
  { key: "scatter", path: "/scatter", label: "Scatter" },
  { key: "time-sombra", path: "/time-sombra", label: "Time Sombra" },
] as const;

export type ScoutSection = (typeof NAV)[number]["key"];

type Props = {
  active: ScoutSection;
  subnav?: ReactNode;
};

export function ScoutTopbar({ active, subnav }: Props) {
  const { leagueId, href, name, season, brand } = useLeague();

  return (
    <div className="scout-topbar-wrap">
      <header className="scout-topbar">
        <Link href={href("/")} className="scout-brand">
          <span className="sc-brand-mark">{brand}</span>
          <span className="sc-brand-copy">
            <strong>{name} Scout</strong>
            <em>Temporada {season}</em>
          </span>
        </Link>

        <div className="league-switcher" role="navigation" aria-label="Ligas">
          {LEAGUES.map((league) => (
            <Link
              key={league.id}
              href={`/${league.id}`}
              className={league.id === leagueId ? "active" : ""}
              aria-current={league.id === leagueId ? "true" : undefined}
            >
              {league.name}
            </Link>
          ))}
        </div>

        <nav className="topbar-links" aria-label="Seções">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={href(item.path)}
              className={item.key === active ? "active" : ""}
              aria-current={item.key === active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {subnav ? <div className="scout-subnav">{subnav}</div> : null}
    </div>
  );
}
