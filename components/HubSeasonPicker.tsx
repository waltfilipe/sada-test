"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BRASILEIRAO_LEAGUES, type LeagueId } from "@/lib/leagues";
import { ESTADUAIS_LEVELS } from "@/lib/estaduaisHub";
import { POSITION_FAMILIES } from "@/lib/positions";
import {
  BRASILEIRAO_SEASONS,
  CURRENT_SEASON,
  HUB_SEASON_STORAGE_KEY,
  parseSeasonParam,
  withSeasonQuery,
  type BrasileiraoSeason,
} from "@/lib/seasons";
import type { PositionFamily } from "@/lib/types";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { SiteLogo } from "@/components/SiteLogo";

export type HubLeagueStats = {
  players: number;
  families: Partial<Record<PositionFamily, number>>;
};

export type HubAthlete = {
  id: string;
  name: string;
  club: string;
  position: string;
  family: PositionFamily;
  rating: number;
  photo: string;
};

export type HubData = {
  seasons: Record<
    string,
    {
      leagues: Partial<Record<LeagueId, HubLeagueStats>>;
      players: number;
      featured: Partial<Record<LeagueId, HubAthlete[]>>;
    }
  >;
};

const TIER_LABEL: Partial<Record<LeagueId, string>> = {
  "serie-a": "1ª divisão",
  "serie-b": "2ª divisão",
  "serie-c": "3ª divisão",
  "serie-d": "4ª divisão",
};

type Feature = {
  path: string;
  icon: string;
  title: string;
  category: string;
  fact: string;
  isNew?: boolean;
};

/** "Produtos" da vitrine: cada ferramenta do site. */
const FEATURES: Feature[] = [
  { path: "/posicao/zagueiros", icon: "fa-ranking-star", title: "Ranking por posição", category: "Posições", fact: "5 posições · nota 0–10" },
  { path: "/posicao/zagueiros", icon: "fa-people-arrows", title: "Similares entre ligas", category: "Ficha do atleta", fact: "Mahalanobis · A/B/C", isNew: true },
  { path: "/posicao/zagueiros", icon: "fa-forward", title: "Projeção de desempenho", category: "Ficha do atleta", fact: "Bayes + ridge validado", isNew: true },
  { path: "/posicao/zagueiros", icon: "fa-file-pdf", title: "Relatório em PDF", category: "Ficha do atleta", fact: "1 página · PT/EN", isNew: true },
  { path: "/comparar", icon: "fa-scale-balanced", title: "Comparar atletas", category: "Análise", fact: "Radar lado a lado" },
  { path: "/filtros", icon: "fa-sliders", title: "Filtros avançados", category: "Busca", fact: "Idade · minutos · perfil" },
  { path: "/scatter", icon: "fa-chart-line", title: "Scatter", category: "Análise", fact: "Quem foge da curva" },
  { path: "/elenco", icon: "fa-people-group", title: "Elenco do clube", category: "Clubes", fact: "Campinho editável" },
  { path: "/elencos-previos", icon: "fa-clock-rotate-left", title: "Elencos prévios", category: "Clubes", fact: "2022–2025" },
  { path: "/time-sombra", icon: "fa-chess-board", title: "Time sombra", category: "Planejamento", fact: "Alvos por posição" },
];

const numberFormat = new Intl.NumberFormat("pt-BR");
const fmt = (value: number | undefined) => (value == null ? "—" : numberFormat.format(value));

function useCarousel(count: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const step = first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0");
    const visible = Math.max(1, Math.round(track.clientWidth / step));
    setMaxIndex(Math.max(0, count - visible));
    setIndex(Math.round(track.scrollLeft / step));
  }, [count]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  const goTo = (next: number) => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const step = first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0");
    const target = Math.max(0, Math.min(maxIndex, next));
    track.scrollTo({ left: target * step, behavior: "smooth" });
  };

  return { trackRef, index: Math.min(index, maxIndex), maxIndex, goTo, onScroll: measure };
}

export function HubSeasonPicker({ data }: { data: HubData }) {
  const searchParams = useSearchParams();
  const fromUrl = parseSeasonParam(searchParams.get("temporada"));
  const [season, setSeason] = useState<BrasileiraoSeason>(fromUrl);
  const carousel = useCarousel(FEATURES.length);

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

  const isArchiveHub = season !== CURRENT_SEASON;
  const current = data.seasons[CURRENT_SEASON];
  const seasonData = data.seasons[season] ?? current;
  const available = (id: LeagueId) => Boolean(seasonData.leagues[id]);
  const leagueHref = (id: LeagueId, path = "/posicao/zagueiros") =>
    available(id) ? withSeasonQuery(`/${id}${path}`, season) : `/${id}${path}`;
  const featuredOf = (id: LeagueId) => seasonData.featured[id] ?? current.featured[id] ?? [];
  const athleteHref = (id: LeagueId, athlete: HubAthlete) =>
    leagueHref(id, `/posicao/${athlete.family}?atleta=${encodeURIComponent(athlete.id)}`);

  const seriesCount = BRASILEIRAO_LEAGUES.filter((league) => available(league.id)).length;
  const competitions = seriesCount + (isArchiveHub ? 0 : ESTADUAIS_LEVELS.length);
  const estPlayers = ESTADUAIS_LEVELS.reduce((sum, level) => sum + (current.leagues[level.id]?.players ?? 0), 0);

  const heroAthlete = featuredOf("serie-a")[0];
  const crowd = [featuredOf("serie-b")[1], featuredOf("serie-a")[2], featuredOf("serie-c")[1]].filter(
    (athlete): athlete is HubAthlete => Boolean(athlete),
  );

  return (
    <div className={`scout-root home-page hub-page hx hb${isArchiveHub ? " hub-page-archive is-archive" : ""}`}>
      <ScoutTopbar active="inicio" hubMode />
      <main className="hb-main">
        {/* 1 · Hero: atleta em destaque + chamada */}
        <section className="hb-hero">
          <div className="hb-hero-stage" aria-hidden={!heroAthlete}>
            <span className="hb-stripe hb-stripe-1" aria-hidden />
            <span className="hb-stripe hb-stripe-2" aria-hidden />
            <span className="hb-stripe hb-stripe-3" aria-hidden />
            {heroAthlete ? (
              <Link href={athleteHref("serie-a", heroAthlete)} className="hb-hero-athlete">
                <PlayerPhoto src={heroAthlete.photo} alt={heroAthlete.name} className="hb-hero-photo" />
                <span className="hb-hero-caption">
                  <em>Destaque · Série A {season}</em>
                  <strong>{heroAthlete.name}</strong>
                  <span>{heroAthlete.club}</span>
                </span>
              </Link>
            ) : null}
          </div>

          <div className="hb-hero-copy">
            <p className="hx-status">
              <span className="hx-status-dot" aria-hidden />
              {isArchiveHub ? `Arquivo Wyscout · temporada ${season}` : `Temporada ${season} · scout ao vivo`}
            </p>
            <h1 className="hb-title">
              conheça o<br />
              <span>scout SADA</span>
            </h1>
            <p className="hb-lead">
              Ratings, perfis e comparações de {fmt(seasonData.players)} atletas do futebol brasileiro. Cada posição é
              medida só contra quem joga no mesmo grupo.
            </p>
            <a href="#competicoes" className="hb-more">
              Ver todas as competições <i className="fa-solid fa-circle-chevron-right" aria-hidden="true" />
            </a>

            <div className="hx-season hb-season" role="group" aria-label="Temporada do hub">
              <span className="hx-season-label">Temporada</span>
              <div className="hx-season-tabs">
                {BRASILEIRAO_SEASONS.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={season === year ? "is-active" : ""}
                    aria-pressed={season === year}
                    onClick={() => pick(year)}
                  >
                    {year === CURRENT_SEASON ? <span className="hx-live-dot" aria-label="ao vivo" /> : null}
                    {year}
                  </button>
                ))}
              </div>
            </div>

            <dl className="hb-stats">
              <div>
                <dt>Atletas</dt>
                <dd>{fmt(seasonData.players)}</dd>
              </div>
              <div>
                <dt>Competições</dt>
                <dd>{competitions}</dd>
              </div>
              <div>
                <dt>Posições</dt>
                <dd>{POSITION_FAMILIES.length}</dd>
              </div>
              <div>
                <dt>Temporadas</dt>
                <dd>{BRASILEIRAO_SEASONS.length}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* 2 · Competições: um atleta por competição, em painéis inclinados */}
        <section id="competicoes" className="hb-comps" aria-labelledby="hb-comps-title">
          <h2 id="hb-comps-title" className="hb-sr">
            Competições
          </h2>
          <div className="hb-comp-row">
            {BRASILEIRAO_LEAGUES.map((league, index) => {
              const athlete = featuredOf(league.id)[league.id === "serie-a" ? 1 : 0] ?? featuredOf(league.id)[0];
              const onlyCurrent = !available(league.id);
              const stats = seasonData.leagues[league.id] ?? current.leagues[league.id];
              return (
                <Link
                  key={league.id}
                  href={leagueHref(league.id)}
                  className={`hb-comp ${index % 2 ? "is-accent" : "is-dark"}${onlyCurrent ? " is-unavailable" : ""}`}
                  aria-label={onlyCurrent ? `${league.name}: sem dados em ${season}` : undefined}
                  title={onlyCurrent ? `${league.name} · sem arquivo ${season}, abre ${CURRENT_SEASON}` : league.name}
                >
                  <span className="hb-comp-panel" aria-hidden />
                  {athlete && !onlyCurrent ? (
                    <>
                      <PlayerPhoto src={athlete.photo} alt="" className="hb-comp-photo" loading="lazy" />
                      <span className="hb-comp-name">{athlete.name}</span>
                    </>
                  ) : null}
                  {onlyCurrent ? (
                    <span className="hb-comp-empty" aria-hidden>
                      <SiteLogo variant="mark" alt="" />
                    </span>
                  ) : null}
                  <span className="hb-comp-logo">
                    <img src={league.logo} alt="" />
                  </span>
                  <span className="hb-comp-label">
                    <strong>{league.name}</strong>
                    <em>
                      {onlyCurrent
                        ? `Sem dados em ${season} · abre ${CURRENT_SEASON}`
                        : `${TIER_LABEL[league.id]} · ${fmt(stats?.players)} atletas`}
                    </em>
                    {!onlyCurrent ? (
                      <small className="hb-comp-cta">
                        Clique para acessar <i className="fa-solid fa-chevron-right" aria-hidden />
                      </small>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="hb-estaduais" aria-label="Estaduais por nível">
            <span className="hb-estaduais-title">
              Estaduais {CURRENT_SEASON}
              <em>{fmt(estPlayers)} atletas</em>
            </span>
            <ul>
              {ESTADUAIS_LEVELS.map((level, index) => (
                <li key={level.id}>
                  <Link href={`/${level.id}/posicao/zagueiros`} className="hb-level" title={level.members.map((m) => m.name).join(" · ")}>
                    <span className="hb-level-n">N{index + 1}</span>
                    <span className="hb-level-name">{level.name}</span>
                    <span className="hb-level-logos" aria-hidden>
                      {level.members.slice(0, 4).map((member) => (
                        <img key={member.id} src={member.logo} alt="" />
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3 · Vitrine: as ferramentas do site como produtos */}
        <section className="hb-shop" aria-labelledby="hb-shop-title">
          <header className="hb-shop-head">
            <h2 id="hb-shop-title">
              <SiteLogo variant="mark" className="hb-shop-mark" alt="" />
              ferramentas do scout
            </h2>
            <span className="hb-shop-meta">Abrem na Série A {season}</span>
          </header>
          <div className="hb-shop-track" ref={carousel.trackRef} onScroll={carousel.onScroll}>
            {FEATURES.map((feature) => (
              <Link key={feature.title} href={leagueHref("serie-a", feature.path)} className="hb-product">
                {feature.isNew ? <span className="hb-product-tag">novo</span> : null}
                <span className="hb-product-art" aria-hidden>
                  <i className={`fa-solid ${feature.icon}`} />
                </span>
                <span className="hb-product-body">
                  <strong>{feature.title}</strong>
                  <em>{feature.category}</em>
                  <span className="hb-product-fact">{feature.fact}</span>
                </span>
              </Link>
            ))}
          </div>
          <footer className="hb-shop-foot">
            <div className="hb-shop-nav">
              <button type="button" onClick={() => carousel.goTo(carousel.index - 1)} disabled={carousel.index <= 0} aria-label="Anterior">
                <i className="fa-solid fa-chevron-left" />
              </button>
              <span className="hb-dots" aria-hidden>
                {Array.from({ length: carousel.maxIndex + 1 }, (_, i) => (
                  <button key={i} type="button" className={i === carousel.index ? "is-active" : ""} onClick={() => carousel.goTo(i)} tabIndex={-1} />
                ))}
              </span>
              <button
                type="button"
                onClick={() => carousel.goTo(carousel.index + 1)}
                disabled={carousel.index >= carousel.maxIndex}
                aria-label="Próximo"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
            <Link href={leagueHref("serie-a")} className="hb-more">
              Abrir a Série A {season} <i className="fa-solid fa-circle-chevron-right" aria-hidden="true" />
            </Link>
          </footer>
        </section>
      </main>

      {/* 4 · Faixa escura: chamada para o time sombra */}
      <section className="hb-custom" aria-labelledby="hb-custom-title">
        <div className="hb-custom-crowd" aria-hidden>
          {crowd.map((athlete, i) => (
            <PlayerPhoto key={athlete.id} src={athlete.photo} alt="" className={`hb-crowd-photo hb-crowd-${i}`} loading="lazy" />
          ))}
        </div>
        <SiteLogo variant="stacked" className="hb-custom-watermark" alt="" />
        <div className="hb-custom-copy">
          <SiteLogo variant="horizontal" className="hb-custom-lockup" />
          <span className="hb-custom-eyebrow">Monte o seu elenco ideal</span>
          <h2 id="hb-custom-title">time sombra</h2>
          <p>
            Escolha alvos por posição em qualquer série, compare com o elenco atual e leve o relatório pronto para a
            reunião.
          </p>
          <Link href={leagueHref("serie-a", "/time-sombra")} className="hb-cta">
            Começar
          </Link>
          <Link href={leagueHref("serie-a", "/comparar")} className="hb-more">
            Comparar atletas <i className="fa-solid fa-circle-chevron-right" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="hx-footer hb-footer">
        <span className="hb-footer-brand">
          <SiteLogo variant="horizontal" className="hb-footer-lockup" />
          Sistema de Análise de Dados de Atletas
        </span>
        <span>
          Dados Wyscout · Brasileirão {BRASILEIRAO_SEASONS[BRASILEIRAO_SEASONS.length - 1]}–{CURRENT_SEASON} · Estaduais{" "}
          {CURRENT_SEASON}
        </span>
      </footer>
    </div>
  );
}
