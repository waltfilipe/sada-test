"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLogo } from "@/components/SiteLogo";
import { useLeagueOptional } from "@/components/LeagueProvider";
import { getLeague } from "@/lib/leagues";
import { isBrasileiraoLeague } from "@/lib/seasons";

const NAV = [
  { key: "inicio", path: "/", label: "Início", global: true },
  { key: "posicoes", path: "/posicao/zagueiros", label: "Posições", global: false },
  { key: "filtros", path: "/filtros", label: "Filtros", global: false },
  { key: "comparar", path: "/comparar", label: "Comparar", global: false },
  { key: "scatter", path: "/scatter", label: "Scatter", global: false },
  { key: "elenco", path: "/time-sombra", label: "Elenco + Time Sombra", global: false },
] as const;

export type ScoutSection = (typeof NAV)[number]["key"];

type Props = {
  active: ScoutSection;
  subnav?: ReactNode;
  /** Hub global (/) — links de scout exigem liga no contexto. */
  hubMode?: boolean;
};

export function ScoutTopbar({ active, subnav, hubMode = false }: Props) {
  const league = useLeagueOptional();

  function navHref(item: (typeof NAV)[number]) {
    if (item.global) return item.path;
    if (hubMode || !league) return "/";
    return league.href(item.path);
  }

  function navActive(item: (typeof NAV)[number]) {
    return item.key === active;
  }

  const leagueInfo = league ? getLeague(league.leagueId) : undefined;
  const showContext = !hubMode && league != null;
  const contextLogo =
    league != null && isBrasileiraoLeague(league.leagueId) ? leagueInfo?.logo : undefined;

  return (
    <div className="scout-topbar-wrap">
      <header className="scout-topbar scout-topbar-compact">
        <Link href="/" className="scout-brand" aria-label="SADA | Scout — Início">
          <SiteLogo variant="stacked" className="scout-header-logo scout-header-logo-stacked" height={40} />
        </Link>

        <nav className="topbar-links topbar-links-primary" aria-label="Seções">
          {NAV.map((item) => {
            const disabled = !item.global && (hubMode || !league);
            return (
              <Link
                key={item.key}
                href={disabled ? "#" : navHref(item)}
                onClick={disabled ? (event) => event.preventDefault() : undefined}
                className={[navActive(item) ? "active" : "", disabled ? "topbar-link-muted" : ""].filter(Boolean).join(" ")}
                aria-current={navActive(item) ? "page" : undefined}
                aria-disabled={disabled ? true : undefined}
                title={disabled ? "Escolha uma competição no início" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {showContext ? (
          <div
            className={["topbar-context", league!.isCurrentSeason ? "" : "topbar-context-archive"].filter(Boolean).join(" ")}
            title={
              league!.isCurrentSeason
                ? `${league!.name} — temporada ${league!.season}`
                : `Arquivo Wyscout ${league!.season}`
            }
          >
            {contextLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={contextLogo} alt="" className="topbar-context-logo" />
            ) : (
              <span className="topbar-context-brand" aria-hidden="true">
                {league!.brand}
              </span>
            )}
            <span className="topbar-context-text">
              <span className="topbar-context-name">{league!.name}</span>
              <span className="topbar-context-season">
                {league!.isCurrentSeason ? `Temporada ${league!.season}` : `Arquivo ${league!.season}`}
              </span>
            </span>
          </div>
        ) : null}
      </header>

      {subnav ? <div className="scout-subnav">{subnav}</div> : null}
    </div>
  );
}
