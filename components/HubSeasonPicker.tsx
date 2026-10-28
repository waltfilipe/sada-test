"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export type HubLeagueStats = {
  players: number;
  families: Partial<Record<PositionFamily, number>>;
};

export type HubData = {
  seasons: Record<string, { leagues: Partial<Record<LeagueId, HubLeagueStats>>; players: number }>;
};

const TIER_LABEL: Partial<Record<LeagueId, string>> = {
  "serie-a": "1ª divisão",
  "serie-b": "2ª divisão",
  "serie-c": "3ª divisão",
  "serie-d": "4ª divisão",
};

/** Formation on a 100×64 pitch, attacking to the right. */
const PITCH_NODES: { family: PositionFamily; x: number; y: number }[] = [
  { family: "zagueiros", x: 17, y: 34 },
  { family: "laterais", x: 31, y: 13 },
  { family: "meio-campistas", x: 45, y: 40 },
  { family: "extremos", x: 63, y: 19 },
  { family: "atacantes", x: 81, y: 37 },
];

const PITCH_LINKS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 4],
];

const TOOLS = [
  {
    path: "/posicao/zagueiros",
    icon: "fa-ranking-star",
    title: "Posições",
    copy: "Ranking, perfil e nota de cada atleta, medido só contra quem joga na mesma posição.",
  },
  {
    path: "/filtros",
    icon: "fa-sliders",
    title: "Filtros",
    copy: "Cruze idade, minutos, pé, perfil e selos para achar o encaixe certo.",
  },
  {
    path: "/comparar",
    icon: "fa-scale-balanced",
    title: "Comparar",
    copy: "Dois atletas lado a lado, métrica por métrica e perfil contra perfil.",
  },
  {
    path: "/scatter",
    icon: "fa-chart-line",
    title: "Scatter",
    copy: "O grupo inteiro em dois eixos para achar quem foge da curva.",
  },
  {
    path: "/time-sombra",
    icon: "fa-people-group",
    title: "Elenco + Time Sombra",
    copy: "Monte o elenco atual e a lista de alvos para cada posição.",
  },
];

const numberFormat = new Intl.NumberFormat("pt-BR");
const fmt = (value: number | undefined) => (value == null ? "—" : numberFormat.format(value));

export function HubSeasonPicker({ data }: { data: HubData }) {
  const searchParams = useSearchParams();
  const fromUrl = parseSeasonParam(searchParams.get("temporada"));
  const [season, setSeason] = useState<BrasileiraoSeason>(fromUrl);
  const [pitchLeague, setPitchLeague] = useState<LeagueId>("serie-a");

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
  const pitchId = available(pitchLeague) ? pitchLeague : "serie-a";
  const pitchStats = seasonData.leagues[pitchId];
  const pitchName = BRASILEIRAO_LEAGUES.find((league) => league.id === pitchId)?.name;
  const estPlayers = ESTADUAIS_LEVELS.reduce((sum, level) => sum + (current.leagues[level.id]?.players ?? 0), 0);

  return (
    <div className={`scout-root home-page hub-page hx${isArchiveHub ? " hub-page-archive is-archive" : ""}`}>
      <ScoutTopbar active="inicio" hubMode />
      <main className="hx-main">
        <section className="hx-hero">
          <div className="hx-hero-copy">
            <p className="hx-status">
              <span className="hx-status-dot" aria-hidden />
              {isArchiveHub ? `Arquivo Wyscout · temporada ${season}` : `Temporada ${season} · scout ao vivo`}
            </p>
            <h1 className="hx-title">
              Scout do futebol brasileiro, <span>guiado por dados.</span>
            </h1>
            <p className="hx-lead">
              Ratings, perfis e comparações de {fmt(seasonData.players)} atletas. Cada posição é medida só contra quem
              joga no mesmo grupo, para que a nota diga algo de verdade.
            </p>

            <div className="hx-season" role="group" aria-label="Temporada do hub">
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

            <div className="hx-actions">
              <Link href={leagueHref("serie-a")} className="hx-btn hx-btn-primary">
                Abrir Série A {season} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </Link>
              <Link href={leagueHref("serie-a", "/comparar")} className="hx-btn hx-btn-ghost">
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Comparar atletas
              </Link>
            </div>

            <dl className="hx-stats">
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

          <aside className="hx-pitch-card" aria-label="Atalho por posição">
            <header className="hx-pitch-head">
              <div>
                <span className="hx-eyebrow">Atalho por posição</span>
                <strong>
                  {pitchName} · {season}
                </strong>
              </div>
              <div className="hx-pitch-leagues" role="group" aria-label="Série do atalho">
                {BRASILEIRAO_LEAGUES.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    className={league.id === pitchId ? "is-active" : ""}
                    aria-pressed={league.id === pitchId}
                    disabled={!available(league.id)}
                    title={available(league.id) ? league.name : `${league.name} · só ${CURRENT_SEASON}`}
                    onClick={() => setPitchLeague(league.id)}
                  >
                    {league.brand}
                  </button>
                ))}
              </div>
            </header>
            <div className="hx-pitch">
              <svg className="hx-pitch-lines" viewBox="0 0 100 64" aria-hidden="true">
                <g className="hx-pitch-field">
                  <rect x="2" y="2" width="96" height="60" rx="1" />
                  <line x1="50" y1="2" x2="50" y2="62" />
                  <circle cx="50" cy="32" r="7.5" />
                  <circle cx="50" cy="32" r="0.6" className="hx-pitch-spot" />
                  <rect x="2" y="17" width="12.5" height="30" />
                  <rect x="85.5" y="17" width="12.5" height="30" />
                  <rect x="2" y="25" width="4.5" height="14" />
                  <rect x="93.5" y="25" width="4.5" height="14" />
                  <path d="M14.5 26.5 A7 7 0 0 1 14.5 37.5" />
                  <path d="M85.5 26.5 A7 7 0 0 0 85.5 37.5" />
                </g>
                <g className="hx-pitch-net">
                  {PITCH_LINKS.map(([a, b]) => (
                    <line
                      key={`${a}-${b}`}
                      x1={PITCH_NODES[a]!.x}
                      y1={PITCH_NODES[a]!.y}
                      x2={PITCH_NODES[b]!.x}
                      y2={PITCH_NODES[b]!.y}
                    />
                  ))}
                </g>
              </svg>
              {PITCH_NODES.map((node) => {
                const family = POSITION_FAMILIES.find((item) => item.key === node.family)!;
                const count = pitchStats?.families[node.family];
                return (
                  <Link
                    key={node.family}
                    href={leagueHref(pitchId, `/posicao/${family.slug}`)}
                    className="hx-node"
                    style={{ left: `${node.x}%`, top: `${(node.y / 64) * 100}%` }}
                    aria-label={`${family.label} · ${fmt(count)} atletas`}
                  >
                    <span className="hx-node-dot">{family.short}</span>
                    <span className="hx-node-label">
                      {family.label}
                      <em>{fmt(count)} atletas</em>
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="hx-pitch-foot">
              <i className="fa-solid fa-hand-pointer" aria-hidden="true" /> Clique numa posição para abrir o ranking.
            </p>
          </aside>
        </section>

        <section className="hx-section" aria-labelledby="hx-br-title">
          <header className="hx-section-head">
            <div>
              <span className="hx-eyebrow">Competições nacionais</span>
              <h2 id="hx-br-title">Brasileirão</h2>
            </div>
            <p className="hx-section-meta">
              {seriesCount} séries · temporada {season}
            </p>
          </header>
          <div className="hx-series">
            {BRASILEIRAO_LEAGUES.map((league) => {
              const onlyCurrent = !available(league.id);
              const stats = seasonData.leagues[league.id] ?? current.leagues[league.id];
              return (
                <article key={league.id} className={`hx-card hx-serie${onlyCurrent ? " is-unavailable" : ""}`}>
                  <div className="hx-serie-top">
                    <span className="hx-serie-logo">
                      <img src={league.logo} alt="" />
                    </span>
                    <span className="hx-tag">{TIER_LABEL[league.id]}</span>
                  </div>
                  <div className="hx-serie-title">
                    <h3>
                      <Link href={leagueHref(league.id)} className="hx-stretch">
                        {league.name}
                      </Link>
                    </h3>
                    <span className="hx-arrow" aria-hidden="true">
                      <i className="fa-solid fa-arrow-right" />
                    </span>
                  </div>
                  <p className="hx-serie-season">
                    {onlyCurrent ? `Sem arquivo ${season} · abre ${CURRENT_SEASON}` : `Temporada ${season}`}
                  </p>
                  <dl className="hx-serie-stats">
                    <div>
                      <dt>Atletas analisados</dt>
                      <dd>{fmt(stats?.players)}</dd>
                    </div>
                  </dl>
                  <ul className="hx-chips" aria-label={`Posições na ${league.name}`}>
                    {POSITION_FAMILIES.map((family) => (
                      <li key={family.key}>
                        <Link
                          href={leagueHref(league.id, `/posicao/${family.slug}`)}
                          className="hx-chip"
                          title={`${family.label} · ${fmt(stats?.families[family.key])} atletas`}
                        >
                          {family.short}
                          <em>{fmt(stats?.families[family.key])}</em>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="hx-section" aria-labelledby="hx-est-title">
          <header className="hx-section-head">
            <div>
              <span className="hx-eyebrow">Competições estaduais · {CURRENT_SEASON}</span>
              <h2 id="hx-est-title">Estaduais por nível</h2>
            </div>
            <p className="hx-section-meta">
              {fmt(estPlayers)} atletas · notas calculadas só dentro de cada nível
            </p>
          </header>
          {isArchiveHub ? (
            <p className="hx-note">
              <i className="fa-solid fa-circle-info" aria-hidden="true" /> Os estaduais só têm a temporada{" "}
              {CURRENT_SEASON}; estes links abrem {CURRENT_SEASON}.
            </p>
          ) : null}
          <div className="hx-levels">
            {ESTADUAIS_LEVELS.map((level, index) => {
              const strength = ESTADUAIS_LEVELS.length - index;
              return (
                <article key={level.id} className="hx-card hx-level">
                  <div className="hx-level-top">
                    <span className="hx-level-badge">
                      <span className="hx-bars" aria-hidden="true">
                        {[1, 2, 3, 4].map((bar) => (
                          <i key={bar} className={bar <= strength ? "on" : ""} />
                        ))}
                      </span>
                      Nível {index + 1}
                    </span>
                    <span className="hx-level-count">{fmt(current.leagues[level.id]?.players)} atletas</span>
                  </div>
                  <h3>
                    <Link href={`/${level.id}/posicao/zagueiros`} className="hx-stretch">
                      {level.name}
                    </Link>
                  </h3>
                  <p className="hx-level-members">
                    {level.members.length > 1 ? level.members.map((member) => member.name).join(" · ") : level.hint}
                  </p>
                  <ul className="hx-level-logos">
                    {level.members.map((member) => (
                      <li key={member.id} title={member.name}>
                        <span className="hx-level-logo">
                          <img src={member.logo} alt={member.name} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span className="hx-card-go" aria-hidden="true">
                    Abrir nível <i className="fa-solid fa-arrow-right" />
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="hx-section" aria-labelledby="hx-tools-title">
          <header className="hx-section-head">
            <div>
              <span className="hx-eyebrow">Ferramentas</span>
              <h2 id="hx-tools-title">Tudo o que o scout precisa</h2>
            </div>
            <p className="hx-section-meta">Abrem na Série A {season}</p>
          </header>
          <div className="hx-tools">
            {TOOLS.map((tool) => (
              <Link key={tool.path} href={leagueHref("serie-a", tool.path)} className="hx-card hx-tool">
                <span className="hx-tool-icon" aria-hidden="true">
                  <i className={`fa-solid ${tool.icon}`} />
                </span>
                <strong>{tool.title}</strong>
                <p>{tool.copy}</p>
                <span className="hx-card-go" aria-hidden="true">
                  Abrir <i className="fa-solid fa-arrow-right" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="hx-footer">
        <span>
          <strong>SADA</strong> · Sistema de Análise de Dados de Atletas
        </span>
        <span>Dados Wyscout · Brasileirão {BRASILEIRAO_SEASONS[BRASILEIRAO_SEASONS.length - 1]}–{CURRENT_SEASON} · Estaduais {CURRENT_SEASON}</span>
      </footer>
    </div>
  );
}
