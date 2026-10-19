"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { useLeague } from "@/components/LeagueProvider";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { crossingReading, formatPer90 } from "@/lib/crossingTendency";
import { statRowLabel } from "@/lib/seasonTotals";
import { centeredTendencyPosition } from "@/lib/tendencyScale";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { isZagCluster } from "@/lib/clusterMeta";
import { formatFoot } from "@/lib/feet";
import { familyBySlug } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { activeProfileKeys, archetypeRank, profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { isProjectionEligible, realisticProjection } from "@/lib/minuteProjection";
import { playerInitials, profileGradeFromRank } from "@/lib/scoutTheme";
import { badgeCatalogForFamily, playerStatBadges } from "@/lib/statBadges";
import {
  REPORT_COPY,
  localizeContract,
  localizeMarketValue,
  localizeValue,
  ordinal,
  reportLocale,
  translateLabel,
  translateNationality,
  translateSection,
  type ReportLang,
} from "@/lib/reportI18n";
import { useLoading } from "@/components/LoadingProvider";
import { PlayerHeatmap } from "./PlayerHeatmap";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

type ReportCopy = (typeof REPORT_COPY)[ReportLang];

type ReportLine = {
  label: string;
  value: string;
  percentile: number | null;
  sub?: boolean;
  projectionValue?: string;
  projectionPercentile?: number | null;
};

type ReportBlock = {
  title: string | null;
  lines: ReportLine[];
};

type ReportSection = {
  title: string;
  tone: string;
  blocks: ReportBlock[];
};

function percentileOf(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? Math.round(value) : null;
}

function blocksFor(item: AspectItem, title: string, lang: ReportLang): ReportBlock[] {
  const copy = REPORT_COPY[lang];
  const blockTitle = translateLabel(title, lang);
  const subs = item.sub_metrics ?? [];
  if (subs.length) {
    const lines = subs
      .map((sub) => ({
        label: translateLabel(statRowLabel(sub.label), lang),
        value: localizeValue(sub.display_value?.trim() || "—", lang),
        percentile: percentileOf(sub.percentile),
      }))
      .filter((line) => line.value !== "—" || line.percentile != null);
    return lines.length ? [{ title: blockTitle, lines }] : [];
  }

  const volumeValue = localizeValue(
    item.display_value?.trim() ||
      (item.certos_per90 != null ? item.certos_per90.toFixed(1).replace(".", ",") : "—"),
    lang,
  );
  const volumePercentile = percentileOf(item.percentile);
  const efficiency: ReportLine | null =
    item.efficiency_pct != null || item.efficiency_value
      ? {
          label: copy.efficiency,
          value: localizeValue(item.efficiency_value?.trim() || "—", lang),
          percentile: percentileOf(item.efficiency_pct),
          sub: true,
        }
      : null;

  if (!efficiency) {
    if (volumeValue === "—" && volumePercentile == null) return [];
    return [
      {
        title: null,
        lines: [{ label: translateLabel(statRowLabel(title), lang), value: volumeValue, percentile: volumePercentile }],
      },
    ];
  }
  return [
    {
      title: blockTitle,
      lines: [{ label: copy.per90, value: volumeValue, percentile: volumePercentile }, efficiency],
    },
  ];
}

function reportSections(player: PlayerProfile, lang: ReportLang): ReportSection[] {
  const all = flattenAspects(player);
  const sections: ReportSection[] = [];
  for (const section of statSectionsForFamily(player.position_family)) {
    const blocks: ReportBlock[] = [];
    for (const label of section.labels) {
      const item = findAspect(all, label);
      if (!item) continue;
      const title = label === "Conduções Progressivas" ? "Progressão" : label;
      blocks.push(...blocksFor(item, title, lang));
    }
    if (blocks.length) sections.push({ title: translateSection(section.title, lang), tone: section.tone, blocks });
  }
  return sections;
}

function lineKey(section: string, block: string | null, label: string): string {
  return `${section}::${block ?? ""}::${label}`;
}

/** Overlay starter-minute projection on the observed lines. Same label, lighter figure. */
function applyProjection(base: ReportSection[], projected: ReportSection[]): ReportSection[] {
  const lookup = new Map<string, ReportLine>();
  for (const section of projected) {
    for (const block of section.blocks) {
      for (const line of block.lines) lookup.set(lineKey(section.title, block.title, line.label), line);
    }
  }
  return base.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      lines: block.lines.map((line) => {
        const hit = lookup.get(lineKey(section.title, block.title, line.label));
        if (!hit) return line;
        if (hit.value === line.value && hit.percentile === line.percentile) return line;
        return {
          ...line,
          projectionValue: hit.value,
          projectionPercentile: hit.percentile,
        };
      }),
    })),
  }));
}

/** Rough printed height of a section, in table rows. */
function sectionWeight(section: ReportSection): number {
  return section.blocks.reduce(
    (total, block, index) => total + block.lines.length + (block.title ? 1.1 : 0) + (index === 0 ? 0.7 : 0.4),
    2.2,
  );
}

/** Masonry keeping reading order: each section goes to the shortest column. Light positions get two wider columns. */
function sectionColumns(sections: ReportSection[]): { columns: ReportSection[][]; density: string } {
  const total = sections.reduce((sum, section) => sum + sectionWeight(section), 0);
  const count = total < 42 ? 2 : 3;
  const columns: ReportSection[][] = Array.from({ length: count }, () => []);
  const heights = Array(count).fill(0);
  for (const section of sections) {
    const target = heights.indexOf(Math.min(...heights));
    columns[target].push(section);
    heights[target] += sectionWeight(section);
  }
  // Spare page height goes into row spacing; the thresholds are in table rows of the tallest column.
  const tallest = Math.max(...heights);
  const density = tallest <= 20 ? "is-roomy" : tallest <= 27 ? "is-comfy" : "";
  return { columns: columns.filter((column) => column.length), density };
}

function formatIso(iso: string | null | undefined, lang: ReportLang): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, day || 1).toLocaleDateString(reportLocale(lang));
}

/** YouTube search for match clips. No API key — just an encoded public query. */
function youtubeHighlightsHref(player: PlayerProfile): string {
  const query = [player.name, player.club, player.position.toLocaleLowerCase("pt-BR"), "highlights"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function percentileTone(value: number | null): string {
  if (value == null) return "is-empty";
  if (value >= 70) return "is-high";
  if (value <= 30) return "is-low";
  return "is-mid";
}

type ReportMix = {
  key: string;
  label: string;
  share: number;
  active: boolean;
  grade: string | null;
  rank: number | null;
};

type ReportTendency = {
  key: string;
  label: string;
  detail: string;
  fill: number;
  averageFill: number | null;
  left: string;
  right: string;
};

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Profile name as the site classifies it, including the construtor or hybrid tone. */
function reportProfileName(player: PlayerProfile): string {
  const cluster = player.cluster;
  if (!cluster) return player.profile;
  if (isZagCluster(cluster)) return cluster.construtor_badge || cluster.archetype;
  if (cluster.archetype === "Híbrido" && cluster.hybrid_badge) return cluster.hybrid_badge;
  return cluster.archetype;
}

function reportMix(player: PlayerProfile, family: PositionFamily, players: PlayerProfile[]): ReportMix[] {
  const shareRows = sortedProfileShareRows(player);
  if (shareRows.length) {
    const active = activeProfileKeys(player, shareRows);
    const pool = players.length ? players : [player];
    return shareRows.map((row) => {
      const rank = archetypeRank(player, pool, row.label, family);
      return {
        key: row.key,
        label: row.label,
        share: row.share,
        active: active.has(row.key),
        rank,
        grade: rank ? profileGradeFromRank(rank, pool.length) : null,
      };
    });
  }

  return profileMetaForFamily(family)
    .filter((item) => item.key !== "perfil" && item.key !== "geral")
    .map((item) => ({
      key: item.key,
      label: item.label,
      share: player.profile_shares?.[item.key] ?? 0,
      active: false,
      grade: null,
      rank: null,
    }))
    .filter((item) => item.share > 0)
    .sort((a, b) => b.share - a.share);
}

function reportTendencies(player: PlayerProfile, players: PlayerProfile[], lang: ReportLang): ReportTendency[] {
  const copy = REPORT_COPY[lang];
  const per90 = (value: number) => localizeValue(formatPer90(value), lang);
  const items = player.aspects.perfil_construcao ?? [];
  const longo = items.find((item) => item.bar_key === "pass_tendency");
  const progressivo = items.find((item) => item.bar_key === "progressive_share");
  const rows: ReportTendency[] = [];

  if (longo?.share_pct != null) {
    const share = longo.share_pct;
    const average = longo.pool_avg_pct ?? null;
    const scale = Math.max(longo.scale_max_pct ?? 40, share, average ?? 0, 1);
    const gap = average == null ? null : share - average;
    const verdict = gap == null ? null : gap >= 2 ? copy.longer : gap <= -2 ? copy.shorter : copy.onAverage;
    const bits = [
      verdict,
      copy.longShare(Math.round(share)),
      average == null ? null : `${copy.average} ${Math.round(average)}%`,
    ].filter((bit): bit is string => Boolean(bit));
    rows.push({
      key: "curto",
      label: copy.shortPass,
      detail: bits.join(" · "),
      fill: average == null ? clampPct((share / scale) * 100) : clampPct(centeredTendencyPosition(share, average, scale)),
      averageFill: average == null ? null : 50,
      left: translateLabel(longo.axis_left || "Curto", lang),
      right: translateLabel(longo.axis_right || "Longo", lang),
    });
  }

  if (progressivo?.share_pct != null) {
    const share = progressivo.share_pct;
    const average = progressivo.pool_avg_pct ?? null;
    const scale = Math.max(progressivo.scale_max_pct ?? 40, share, average ?? 0, 1);
    rows.push({
      key: "progressivo",
      label: copy.progressivePass,
      detail:
        average == null ? `${Math.round(share)}%` : `${Math.round(share)}% · ${copy.average} ${Math.round(average)}%`,
      fill: average == null ? clampPct((share / scale) * 100) : clampPct(centeredTendencyPosition(share, average, scale)),
      averageFill: average == null ? null : 50,
      left: translateLabel(progressivo.axis_left || "Baixo", lang),
      right: translateLabel(progressivo.axis_right || "Alto", lang),
    });
  }

  const crossing = crossingReading(player, players);
  if (crossing) {
    rows.push({
      key: "cruzamentos",
      label: copy.crosses,
      detail: `${per90(crossing.volume)}/90 · ${copy.average} ${per90(crossing.average)}/90`,
      fill: clampPct(centeredTendencyPosition(crossing.volume, crossing.average, crossing.scale)),
      averageFill: 50,
      left: translateLabel("Baixo", lang),
      right: translateLabel("Alto", lang),
    });
  }

  return rows;
}

const TONE_COLORS: Record<string, string> = {
  defensivos: "#0f766e",
  aereo: "#0369a1",
  passes: "#1d4ed8",
  dribles: "#6d28d9",
  finais: "#a21caf",
  ofensividade: "#c2410c",
  finalizacao: "#be123c",
};

type ReportMetric = {
  name: string;
  context: string;
  value: string;
  percentile: number;
  tone: string;
};

type SectionScore = {
  title: string;
  tone: string;
  score: number;
};

/** Volume and efficiency rows read as "Block · Per 90"; sub-metric rows keep their own label. */
function reportMetrics(sections: ReportSection[], copy: ReportCopy): ReportMetric[] {
  const metrics: ReportMetric[] = [];
  for (const section of sections) {
    for (const block of section.blocks) {
      for (const line of block.lines) {
        if (line.percentile == null) continue;
        const generic = line.label === copy.per90 || line.label === copy.efficiency;
        metrics.push({
          name: generic && block.title ? block.title : line.label,
          context: generic && block.title ? line.label : block.title ?? section.title,
          value: line.value,
          percentile: line.percentile,
          tone: section.tone,
        });
      }
    }
  }
  return metrics;
}

function sectionScores(sections: ReportSection[]): SectionScore[] {
  return sections.flatMap((section) => {
    const values = section.blocks.flatMap((block) =>
      block.lines.map((line) => line.percentile).filter((value): value is number => value != null),
    );
    if (!values.length) return [];
    const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return [{ title: section.title, tone: section.tone, score }];
  });
}

function gradeTone(grade: string | null): string {
  const letter = grade?.[0];
  if (letter === "A") return "is-a";
  if (letter === "B") return "is-b";
  if (letter === "C") return "is-c";
  return "is-d";
}

function PercentileCell({ value, ribbon }: { value: number | null; ribbon?: number | null }) {
  return (
    <span className={`player-report-pct ${percentileTone(value)}`}>
      <span className="player-report-pct-track" aria-hidden="true">
        <span style={{ width: `${value ?? 0}%` }} />
        {ribbon != null ? (
          <i className="player-report-pct-ribbon" style={{ left: `${Math.max(0, Math.min(100, ribbon))}%` }} />
        ) : null}
      </span>
      <b>{value ?? "—"}</b>
    </span>
  );
}

function ReportBanner({ kicker, league, family }: { kicker: string; league: string; family: string }) {
  return (
    <header className="player-report-banner">
      <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
      <p className="player-report-kicker">{kicker}</p>
      <p className="player-report-league">
        {league}
        <span>{family}</span>
      </p>
    </header>
  );
}

function ReportColophon({ generated, page }: { generated: string; page: string }) {
  return (
    <p className="player-report-colophon">
      <span>SADA Scout</span>
      <span>{generated}</span>
      <span>{page}</span>
    </p>
  );
}

/** Section averages on a 0–100 radar. The dashed ring is the positional median. */
function SectionRadar({ scores }: { scores: SectionScore[] }) {
  const width = 340;
  const height = 270;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 92;
  const count = scores.length;
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const r = (radius * value) / 100;
    return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))] as const;
  };
  const ring = (value: number) =>
    scores.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  const shape = scores.map((item, index) => point(index, Math.max(4, item.score)).map((n) => n.toFixed(1)).join(",")).join(" ");

  return (
    <svg className="player-report-radar" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      {[25, 75, 100].map((value) => (
        <polygon key={value} points={ring(value)} className="radar-ring" />
      ))}
      <polygon points={ring(50)} className="radar-ring is-median" />
      {scores.map((item, index) => {
        const [x, y] = point(index, 100);
        return <line key={item.title} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
      })}
      <polygon points={shape} className="radar-shape" />
      {scores.map((item, index) => {
        const [x, y] = point(index, Math.max(4, item.score));
        return <circle key={item.title} cx={x} cy={y} r={3.4} fill={TONE_COLORS[item.tone] ?? "#0e7490"} className="radar-dot" />;
      })}
      {scores.map((item, index) => {
        const a = angle(index);
        const x = cx + (radius + 14) * Math.cos(a);
        const y = cy + (radius + 14) * Math.sin(a);
        const cos = Math.cos(a);
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        const dy = Math.sin(a) < -0.5 ? -4 : Math.sin(a) > 0.5 ? 10 : 0;
        return (
          <text key={item.title} x={x} y={y + dy} textAnchor={anchor} className="radar-label">
            <tspan>{item.title}</tspan>
            <tspan x={x} dy={11} className="radar-score" fill={TONE_COLORS[item.tone] ?? "#0e7490"}>
              {item.score}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

function MetricList({
  title,
  hint,
  metrics,
  empty,
  tone,
}: {
  title: string;
  hint: string;
  metrics: ReportMetric[];
  empty: string;
  tone: "is-strong" | "is-weak";
}) {
  return (
    <section className={`player-report-card player-report-metrics ${tone}`}>
      <header className="player-report-card-head">
        <h2>
          <i className={`fa-solid ${tone === "is-strong" ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}`} aria-hidden="true" />
          {title}
        </h2>
        <span>{hint}</span>
      </header>
      {metrics.length ? (
        <ol>
          {metrics.map((metric) => (
            <li key={`${metric.name}-${metric.context}`}>
              <span className="player-report-metric-name">
                <i style={{ background: TONE_COLORS[metric.tone] }} aria-hidden="true" />
                <span>
                  <strong>{metric.name}</strong>
                  <small>{metric.context}</small>
                </span>
              </span>
              <span className="player-report-metric-value">{metric.value}</span>
              <span className={`player-report-metric-bar ${percentileTone(metric.percentile)}`} aria-hidden="true">
                <span style={{ width: `${Math.max(2, metric.percentile)}%` }} />
                <i />
              </span>
              <b className={percentileTone(metric.percentile)}>{metric.percentile}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="player-report-empty">{empty}</p>
      )}
    </section>
  );
}

export function ReportSheet({
  player,
  family,
  players,
  lang,
  sheetUrl,
  pageOffset = 0,
  totalPages = 2,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  lang: ReportLang;
  sheetUrl: string;
  /** First player-report page number in the full export (e.g. after scatter pages). */
  pageOffset?: number;
  totalPages?: number;
}) {
  const league = useLeague();
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const sections = useMemo(() => {
    const observed = reportSections(player, lang);
    if (!isProjectionEligible(player)) return observed;
    const projection = realisticProjection(player, players);
    if (!projection) return observed;
    return applyProjection(observed, reportSections(projection.profile, lang));
  }, [player, players, lang]);
  const { columns, density } = useMemo(() => sectionColumns(sections), [sections]);
  const scores = useMemo(() => sectionScores(sections), [sections]);
  const metrics = useMemo(() => reportMetrics(sections, copy), [sections, copy]);
  const badges = useMemo(() => playerStatBadges(player), [player]);
  const toneByBadge = useMemo(() => {
    const tones = new Map<string, string>();
    for (const option of badgeCatalogForFamily(family)) tones.set(option.key, option.tone);
    return tones;
  }, [family]);
  const familyLabel = translateLabel(familyBySlug(family).label, lang);
  const tm = player.transfermarkt;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const contractDate = formatIso(tm?.contract_until, lang);
  const foot = formatFoot(player.foot);
  const profileLabel = translateLabel(reportProfileName(player), lang);
  const mix = reportMix(player, family, players);
  const poolSize = players.length || 1;
  const tendencies = reportTendencies(player, players, lang);
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );
  const highlightsHref = youtubeHighlightsHref(player);
  const xg = localizeValue(metricDisplay(player, "xG"), lang);
  const xa = localizeValue(metricDisplay(player, "xA"), lang);
  const leagueLabel = `${league.name} ${league.season}`;
  const leagueBanner = `${league.name} · ${league.season}`;

  const bio = [
    age != null ? copy.age(age) : null,
    player.height ? `${player.height} cm` : null,
    foot ? translateLabel(foot, lang) : null,
    translateNationality(player.nationality, lang),
  ].filter((item): item is string => Boolean(item));

  const ranked = [...metrics].sort((a, b) => b.percentile - a.percentile);
  const strengths = ranked.filter((metric) => metric.percentile >= 50).slice(0, 6);
  const weaknesses = [...ranked]
    .reverse()
    .filter((metric) => metric.percentile < 50)
    .slice(0, 6);
  const distribution = {
    above: metrics.filter((metric) => metric.percentile >= 70).length,
    below: metrics.filter((metric) => metric.percentile <= 30).length,
  };
  const distMid = metrics.length - distribution.above - distribution.below;
  const best = scores.length ? scores.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const worst = scores.length ? scores.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const aboveMedian = scores.filter((item) => item.score >= 50).length;
  const share = (n: number) => (metrics.length ? (n / metrics.length) * 100 : 0);

  const facts = [
    {
      key: "minutes",
      icon: "fa-stopwatch",
      label: copy.minutes,
      value: player.minutes.toLocaleString(locale),
      sub: player.minutes_pct != null ? copy.minutesShare(Math.round(player.minutes_pct)) : null,
    },
    { key: "goals", icon: "fa-futbol", label: copy.goals, value: player.goals.toLocaleString(locale), sub: `xG ${xg}` },
    {
      key: "assists",
      icon: "fa-shoe-prints",
      label: copy.assists,
      value: player.assists.toLocaleString(locale),
      sub: `xA ${xa}`,
    },
    {
      key: "market",
      icon: "fa-euro-sign",
      label: copy.marketValue,
      value: localizeMarketValue(tm?.market_value, lang),
      sub: tm?.on_loan_from ? copy.onLoan(tm.on_loan_from) : null,
    },
    {
      key: "contract",
      icon: "fa-file-signature",
      label: copy.contract,
      value: localizeContract(tm?.contract_remaining, lang),
      sub: contractDate ? copy.contractUntil(contractDate) : null,
    },
  ];

  return (
    <article className="player-report" lang={lang === "en" ? "en" : "pt-BR"}>
      <div className="player-report-page">
        <ReportBanner kicker={copy.kicker} league={leagueBanner} family={familyLabel} />

        <div className="player-report-body">
          <section className="player-report-identity">
            <PlayerPhoto
              src={tm?.photo}
              alt=""
              className="player-report-photo"
              fallback={<span className="player-report-photo player-report-photo-fallback">{playerInitials(player.name)}</span>}
            />
            <div className="player-report-who">
              <p className="player-report-eyebrow">{translateLabel(player.position, lang)}</p>
              <h1>{player.name}</h1>
              <p className="player-report-club">
                <ClubLogo club={player.club} size={16} />
                <span>{player.club}</span>
              </p>
              {bio.length ? (
                <ul className="player-report-bio">
                  {bio.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <p className="player-report-highlights">
                <a href={highlightsHref} target="_blank" rel="noopener noreferrer">
                  <i className="fa-brands fa-youtube" aria-hidden="true" /> {copy.highlights}
                </a>
              </p>
            </div>
            <div className="player-report-heat">
              <p className="player-report-label">{copy.heatmap}</p>
              {(player.heatmap?.points?.length ?? 0) > 0 ? (
                <PlayerHeatmap playerName={player.name} heatmap={player.heatmap} fixed={{ width: 196, height: 127 }} />
              ) : (
                <p className="player-report-heat-empty">{copy.heatmapEmpty}</p>
              )}
            </div>
          </section>

          <dl className="player-report-facts">
            {facts.map((fact) => (
              <div key={fact.key}>
                <dt>
                  <i className={`fa-solid ${fact.icon}`} aria-hidden="true" />
                  {fact.label}
                </dt>
                <dd>
                  {fact.value}
                  {fact.sub ? <small>{fact.sub}</small> : null}
                </dd>
              </div>
            ))}
          </dl>

          <section className="player-report-card player-report-profile" aria-label={copy.tacticalProfile}>
            <div className="player-report-profile-main">
              <p className="player-report-label">{copy.tacticalProfile}</p>
              <strong>{profileLabel}</strong>
              <span>
                {familyLabel} · {leagueLabel}
              </span>
            </div>
            {mix.length ? (
              <ul className="player-report-archetypes" style={{ gridTemplateColumns: `repeat(${Math.min(mix.length, 4)}, minmax(0, 1fr))` }}>
                {mix.slice(0, 4).map((item) => (
                  <li key={item.key} className={item.active ? "is-active" : undefined}>
                    <p className="player-report-archetype-name">
                      <i style={{ background: profileAccent(item.label) }} aria-hidden="true" />
                      <span>{translateLabel(item.label, lang)}</span>
                      {item.grade ? <b className={`player-report-grade ${gradeTone(item.grade)}`}>{item.grade}</b> : null}
                    </p>
                    <p className="player-report-archetype-share">
                      <strong>{Math.round(item.share)}%</strong>
                      {item.rank ? <small>{copy.rankOf(item.rank, poolSize)}</small> : null}
                    </p>
                    <span className="player-report-archetype-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(3, Math.round(item.share))}%`, background: profileAccent(item.label) }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="player-report-stats-wrap" aria-label={copy.stats}>
            <h2 className="player-report-heading">{copy.stats}</h2>
            <div
              className={`player-report-stats ${columns.length === 2 ? "is-wide" : ""} ${density}`.trim()}
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {columns.map((column, columnIndex) => (
                <div key={columnIndex} className="player-report-stats-col">
                  {column.map((section) => (
                    <section key={section.title} className={`player-report-section tone-${section.tone}`}>
                      <h3>{section.title}</h3>
                      <p className="player-report-row player-report-cols" aria-hidden="true">
                        <span />
                        <span>{copy.value}</span>
                        <span>{copy.percentile}</span>
                      </p>
                      {section.blocks.map((block, index) => (
                        <div key={`${section.title}-${block.title ?? index}`} className="player-report-block">
                          {block.title ? <p className="player-report-block-title">{block.title}</p> : null}
                          {block.lines.map((line, lineIndex) => (
                            <div
                              key={`${line.label}-${lineIndex}`}
                              className={`player-report-row player-report-line${line.sub ? " is-sub" : ""}`}
                            >
                              <span className="player-report-line-label">{line.label}</span>
                              <span className="player-report-value">
                                {line.value}
                                {line.projectionValue ? (
                                  <small className="player-report-projection">{line.projectionValue}</small>
                                ) : null}
                              </span>
                              <PercentileCell value={line.percentile} ribbon={line.projectionPercentile} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <footer className="player-report-foot">
            <div className="player-report-legend">
              <p className="player-report-label">{copy.legendTitle}</p>
              <ul>
                <li>
                  <span className="player-report-legend-key is-pct" aria-hidden="true" />
                  {copy.legendPercentile(copy.pool(familyLabel, leagueLabel))}
                </li>
                <li>
                  <span className="player-report-legend-key is-rate" aria-hidden="true">
                    90
                  </span>
                  {copy.legendRates}
                </li>
                <li>
                  <span className="player-report-legend-key is-badge" aria-hidden="true">
                    <i className="fa-solid fa-star" />
                  </span>
                  {copy.legendBadge}
                </li>
                {isProjectionEligible(player) ? (
                  <li>
                    <span className="player-report-legend-key is-projection" aria-hidden="true" />
                    {copy.legendProjection}
                  </li>
                ) : null}
              </ul>
            </div>
            <ReportColophon generated={generated} page={copy.page(1 + pageOffset, totalPages)} />
          </footer>
        </div>
      </div>

      <div className="player-report-page">
        <ReportBanner kicker={copy.summaryKicker} league={leagueBanner} family={familyLabel} />

        <div className="player-report-body">
          <section className="player-report-mini">
            <PlayerPhoto
              src={tm?.photo}
              alt=""
              className="player-report-mini-photo"
              fallback={<span className="player-report-mini-photo player-report-photo-fallback">{playerInitials(player.name)}</span>}
            />
            <div>
              <h1>{player.name}</h1>
              <p>
                <ClubLogo club={player.club} size={14} />
                <span>{player.club}</span>
                <span className="player-report-dot">·</span>
                <span>{translateLabel(player.position, lang)}</span>
                <span className="player-report-dot">·</span>
                <span>{profileLabel}</span>
              </p>
            </div>
          </section>

          {best && worst ? (
            <section className="player-report-card player-report-overview">
              <div>
                <p className="player-report-label">{copy.overview}</p>
                <p className="player-report-overview-text">
                  {copy.summaryLine(aboveMedian, scores.length, best.title, best.score, worst.title, worst.score)}
                </p>
              </div>
              <div className="player-report-dist">
                <div className="player-report-dist-bar" aria-hidden="true">
                  <span className="is-high" style={{ width: `${share(distribution.above)}%` }} />
                  <span className="is-mid" style={{ width: `${share(distMid)}%` }} />
                  <span className="is-low" style={{ width: `${share(distribution.below)}%` }} />
                </div>
                <ul>
                  <li className="is-high">{copy.distAbove(distribution.above)}</li>
                  <li className="is-mid">{copy.distMid(distMid)}</li>
                  <li className="is-low">{copy.distBelow(distribution.below)}</li>
                </ul>
              </div>
            </section>
          ) : null}

          {scores.length ? (
            <div className="player-report-charts">
              <section className="player-report-card">
                <header className="player-report-card-head">
                  <h2>{copy.radar}</h2>
                  <span>{copy.radarHint}</span>
                </header>
                <SectionRadar scores={scores} />
                <p className="player-report-chart-key">
                  <span className="is-player">{player.name}</span>
                  <span className="is-median">{copy.medianKey}</span>
                </p>
              </section>
              <section className="player-report-card">
                <header className="player-report-card-head">
                  <h2>{copy.blocks}</h2>
                  <span>{copy.blocksHint}</span>
                </header>
                <ul className="player-report-diverging">
                  {scores.map((item) => {
                    const delta = item.score - 50;
                    return (
                      <li key={item.title}>
                        <span className="player-report-diverging-name">
                          <i style={{ background: TONE_COLORS[item.tone] }} aria-hidden="true" />
                          {item.title}
                        </span>
                        <span className="player-report-diverging-track" aria-hidden="true">
                          <span
                            className={delta >= 0 ? "is-up" : "is-down"}
                            style={delta >= 0 ? { left: "50%", width: `${delta}%` } : { right: "50%", width: `${-delta}%` }}
                          />
                          <i />
                        </span>
                        <b className={percentileTone(item.score)}>{item.score}</b>
                      </li>
                    );
                  })}
                </ul>
                <p className="player-report-diverging-axis" aria-hidden="true">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </p>
              </section>
            </div>
          ) : null}

          <div className="player-report-split">
            <MetricList
              title={copy.strengths}
              hint={copy.strengthsHint}
              metrics={strengths}
              empty={copy.noStrengths}
              tone="is-strong"
            />
            <MetricList
              title={copy.weaknesses}
              hint={copy.weaknessesHint}
              metrics={weaknesses}
              empty={copy.noWeaknesses}
              tone="is-weak"
            />
          </div>

          {tendencies.length || badges.length ? (
            <div className="player-report-extras">
              {tendencies.length ? (
                <section className="player-report-tendencies" aria-label={copy.tendencies}>
                  <h2 className="player-report-heading">{copy.tendencies}</h2>
                  <div className="player-report-tendency-grid">
                    {tendencies.map((item) => (
                      <div key={item.key} className={`player-report-tendency${item.key === "curto" ? " is-length" : ""}`}>
                        <p className="player-report-label">{item.label}</p>
                        <strong>{item.detail}</strong>
                        <div className="player-report-tendency-bar">
                          <div className="player-report-tendency-track">
                            <span style={{ width: `${item.fill}%` }} />
                          </div>
                          {item.averageFill != null ? (
                            <i className="player-report-tendency-avg" style={{ left: `${item.averageFill}%` }} />
                          ) : null}
                        </div>
                        <div className="player-report-axis">
                          <span>{item.left}</span>
                          <span>{item.right}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {badges.length ? (
                <section className="player-report-badges" aria-label={copy.badges}>
                  <h2 className="player-report-heading">{copy.badges}</h2>
                  <ul>
                    {badges.map((badge) => (
                      <li key={badge.key} className={`tone-${toneByBadge.get(badge.key) ?? "passes"}`}>
                        <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
                        <span>{translateLabel(badge.label, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          <footer className="player-report-foot">
            <div className="player-report-links">
              {tm?.profile_url ? (
                <p>
                  <span className="player-report-label">{copy.transfermarkt}</span>
                  <a href={tm.profile_url}>{tm.profile_url.replace(/^https?:\/\/(www\.)?/, "")}</a>
                </p>
              ) : null}
              {sheetUrl ? (
                <p>
                  <span className="player-report-label">{copy.sheet}</span>
                  <a href={sheetUrl}>{sheetUrl.replace(/^https?:\/\//, "")}</a>
                </p>
              ) : null}
            </div>
            <ReportColophon generated={generated} page={copy.page(2 + pageOffset, totalPages)} />
          </footer>
        </div>
      </div>
    </article>
  );
}

export function PlayerReportButton({
  player,
  family,
  players,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
}) {
  const { beginLoad, endLoad } = useLoading();
  const [mounted, setMounted] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [lang, setLang] = useState<ReportLang>("pt");
  const [menuOpen, setMenuOpen] = useState(false);
  const [printRequest, setPrintRequest] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setSheetUrl(window.location.href);
  }, [player.player_id]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Print only after the sheet re-rendered in the chosen language.
  useEffect(() => {
    if (!printRequest) return;
    beginLoad();
    const previousTitle = document.title;
    document.title = lang === "en" ? `${player.name} - SADA Scout Report` : `${player.name} - Relatório SADA Scout`;
    document.body.classList.add("exporting-player-report");
    const cleanup = () => {
      document.body.classList.remove("exporting-player-report");
      document.title = previousTitle;
      endLoad();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => endLoad(), 400);
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printRequest]);

  function exportPdf(next: ReportLang) {
    setMenuOpen(false);
    setLang(next);
    setPrintRequest((value) => value + 1);
  }

  const copy = REPORT_COPY[lang];

  return (
    <>
      <div className="shadow-add-menu player-report-menu" ref={rootRef}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${menuOpen ? " active" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={copy.pdfTitle}
        >
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> PDF
        </button>
        {menuOpen ? (
          <div className="shadow-add-dropdown" role="menu">
            <button type="button" role="menuitem" data-report-lang="pt" onClick={() => exportPdf("pt")}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" />
              <span>
                <strong>{REPORT_COPY.pt.portuguese}</strong>
                <em>Relatório em português</em>
              </span>
            </button>
            <button type="button" role="menuitem" data-report-lang="en" onClick={() => exportPdf("en")}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" />
              <span>
                <strong>{REPORT_COPY.en.english}</strong>
                <em>Report in English</em>
              </span>
            </button>
          </div>
        ) : null}
      </div>
      {mounted
        ? createPortal(
            <ReportSheet player={player} family={family} players={players} lang={lang} sheetUrl={sheetUrl} />,
            document.body,
          )
        : null}
    </>
  );
}

function metricDisplay(player: PlayerProfile, label: string): string {
  for (const item of flattenAspects(player)) {
    const value = item.sub_metrics?.find((row) => row.label === label)?.display_value?.trim();
    if (value) return value;
  }
  return "—";
}
