"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BRASILEIRAO_LEAGUES } from "@/lib/leagues";
import { ESTADUAIS_LEVELS } from "@/lib/estaduaisHub";
import {
  BRASILEIRAO_SEASONS,
  CURRENT_SEASON,
  HUB_SEASON_STORAGE_KEY,
  parseSeasonParam,
  withSeasonQuery,
  type BrasileiraoSeason,
} from "@/lib/seasons";
import { SiteLogo } from "@/components/SiteLogo";
import { ScoutTopbar } from "@/components/ScoutTopbar";

export function HubSeasonPicker() {
  const searchParams = useSearchParams();
  const fromUrl = parseSeasonParam(searchParams.get("temporada"));
  const [season, setSeason] = useState<BrasileiraoSeason>(fromUrl);

  useEffect(() => {
    setSeason(fromUrl);
    try {
      localStorage.setItem(HUB_SEASON_STORAGE_KEY, fromUrl);
    } catch {
      /* ignore */
    }
  }, [fromUrl]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HUB_SEASON_STORAGE_KEY);
      if (stored && (BRASILEIRAO_SEASONS as readonly string[]).includes(stored) && !searchParams.get("temporada")) {
        setSeason(stored as BrasileiraoSeason);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  function pick(next: BrasileiraoSeason) {
    setSeason(next);
    try {
      localStorage.setItem(HUB_SEASON_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (next === CURRENT_SEASON) url.searchParams.delete("temporada");
    else url.searchParams.set("temporada", next);
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  function serieHref(leagueId: string) {
    return withSeasonQuery(`/${leagueId}/posicao/zagueiros`, season);
  }

  const isArchiveHub = season !== CURRENT_SEASON;

  return (
    <div className={`scout-root home-page hub-page${isArchiveHub ? " hub-page-archive" : ""}`}>
      <ScoutTopbar active="inicio" hubMode />
      <main className="home-main hub-main">
        <section className="home-hero hub-hero">
          <SiteLogo variant="stacked" className="hub-logo" />
          <p className="home-kicker">Temporada {season}{isArchiveHub ? " · arquivo Wyscout" : " · scout ao vivo"}</p>
          <h1>Escolha onde olhar.</h1>
          <p className="home-lead">
            Séries nacionais e estaduais por nível. Dentro de um nível, zagueiros, laterais e o restante são comparados
            só com quem joga naquele grupo.
          </p>
          <nav className="hub-season-picker" aria-label="Temporada do hub">
            <span className="hub-season-picker-label">Temporada</span>
            <div className="hub-season-picker-tabs">
              {BRASILEIRAO_SEASONS.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={season === year ? "is-active" : ""}
                  aria-pressed={season === year}
                  onClick={() => pick(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </nav>
        </section>

        <section className="home-section" aria-labelledby="hub-serie-title">
          <h2 id="hub-serie-title">Brasileirão</h2>
          {isArchiveHub ? (
            <p className="hub-archive-hint">Você está entrando no arquivo {season}. Mapas de calor e projeção M7 valem para {CURRENT_SEASON}.</p>
          ) : null}
          <div className="hub-serie-grid">
            {BRASILEIRAO_LEAGUES.map((league) => (
              <Link key={league.id} href={serieHref(league.id)} className="hub-serie-card">
                <img src={league.logo} alt="" className="hub-serie-logo" />
                <span>
                  <strong>{league.name}</strong>
                  <em>{season}</em>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="hub-est-title">
          <h2 id="hub-est-title">Estaduais</h2>
          <div className="hub-level-grid">
            {ESTADUAIS_LEVELS.map((level) => (
              <Link key={level.id} href={`/${level.id}/posicao/zagueiros`} className="hub-level-card">
                <span className="hub-level-kicker">Um pool só</span>
                <strong>{level.name}</strong>
                <p>{level.hint}</p>
                <span className="hub-level-marks">
                  {level.members.map((member) => (
                    <img key={member.id} src={member.logo} alt={member.name} title={member.name} className="hub-mini-logo" />
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
