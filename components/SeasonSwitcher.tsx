"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLeagueOptional } from "@/components/LeagueProvider";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON, isBrasileiraoLeague, parseSeasonParam, withSeasonQuery } from "@/lib/seasons";

export function SeasonSwitcher() {
  const league = useLeagueOptional();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!league || !isBrasileiraoLeague(league.leagueId)) return null;

  const active = parseSeasonParam(searchParams.get("temporada") ?? league.season);

  function hrefFor(year: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (year === CURRENT_SEASON) params.delete("temporada");
    else params.set("temporada", year);
    const qs = params.toString();
    const path = pathname || "/";
    if (!qs) return path;
    return `${path}?${qs}`;
  }

  return (
    <nav className="season-switcher" aria-label="Temporada">
      <span className="season-switcher-label">Temporada</span>
      <div className="season-switcher-tabs" role="tablist">
        {BRASILEIRAO_SEASONS.map((year) => (
          <Link
            key={year}
            href={hrefFor(year)}
            role="tab"
            aria-selected={active === year}
            className={active === year ? "is-active" : ""}
            title={year === CURRENT_SEASON ? "Temporada em andamento (scout)" : `Arquivo Wyscout ${year}`}
          >
            {year}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Preserve temporada when building a league path from a leaf component. */
export function leagueHrefWithSeason(leagueHref: (path: string) => string, path: string, season: string): string {
  return withSeasonQuery(leagueHref(path), season);
}
