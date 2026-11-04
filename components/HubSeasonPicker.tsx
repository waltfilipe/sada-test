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
  INTRO_STORAGE_KEY,
  parseSeasonParam,
  withSeasonQuery,
  type BrasileiraoSeason,
} from "@/lib/seasons";
import type { PositionFamily } from "@/lib/types";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { SiteLogo } from "@/components/SiteLogo";
import { HubIntro } from "@/components/HubIntro";

export type HubLeagueStats = {
  players: number;
  families: Partial<Record<PositionFamily, number>>;
};

export type HubData = {
  seasons: Record<
    string,
    {
      leagues: Partial<Record<LeagueId, HubLeagueStats>>;
      players: number;
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

const ENTER_DELAY_MS = 350;
const numberFormat = new Intl.NumberFormat("pt-BR");
const fmt = (value: number | undefined) => (value == null ? "—" : numberFormat.format(value));
const vars = (values: Record<string, string | number>) => values as React.CSSProperties;

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

/** Marca `.is-in` nos blocos `.hb-reveal` quando entram na tela. */
function useReveal(rootRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const targets = root.querySelectorAll<HTMLElement>(".hb-reveal:not(.is-in)");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [rootRef, enabled]);
}

/** Número que sobe de 0 até o valor quando `run` liga. */
function CountUp({ value, run }: { value: number; run: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!run) {
      setShown(value);
      return;
    }
    const startedAt = performance.now();
    const duration = 1400;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 4))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setShown(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, run]);
  return <>{fmt(shown)}</>;
}

/** Inclinação 3D da taça seguindo o ponteiro. */
function tilt(event: React.PointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  card.style.setProperty("--ry", `${(x * 22).toFixed(2)}deg`);
  card.style.setProperty("--rx", `${(-y * 14).toFixed(2)}deg`);
}

function untilt(event: React.PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--ry", "0deg");
  event.currentTarget.style.setProperty("--rx", "0deg");
}

/* Campinho do time sombra: 4-3-3 com três alvos em destaque. */
const PITCH_PLAYERS: Array<{ x: number; y: number; target?: string }> = [
  { x: 46, y: 220 },
  { x: 150, y: 74 },
  { x: 136, y: 172, target: "ZAG · Série B" },
  { x: 136, y: 268 },
  { x: 150, y: 366 },
  { x: 268, y: 120 },
  { x: 250, y: 220 },
  { x: 268, y: 320, target: "MEI · Série A" },
  { x: 410, y: 84 },
  { x: 440, y: 220, target: "ATA · Série C" },
  { x: 410, y: 356 },
];

const PITCH_LINKS: Array<[number, number]> = [
  [0, 2], [0, 3], [1, 2], [2, 3], [3, 4], [1, 5], [2, 6], [3, 6], [4, 7],
  [5, 6], [6, 7], [5, 8], [6, 9], [7, 10], [8, 9], [9, 10],
];

function ShadowPitch() {
  const targets = PITCH_PLAYERS.map((player, index) => ({ ...player, index })).filter((player) => player.target);
  return (
    <svg className="hb-pitch" viewBox="0 0 680 440" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} className={i % 2 ? "hb-pitch-stripe is-alt" : "hb-pitch-stripe"} x={i * 85} y="0" width="85" height="440" />
      ))}
      <g className="hb-pitch-lines">
        <rect x="10" y="10" width="660" height="420" rx="4" />
        <line x1="340" y1="10" x2="340" y2="430" />
        <circle cx="340" cy="220" r="58" />
        <circle cx="340" cy="220" r="3" className="is-fill" />
        <rect x="10" y="110" width="100" height="220" />
        <rect x="10" y="168" width="36" height="104" />
        <rect x="570" y="110" width="100" height="220" />
        <rect x="634" y="168" width="36" height="104" />
        <path d="M110 178 A 58 58 0 0 1 110 262" />
        <path d="M570 178 A 58 58 0 0 0 570 262" />
      </g>
      <g className="hb-pitch-net">
        {PITCH_LINKS.map(([a, b], i) => (
          <line
            key={`${a}-${b}`}
            x1={PITCH_PLAYERS[a].x}
            y1={PITCH_PLAYERS[a].y}
            x2={PITCH_PLAYERS[b].x}
            y2={PITCH_PLAYERS[b].y}
            pathLength={1}
            style={vars({ "--i": i })}
          />
        ))}
      </g>
      <path
        className="hb-pitch-route"
        d={`M${targets[0].x} ${targets[0].y} Q 210 300 ${targets[1].x} ${targets[1].y} T ${targets[2].x} ${targets[2].y}`}
        pathLength={1}
      />
      {PITCH_PLAYERS.map((player, i) =>
        player.target ? null : (
          <circle key={i} className="hb-pitch-dot" cx={player.x} cy={player.y} r="9" style={vars({ "--i": i })} />
        ),
      )}
      {targets.map((player, t) => (
        <g key={player.index} className="hb-pitch-target" style={vars({ "--i": player.index, "--t": t })}>
          <circle className="hb-pitch-pulse" cx={player.x} cy={player.y} r="13" />
          <circle className="hb-pitch-dot is-target" cx={player.x} cy={player.y} r="11" />
          <g className="hb-pitch-tag" transform={`translate(${player.x + 18} ${player.y - 30})`}>
            <rect width={player.target!.length * 7.4 + 18} height="24" rx="6" />
            <text x="9" y="16.5">
              {player.target}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}

export function HubSeasonPicker({ data }: { data: HubData }) {
  const searchParams = useSearchParams();
  const fromUrl = parseSeasonParam(searchParams.get("temporada"));
  const [season, setSeason] = useState<BrasileiraoSeason>(fromUrl);
  const carousel = useCarousel(FEATURES.length);
  const rootRef = useRef<HTMLDivElement>(null);
  /** intro → splash na tela · gone → splash desmontado. */
  const [intro, setIntro] = useState<"intro" | "gone">("intro");
  /** live = capa liberada para animar; countUp só quando veio do splash. */
  const [live, setLive] = useState(false);
  const [countUp, setCountUp] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = Boolean(sessionStorage.getItem(INTRO_STORAGE_KEY));
    } catch {
      /* ignore */
    }
    if (seen) {
      setIntro("gone");
      setLive(true);
    }
  }, []);

  useReveal(rootRef, live);

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

  const seriesCount = BRASILEIRAO_LEAGUES.filter((league) => available(league.id)).length;
  const competitions = seriesCount + (isArchiveHub ? 0 : ESTADUAIS_LEVELS.length);
  const estPlayers = ESTADUAIS_LEVELS.reduce((sum, level) => sum + (current.leagues[level.id]?.players ?? 0), 0);

  const stats = [
    { label: "Atletas", value: seasonData.players },
    { label: "Competições", value: competitions },
    { label: "Posições", value: POSITION_FAMILIES.length },
    { label: "Temporadas", value: BRASILEIRAO_SEASONS.length },
  ];

  return (
    <div
      ref={rootRef}
      className={`scout-root home-page hub-page hx hb${live ? " is-live" : ""}${isArchiveHub ? " hub-page-archive is-archive" : ""}`}
    >
      {intro !== "gone" ? (
        <HubIntro
          onEnter={() => {
            // A capa entra enquanto o círculo do splash se fecha, não escondida atrás dele.
            window.setTimeout(() => {
              setCountUp(true);
              setLive(true);
            }, ENTER_DELAY_MS);
          }}
          onDone={() => setIntro("gone")}
        />
      ) : null}

      <ScoutTopbar active="inicio" hubMode />
      <main className="hb-main">
        {/* 1 · Hero editorial: "sada" gigante sobre papel */}
        <section className="hb-hero hb-in hb-in-hero" aria-labelledby="hb-hero-title">
          <div className="hb-hero-top hb-in" style={vars({ "--d": "520ms" })}>
            <nav className="hb-hero-nav" aria-label="Atalhos da capa">
              <a href="#competicoes">Competições</a>
              <a href="#ferramentas">Ferramentas</a>
              <a href="#time-sombra">Time sombra</a>
            </nav>
            <div className="hb-hero-seasons" role="group" aria-label="Temporada do hub">
              <span className="hb-hero-seasons-label">Temporada</span>
              {BRASILEIRAO_SEASONS.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={season === year ? "is-active" : ""}
                  aria-pressed={season === year}
                  onClick={() => pick(year)}
                >
                  {year === CURRENT_SEASON ? <span className="hb-hero-live" aria-label="ao vivo" /> : null}
                  {year}
                </button>
              ))}
            </div>
          </div>

          <a href="#competicoes" className="hb-hero-badge hb-in" style={vars({ "--d": "1200ms" })} aria-label="Ver competições">
            <svg viewBox="0 0 124 124" aria-hidden>
              <defs>
                <path id="hb-badge-path" d="M62 62 m-48 0 a48 48 0 1 1 96 0 a48 48 0 1 1 -96 0" />
              </defs>
              <text>
                <textPath href="#hb-badge-path" textLength="298" lengthAdjust="spacing">
                  scout · dados · perfis · projeções ·
                </textPath>
              </text>
            </svg>
            <i className="fa-solid fa-arrow-down" aria-hidden />
          </a>

          <div className="hb-hero-word" aria-hidden>
            {"sada".split("").map((letter, i) => (
              <span key={i} className="hb-hero-letter" style={vars({ "--i": i })}>
                <span>{letter}</span>
              </span>
            ))}
            <img src="/brand/sada-icon.png" alt="" className="hb-hero-icon" />
          </div>

          <div className="hb-hero-foot">
            <div className="hb-hero-left hb-in" style={vars({ "--d": "900ms" })}>
              <a href="#competicoes" className="hb-hero-link">
                Ver todas as competições
              </a>
              <h1 id="hb-hero-title" className="hb-hero-title">
                Conheça o
                <br />
                Scout SADA
                <br />
                {isArchiveHub ? `Arquivo ${season}` : season}
                <sup>©</sup>
              </h1>
            </div>

            <div className="hb-hero-right hb-in" style={vars({ "--d": "1040ms" })}>
              <p className="hb-hero-tag">* (sistema de análise de dados de atletas)</p>
              <p className="hb-hero-lead">
                Ratings, perfis e comparações de {fmt(seasonData.players)} atletas do futebol brasileiro. Cada posição é
                medida só contra quem joga no mesmo grupo.
              </p>
              <dl className="hb-hero-stats">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>
                      <CountUp value={stat.value} run={countUp} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* 2 · Competições: taças em painéis inclinados */}
        <section id="competicoes" className="hb-comps" aria-labelledby="hb-comps-title">
          <header className="hb-comps-head hb-in" style={vars({ "--d": "1150ms" })}>
            <h2 id="hb-comps-title">
              competições <span>nacionais</span>
            </h2>
            <span>Escolha a taça · temporada {season}</span>
          </header>
          <div className="hb-comp-row">
            {BRASILEIRAO_LEAGUES.map((league, index) => {
              const onlyCurrent = !available(league.id);
              const leagueStats = seasonData.leagues[league.id] ?? current.leagues[league.id];
              return (
                <Link
                  key={league.id}
                  href={leagueHref(league.id)}
                  className={`hb-comp hb-in ${index % 2 ? "is-accent" : "is-dark"}${onlyCurrent ? " is-unavailable" : ""}`}
                  style={vars({ "--d": `${1250 + index * 130}ms`, "--i": index })}
                  aria-label={onlyCurrent ? `${league.name}: sem dados em ${season}` : undefined}
                  title={onlyCurrent ? `${league.name} · sem arquivo ${season}, abre ${CURRENT_SEASON}` : league.name}
                  onPointerMove={tilt}
                  onPointerLeave={untilt}
                >
                  <span className="hb-comp-panel" aria-hidden />
                  <span className="hb-comp-letter" aria-hidden>
                    {league.name.slice(-1)}
                  </span>
                  {!onlyCurrent ? (
                    <>
                      <span className="hb-comp-rays" aria-hidden />
                      <span className="hb-comp-floor" aria-hidden />
                      <span className="hb-comp-cup" aria-hidden>
                        <span className="hb-comp-tilt">
                          <img src={`/trophies/${league.id}.png`} alt="" className="hb-comp-trophy" loading="lazy" />
                          <span
                            className="hb-comp-shine"
                            style={vars({ "--cup": `url(/trophies/${league.id}.png)` })}
                          />
                        </span>
                      </span>
                      <span className="hb-comp-sparks" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                    </>
                  ) : (
                    <span className="hb-comp-empty" aria-hidden>
                      <SiteLogo variant="mark" alt="" />
                    </span>
                  )}
                  <span className="hb-comp-logo">
                    <img src={league.logo} alt="" />
                  </span>
                  <span className="hb-comp-label">
                    <strong>{league.name}</strong>
                    <em>
                      {onlyCurrent
                        ? `Sem dados em ${season} · abre ${CURRENT_SEASON}`
                        : `${TIER_LABEL[league.id]} · ${fmt(leagueStats?.players)} atletas`}
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

          <div className="hb-estaduais hb-reveal" aria-label="Estaduais por nível">
            <span className="hb-estaduais-title">
              Estaduais {CURRENT_SEASON}
              <em>{fmt(estPlayers)} atletas</em>
            </span>
            <ul>
              {ESTADUAIS_LEVELS.map((level, index) => (
                <li key={level.id} style={vars({ "--i": index })}>
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
        <section id="ferramentas" className="hb-shop hb-reveal" aria-labelledby="hb-shop-title">
          <header className="hb-shop-head">
            <h2 id="hb-shop-title">
              <SiteLogo variant="mark" className="hb-shop-mark" alt="" />
              ferramentas do scout
            </h2>
            <span className="hb-shop-meta">Abrem na Série A {season}</span>
          </header>
          <div className="hb-shop-track" ref={carousel.trackRef} onScroll={carousel.onScroll}>
            {FEATURES.map((feature, index) => (
              <Link
                key={feature.title}
                href={leagueHref("serie-a", feature.path)}
                className="hb-product"
                style={vars({ "--i": index })}
              >
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

      {/* 4 · Faixa escura: chamada para o time sombra, com campinho animado */}
      <section id="time-sombra" className="hb-custom hb-reveal" aria-labelledby="hb-custom-title">
        <div className="hb-pitch-wrap" aria-hidden>
          <ShadowPitch />
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
