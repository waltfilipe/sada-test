"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { useLeague } from "@/components/LeagueProvider";
import { findAspect, flattenAspects, visibleSubMetrics } from "@/lib/aspectLookup";
import { crossingReading, crossingVolumePer90, formatPer90 } from "@/lib/crossingTendency";
import { statRowLabel } from "@/lib/seasonTotals";
import { centeredTendencyPosition } from "@/lib/tendencyScale";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { formatFoot } from "@/lib/feet";
import { getLeague } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { activeProfileKeys, archetypeGrade, archetypeRank, gradeApplies, profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { isProjectionEligible, realisticProjection } from "@/lib/minuteProjection";
import { playerInitials } from "@/lib/scoutTheme";
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
import { buildInsights, type Insight, type InsightDir } from "@/lib/reportInsights";
import { PlayerHeatmap } from "./PlayerHeatmap";
import type { AspectItem, PlayerHeatmapData, PlayerPhysicalRun, PlayerProfile, PositionFamily, XProg } from "@/lib/types";

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
  const subs = visibleSubMetrics(item);
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

/** Profile name as the site classifies it (same macro label as ClusterTag). */
function reportProfileName(player: PlayerProfile): string {
  return player.cluster?.archetype_label ?? player.profile;
}

type BioItem = { icon: string; label: string; value: string };

function reportBio(player: PlayerProfile, lang: ReportLang): BioItem[] {
  const copy = REPORT_COPY[lang];
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const foot = formatFoot(player.foot);
  const nationality = translateNationality(player.nationality, lang);
  const items: (BioItem | null)[] = [
    age != null ? { icon: "fa-user", label: copy.bioAge, value: copy.bioYears(age) } : null,
    player.height ? { icon: "fa-arrows-up-down", label: copy.bioHeight, value: `${player.height} cm` } : null,
    foot ? { icon: "fa-shoe-prints", label: copy.bioFoot, value: translateLabel(foot, lang) } : null,
    nationality ? { icon: "fa-flag", label: copy.bioNationality, value: nationality } : null,
  ];
  return items.filter((item): item is BioItem => Boolean(item));
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
        grade: gradeApplies(row.share, active.has(row.key)) ? archetypeGrade(player, row.label, rank, pool.length) : null,
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

type RunMetricKey =
  | "kilometers_p90"
  | "top_speed"
  | "sprints_p90"
  | "running_km_p90"
  | "high_speed_km_p90"
  | "sprinting_km_p90";

const RUN_METRICS: { key: RunMetricKey; pt: string; en: string; unit: string; digits: number }[] = [
  { key: "kilometers_p90", pt: "Distância total", en: "Distance", unit: "km/90", digits: 2 },
  { key: "top_speed", pt: "Velocidade máxima", en: "Top speed", unit: "km/h", digits: 1 },
  { key: "sprints_p90", pt: "Sprints", en: "Sprints", unit: "/90", digits: 1 },
  { key: "running_km_p90", pt: "Corrida", en: "Running", unit: "km/90", digits: 2 },
  { key: "high_speed_km_p90", pt: "Alta intensidade", en: "High intensity", unit: "km/90", digits: 2 },
  { key: "sprinting_km_p90", pt: "Sprint (distância)", en: "Sprint distance", unit: "km/90", digits: 2 },
];

function reportRunRows(run: PlayerPhysicalRun, lang: ReportLang) {
  return RUN_METRICS.map((metric) => {
    const value = run[metric.key];
    return {
      key: metric.key,
      label: lang === "en" ? metric.en : metric.pt,
      value: `${localizeValue(value.toFixed(metric.digits).replace(".", ","), lang)} ${metric.unit}`,
      pct: run.percentiles?.[metric.key] ?? null,
    };
  });
}

/** Média ponderada por minutos de GPS entre temporadas (resumo multi-ano). */
function averagePhysicalRun(rows: SummarySheetRow[]): PlayerPhysicalRun | null {
  const entries = rows
    .map((row) => row.player.physical_run)
    .filter((run): run is PlayerPhysicalRun => Boolean(run?.minutes));
  if (!entries.length) return null;
  const weightSum = entries.reduce((sum, run) => sum + run.minutes, 0) || 1;
  const avg = (key: RunMetricKey) =>
    entries.reduce((sum, run) => sum + (run[key] ?? 0) * run.minutes, 0) / weightSum;
  const avgPct = (key: RunMetricKey) => {
    const parts = entries
      .map((run) => ({ value: run.percentiles?.[key], weight: run.minutes }))
      .filter((part): part is { value: number; weight: number } => part.value != null);
    if (!parts.length) return undefined;
    const w = parts.reduce((sum, part) => sum + part.weight, 0) || 1;
    return parts.reduce((sum, part) => sum + part.value * part.weight, 0) / w;
  };
  const first = entries[0];
  const percentiles = Object.fromEntries(
    RUN_METRICS.map((metric) => [metric.key, avgPct(metric.key)]).filter(([, v]) => v != null),
  ) as PlayerPhysicalRun["percentiles"];
  return {
    ...first,
    matches: entries.reduce((sum, run) => sum + run.matches, 0),
    minutes: Math.round(weightSum),
    kilometers_p90: avg("kilometers_p90"),
    top_speed: avg("top_speed"),
    sprints_p90: avg("sprints_p90"),
    running_km_p90: avg("running_km_p90"),
    high_speed_km_p90: avg("high_speed_km_p90"),
    sprinting_km_p90: avg("sprinting_km_p90"),
    percentiles,
    ranks: {},
  };
}

/** Brighter block colors for the dark on-screen radar. */
const SCREEN_TONE_COLORS: Record<string, string> = {
  defensivos: "#2dd4bf",
  aereo: "#38bdf8",
  passes: "#60a5fa",
  dribles: "#a78bfa",
  finais: "#e879f9",
  ofensividade: "#fb923c",
  finalizacao: "#fb7185",
};

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

export type SectionScore = {
  title: string;
  tone: string;
  score: number;
  /** Overrides the tone color (e.g. profile accent). */
  color?: string;
  /** Text under the axis label; defaults to the score. */
  display?: string;
};

/** Título leva a unidade (/90 ou %); o subtítulo diz se é volume ou eficiência (Index para o índice de eficiência). */
function reportMetrics(sections: ReportSection[], copy: ReportCopy, lang: ReportLang): ReportMetric[] {
  const metrics: ReportMetric[] = [];
  const indexLabel = translateLabel("Índice de Eficiência", lang);
  for (const section of sections) {
    for (const block of section.blocks) {
      for (const line of block.lines) {
        if (line.percentile == null) continue;
        const isVolume = line.label === copy.per90;
        const isEfficiency = line.label === copy.efficiency;
        const generic = (isVolume || isEfficiency) && Boolean(block.title);
        metrics.push({
          name: generic ? `${block.title} ${isVolume ? "/90" : "%"}` : line.label,
          context: generic ? (isVolume ? copy.volume : copy.efficiency) : line.label === indexLabel ? copy.indexTag : block.title ?? section.title,
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

function ReportBanner({
  kicker,
  league,
  family,
  season,
  seasonTag,
  seasonSub,
}: {
  kicker: string;
  league: string;
  family: string;
  /** Big label identifying what is evaluated on this page (e.g. "2024" or "3 temporadas"). */
  season: string;
  seasonTag: string;
  seasonSub?: string;
}) {
  return (
    <header className="player-report-banner">
      <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
      <p className="player-report-kicker">{kicker}</p>
      <p className="player-report-league">
        {league}
        <span>{family}</span>
      </p>
      <p className="player-report-season">
        <b>{season}</b>
        <span>
          {seasonTag}
          {seasonSub ? ` · ${seasonSub}` : ""}
        </span>
      </p>
    </header>
  );
}

function ReportColophon({ generated, page }: { generated: string; page: string }) {
  return (
    <p className="player-report-colophon">
      <span>SADA | Scout</span>
      <span>{generated}</span>
      <span>{page}</span>
    </p>
  );
}

/** Section averages on a 0–100 radar. The dashed ring is the positional median. */
/** Breaks long block names in two lines for the narrow on-screen card. */
function radarLabelLines(title: string, wrap: boolean): string[] {
  if (!wrap || title.length <= 10 || !title.includes(" ")) return [title];
  const words = title.split(" ");
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

export function SectionRadar({
  scores,
  variant = "print",
  shape: shapeStyle = "polygon",
  activeTitle = null,
  onHoverTitle,
}: {
  scores: SectionScore[];
  variant?: "print" | "screen";
  /** "sectors" draws one wedge per axis (on-screen profile radar). */
  shape?: "polygon" | "sectors";
  /** Axis currently highlighted (e.g. hovered in the linked list); the others are dimmed. */
  activeTitle?: string | null;
  onHoverTitle?: (title: string | null) => void;
}) {
  const screen = variant === "screen";
  const sectors = shapeStyle === "sectors";
  const width = screen ? 300 : 340;
  const height = screen ? 290 : 270;
  const cx = width / 2;
  const cy = height / 2;
  const radius = screen ? 90 : 92;
  const count = scores.length;
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const r = (radius * value) / 100;
    return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))] as const;
  };
  const ring = (value: number) =>
    scores.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  const shape = scores.map((item, index) => point(index, Math.max(4, item.score)).map((n) => n.toFixed(1)).join(",")).join(" ");
  const colorOf = (item: SectionScore) =>
    item.color ?? (screen ? SCREEN_TONE_COLORS[item.tone] : TONE_COLORS[item.tone]) ?? "#0e7490";
  /** Wedge from the center spanning this axis' share of the circle. */
  const sector = (index: number, value: number) => {
    const half = Math.PI / count - 0.06;
    const r = (radius * value) / 100;
    const a0 = angle(index) - half;
    const a1 = angle(index) + half;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = half * 2 > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
  };

  return (
    <svg className={`player-report-radar${sectors ? " is-sectors" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      {sectors ? (
        <>
          {[25, 75, 100].map((value) => (
            <circle key={value} cx={cx} cy={cy} r={(radius * value) / 100} className="radar-ring" />
          ))}
          <circle cx={cx} cy={cy} r={radius / 2} className="radar-ring is-median" />
          {scores.map((item, index) => (
            <path
              key={`bg-${item.title}`}
              d={sector(index, 100)}
              fill={colorOf(item)}
              className={`radar-sector-bg${activeTitle === item.title ? " is-active" : ""}`}
              onMouseEnter={onHoverTitle ? () => onHoverTitle(item.title) : undefined}
              onMouseLeave={onHoverTitle ? () => onHoverTitle(null) : undefined}
            />
          ))}
          {scores.map((item, index) => (
            <path
              key={item.title}
              d={sector(index, Math.max(6, item.score))}
              fill={colorOf(item)}
              stroke={colorOf(item)}
              strokeWidth={activeTitle === item.title ? 2.2 : 1.5}
              className={`radar-sector${activeTitle === item.title ? " is-active" : activeTitle ? " is-dim" : ""}`}
              pointerEvents="none"
            />
          ))}
          <circle cx={cx} cy={cy} r={3} className="radar-center" />
        </>
      ) : (
        <>
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
            return <circle key={item.title} cx={x} cy={y} r={3.4} fill={colorOf(item)} className="radar-dot" />;
          })}
        </>
      )}
      {scores.map((item, index) => {
        const a = angle(index);
        const x = cx + (radius + 14) * Math.cos(a);
        const y = cy + (radius + 14) * Math.sin(a);
        const cos = Math.cos(a);
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        const lines = radarLabelLines(item.title, screen);
        const lineHeight = screen ? 13 : 11;
        const lift = (lines.length - 1) * lineHeight;
        const dy = Math.sin(a) < -0.5 ? -4 - lift : Math.sin(a) > 0.5 ? 10 : -lift / 2;
        return (
          <text
            key={item.title}
            x={x}
            y={y + dy}
            textAnchor={anchor}
            className={`radar-label${activeTitle && activeTitle !== item.title ? " is-dim" : ""}`}
          >
            {lines.map((line, lineIndex) => (
              <tspan key={line} x={x} dy={lineIndex ? lineHeight : 0}>
                {line}
              </tspan>
            ))}
            <tspan x={x} dy={lineHeight + (screen ? 1 : 0)} className="radar-score" fill={colorOf(item)}>
              {item.display ?? item.score}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/** Scores (0–100, média dos percentis por bloco) do radar "Perfil estatístico". */
export function statProfileScores(player: PlayerProfile): SectionScore[] {
  return sectionScores(reportSections(player, "pt"));
}

/** Screen version of the PDF "Perfil estatístico" radar for the position page. */
export function StatProfileRadarCard({ player, bare = false }: { player: PlayerProfile; bare?: boolean }) {
  const copy: ReportCopy = REPORT_COPY.pt;
  const scores = useMemo(() => sectionScores(reportSections(player, "pt")), [player]);
  if (!scores.length) return null;
  return (
    <div className={bare ? "stat-radar-card stat-radar-bare" : "player-card profile-perfil-card stat-radar-card"}>
      {bare ? null : (
        <div className="profile-card-head">
          <span className="section-label">{copy.radar}</span>
        </div>
      )}
      <div className="stat-radar-figure">
        <SectionRadar scores={scores} variant="screen" />
      </div>
      <p className="player-report-chart-key">
        <span className="is-player">{player.name}</span>
        <span className="is-median">{copy.medianKey}</span>
      </p>
      <p className="stat-radar-hint">{copy.radarHint}</p>
    </div>
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

function fmtNum(value: number, digits: number, lang: ReportLang): string {
  return value.toLocaleString(reportLocale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtSigned(value: number, digits: number, lang: ReportLang): string {
  return `${value >= 0 ? "+" : "−"}${fmtNum(Math.abs(value), digits, lang)}`;
}

type XProgView = {
  actual: number;
  expected: number;
  delta: number;
  dir: InsightDir;
  accActual: number | null;
  accExpected: number | null;
  accDelta: number | null;
  accDir: InsightDir | null;
  lowSample: boolean;
};

/** Mesmos limiares do popup "Tendências e xProg". */
function xprogDir(delta: number, sd: number): InsightDir {
  if (Math.abs(delta) < Math.max(0.25, sd * 0.35)) return "even";
  return delta > 0 ? "up" : "down";
}

function accDir(delta: number): InsightDir {
  if (Math.abs(delta) < 3) return "even";
  return delta > 0 ? "up" : "down";
}

/** xProg ponderado por minutos (uma temporada = o próprio valor). */
function xprogView(entries: { x: XProg | null | undefined; weight: number }[]): XProgView | null {
  const rows = entries.filter((entry): entry is { x: XProg; weight: number } => Boolean(entry.x));
  if (!rows.length) return null;
  const mean = (pick: (x: XProg) => number | undefined) =>
    weightedMean(rows.flatMap((row) => (pick(row.x) != null ? [{ value: pick(row.x) as number, weight: row.weight || 1 }] : [])));
  const actual = mean((x) => x.actual) ?? 0;
  const expected = mean((x) => x.expected) ?? 0;
  const sd = mean((x) => x.sd) ?? 0;
  const accActual = mean((x) => x.acc_actual);
  const accExpected = mean((x) => x.acc_expected);
  const accDelta = accActual != null && accExpected != null ? accActual - accExpected : null;
  return {
    actual,
    expected,
    delta: actual - expected,
    dir: xprogDir(actual - expected, sd),
    accActual,
    accExpected,
    accDelta,
    accDir: accDelta != null ? accDir(accDelta) : null,
    lowSample: rows.every((row) => row.x.low_sample),
  };
}

function TendencyBar({ item }: { item: ReportTendency }) {
  return (
    <div className={`player-report-tendency${item.key === "curto" ? " is-length" : ""}`}>
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
  );
}

function XProgRow({
  label,
  actual,
  expected,
  unit,
  delta,
  deltaUnit,
  dir,
  scale,
  copy,
}: {
  label: string;
  actual: string;
  expected: string;
  unit: string;
  delta: string;
  deltaUnit: string;
  dir: InsightDir;
  scale: { actual: number; expected: number };
  copy: ReportCopy;
}) {
  const verdict = dir === "up" ? copy.xprogUp : dir === "down" ? copy.xprogDown : copy.xprogEven;
  return (
    <div className={`player-report-xp-row is-${dir}`}>
      <p className="player-report-xp-head">
        <span>{label}</span>
        <span className={`player-report-chip is-${dir}`}>
          {dir === "up" ? "▲ " : dir === "down" ? "▼ " : ""}
          {delta}
          {deltaUnit} · {verdict}
        </span>
      </p>
      <div className="player-report-xp-bars">
        <span className="player-report-xp-key">{copy.real}</span>
        <span className="player-report-xp-track is-real">
          <i style={{ width: `${clampPct(scale.actual)}%` }} />
        </span>
        <b>
          {actual}
          <small>{unit}</small>
        </b>
        <span className="player-report-xp-key">{copy.expected}</span>
        <span className="player-report-xp-track is-exp">
          <i style={{ width: `${clampPct(scale.expected)}%` }} />
        </span>
        <b className="is-exp">
          {expected}
          <small>{unit}</small>
        </b>
      </div>
    </div>
  );
}

function XProgCard({ xprog, copy, lang }: { xprog: XProgView | null; copy: ReportCopy; lang: ReportLang }) {
  const top = xprog ? Math.max(xprog.actual, xprog.expected) * 1.18 || 1 : 1;
  return (
    <section className="player-report-card player-report-xp">
      <header className="player-report-card-head">
        <h2>{copy.xprogTitle}</h2>
        <span>{copy.xprogHint}</span>
      </header>
      {xprog ? (
        <>
          <XProgRow
            label={copy.xprogProg}
            actual={fmtNum(xprog.actual, 1, lang)}
            expected={fmtNum(xprog.expected, 1, lang)}
            unit="/90"
            delta={fmtSigned(xprog.delta, 1, lang)}
            deltaUnit=""
            dir={xprog.dir}
            scale={{ actual: (xprog.actual / top) * 100, expected: (xprog.expected / top) * 100 }}
            copy={copy}
          />
          {xprog.accActual != null && xprog.accExpected != null && xprog.accDelta != null && xprog.accDir ? (
            <XProgRow
              label={copy.xprogAcc}
              actual={fmtNum(xprog.accActual, 0, lang)}
              expected={fmtNum(xprog.accExpected, 0, lang)}
              unit="%"
              delta={fmtSigned(xprog.accDelta, 0, lang)}
              deltaUnit=" p.p."
              dir={xprog.accDir}
              scale={{ actual: xprog.accActual, expected: xprog.accExpected }}
              copy={copy}
            />
          ) : null}
          {xprog.lowSample ? <p className="player-report-xp-note">{copy.xprogLowSample}</p> : null}
        </>
      ) : (
        <p className="player-report-empty">{copy.xprogEmpty}</p>
      )}
    </section>
  );
}

/** "Tendências e xProg": tendências + campinho à esquerda, xProgressão à direita. */
function TendencyXProgSection({
  tendencies,
  xprog,
  copy,
  lang,
  hint,
}: {
  tendencies: ReportTendency[];
  xprog: XProgView | null;
  copy: ReportCopy;
  lang: ReportLang;
  hint?: string;
}) {
  if (!tendencies.length && !xprog) return null;
  const length = tendencies.find((item) => item.key === "curto");
  const others = tendencies.filter((item) => item.key !== "curto");
  return (
    <section className="player-report-txp" aria-label={copy.tendencies}>
      <h2 className="player-report-heading">
        {copy.tendencies}
        {hint ? <span className="player-report-tend-hint">{hint}</span> : null}
      </h2>
      <div className="player-report-txp-grid">
        <div className="player-report-txp-col">
          {length ? <TendencyBar item={length} /> : null}
          {others.map((item) => (
            <TendencyBar key={item.key} item={item} />
          ))}
        </div>
        <XProgCard xprog={xprog} copy={copy} lang={lang} />
      </div>
    </section>
  );
}

function GpsCard({ run, title, meta, lang }: { run: PlayerPhysicalRun; title: string; meta: string; lang: ReportLang }) {
  return (
    <section className="player-report-card player-report-gps" aria-label={title}>
      <header className="player-report-card-head">
        <h2>{title}</h2>
        <span>{meta}</span>
      </header>
      <ul className="player-report-run-grid is-compact">
        {reportRunRows(run, lang).map((metric) => (
          <li key={metric.key}>
            <span className="player-report-run-label">{metric.label}</span>
            <strong className="player-report-run-value">{metric.value}</strong>
            {metric.pct != null ? (
              <span className={`player-report-run-bar ${percentileTone(Math.round(metric.pct))}`} aria-hidden="true">
                <i style={{ width: `${clampPct(metric.pct)}%` }} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RadarCard({
  title,
  hint,
  scores,
  sectors,
  legend,
}: {
  title: string;
  hint: string;
  scores: SectionScore[];
  sectors?: boolean;
  legend?: { player: string; median: string };
}) {
  return (
    <section className="player-report-card player-report-radar-card">
      <header className="player-report-card-head">
        <h2>{title}</h2>
        <span>{hint}</span>
      </header>
      <SectionRadar scores={scores} shape={sectors ? "sectors" : "polygon"} />
      {legend ? (
        <p className="player-report-chart-key">
          <span className="is-player">{legend.player}</span>
          <span className="is-median">{legend.median}</span>
        </p>
      ) : null}
    </section>
  );
}

function profileScoresOf(rows: { label: string; share: number; tone?: string }[]): SectionScore[] {
  return rows.map((row) => ({
    title: row.label,
    tone: row.tone ?? "passes",
    score: Math.round(row.share),
    color: profileAccent(row.label),
    display: `${Math.round(row.share)}%`,
  }));
}

function BadgeChips({ badges, toneOf, lang }: { badges: ReturnType<typeof playerStatBadges>; toneOf: (key: string) => string; lang: ReportLang }) {
  return (
    <ul className="player-report-badges-inline">
      {badges.map((badge) => (
        <li key={badge.key} className={`tone-${toneOf(badge.key)}`}>
          <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
          <span>{translateLabel(badge.label, lang)}</span>
        </li>
      ))}
    </ul>
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
  archiveSeasonLabel,
  leagueName,
  poolName,
  skipProjection = false,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  lang: ReportLang;
  sheetUrl: string;
  /** First player-report page number in the full export (e.g. after scatter pages). */
  pageOffset?: number;
  totalPages?: number;
  archiveSeasonLabel?: string;
  /** League of the evaluated season (archive sheets may come from another division). */
  leagueName?: string;
  /** Pool que gera os percentis quando difere da competicao (ex.: Paulista A2 -> Estaduais Nv2). */
  poolName?: string;
  skipProjection?: boolean;
}) {
  const league = useLeague();
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const sections = useMemo(() => {
    const observed = reportSections(player, lang);
    if (skipProjection || !isProjectionEligible(player)) return observed;
    const projection = realisticProjection(player, players);
    if (!projection) return observed;
    return applyProjection(observed, reportSections(projection.profile, lang));
  }, [player, players, lang, skipProjection]);
  const { columns, density } = useMemo(() => sectionColumns(sections), [sections]);
  const scores = useMemo(() => sectionScores(sections), [sections]);
  const metrics = useMemo(() => reportMetrics(sections, copy, lang), [sections, copy, lang]);
  const badges = useMemo(() => playerStatBadges(player), [player]);
  const toneByBadge = useMemo(() => {
    const tones = new Map<string, string>();
    for (const option of badgeCatalogForFamily(family)) tones.set(option.key, option.tone);
    return tones;
  }, [family]);
  const familyLabel = translateLabel(familyBySlug(family).label, lang);
  const tm = player.transfermarkt;
  const contractDate = formatIso(tm?.contract_until, lang);
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
  const sheetLeague = leagueName ?? league.name;
  const sheetSeason = archiveSeasonLabel ?? league.season;
  const leagueLabel = `${sheetLeague} ${sheetSeason}`;
  const poolLabel = `${poolName ?? sheetLeague} ${sheetSeason}`;
  const leagueBanner = sheetLeague;

  const bio = reportBio(player, lang);

  const run = player.physical_run;
  const errosLabel = translateLabel("Erros Totais", lang);
  const ranked = [...metrics].sort((a, b) => b.percentile - a.percentile);
  // Erros Totais pode aparecer em pontos a desenvolver, nunca em pontos fortes.
  const strengths = ranked
    .filter((metric) => metric.percentile >= 50 && metric.name !== errosLabel)
    .slice(0, 6);
  const weaknesses = [...ranked]
    .reverse()
    .filter((metric) => metric.percentile < 50)
    .slice(0, 6);
  const xprog = xprogView([{ x: player.xprog, weight: 1 }]);
  const profileScores = profileScoresOf(sortedProfileShareRows(player).map((row) => ({ ...row, label: translateLabel(row.label, lang) })));

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
        <ReportBanner
          kicker={copy.kicker}
          league={leagueBanner}
          family={familyLabel}
          season={sheetSeason}
          seasonTag={archiveSeasonLabel ? copy.seasonArchive : copy.seasonTag}
          seasonSub={archiveSeasonLabel ? copy.seasonArchiveSub : undefined}
        />

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
                <ClubLogo club={player.display_club ?? player.club} size={16} />
                <span>{player.display_club ?? player.club}</span>
              </p>
              {bio.length ? (
                <ul className="player-report-bio">
                  {bio.map((item) => (
                    <li key={item.label}>
                      <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                      <span className="player-report-bio-text">
                        <span className="player-report-bio-label">{item.label}</span>
                        <strong>{item.value}</strong>
                      </span>
                    </li>
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
                  {copy.legendPercentile(copy.pool(familyLabel, poolLabel))}
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
        <ReportBanner
          kicker={copy.summaryKicker}
          league={leagueBanner}
          family={familyLabel}
          season={sheetSeason}
          seasonTag={archiveSeasonLabel ? copy.seasonArchive : copy.seasonTag}
          seasonSub={archiveSeasonLabel ? copy.seasonArchiveSub : undefined}
        />

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
                <ClubLogo club={player.display_club ?? player.club} size={14} />
                <span>{player.display_club ?? player.club}</span>
                <span className="player-report-dot">·</span>
                <span>{translateLabel(player.position, lang)}</span>
                <span className="player-report-dot">·</span>
                <span>{profileLabel}</span>
              </p>
            </div>
            {badges.length ? (
              <div className="player-report-mini-badges">
                <p className="player-report-label">{copy.badges}</p>
                <BadgeChips badges={badges} toneOf={(key) => toneByBadge.get(key) ?? "passes"} lang={lang} />
              </div>
            ) : null}
          </section>

          {scores.length ? (
            <div className="player-report-charts is-twin">
              {profileScores.length >= 3 ? (
                <RadarCard title={copy.profileRadar} hint={copy.profileRadarHint} scores={profileScores} sectors />
              ) : null}
              <RadarCard
                title={copy.radar}
                hint={copy.radarHint}
                scores={scores}
                legend={{ player: player.name, median: copy.medianKey }}
              />
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

          <TendencyXProgSection tendencies={tendencies} xprog={xprog} copy={copy} lang={lang} />

          {run ? (
            <GpsCard run={run} title={copy.gpsTitle} meta={copy.gpsMeta(run.competition ?? "", run.matches, run.minutes)} lang={lang} />
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

type SummarySheetRow = {
  player: PlayerProfile;
  /** Season year shown in the sheet (e.g. "2024"). */
  year: string;
  leagueName: string;
  /** Pool dos percentis quando difere da competicao exibida. */
  poolName?: string;
};

function weightedMean(values: { value: number; weight: number }[]): number | null {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / total;
}

type SummaryDetail = {
  row: SummarySheetRow;
  weight: number;
};

/** One heatmap per picked season merged into a minute-weighted "average" map. */
function mergedSummaryHeatmap(rows: SummarySheetRow[]): PlayerHeatmapData | null {
  const mapped = rows.map((row) => ({
    minutes: Math.max(0, row.player.minutes ?? 0),
    points: row.player.heatmap?.points ?? [],
  }));
  const total = mapped.reduce((sum, item) => sum + (item.points.length ? item.minutes : 0), 0);
  if (!total) return null;
  const points: { x: number; y: number; w: number }[] = [];
  for (const item of mapped) {
    if (!item.points.length) continue;
    const share = item.minutes / total;
    for (const pt of item.points) {
      points.push({ x: pt.x, y: pt.y, w: (pt.w ?? 1) * share });
    }
  }
  return points.length ? { points } : null;
}

const SUMMARY_CROSSING_FAMILIES = new Set<PositionFamily>(["laterais", "meio-campistas", "extremos"]);

/** Minutes-weighted pass tendencies across the picked seasons (short↔long and progressive share). */
function summaryTendencies(detail: SummaryDetail[], lang: ReportLang, family: PositionFamily): ReportTendency[] {
  const copy = REPORT_COPY[lang];
  const per90 = (value: number) => localizeValue(formatPer90(value), lang);
  const rows: ReportTendency[] = [];

  const aggregate = (barKey: "pass_tendency") => {
    const entries = detail.map((item) => ({
      weight: item.weight,
      aspect: (item.row.player.aspects.perfil_construcao ?? []).find((aspect) => aspect.bar_key === barKey),
    }));
    const share = weightedMean(
      entries.flatMap((entry) =>
        entry.aspect?.share_pct != null ? [{ value: entry.aspect.share_pct, weight: entry.weight }] : [],
      ),
    );
    const average = weightedMean(
      entries.flatMap((entry) =>
        entry.aspect?.pool_avg_pct != null ? [{ value: entry.aspect.pool_avg_pct, weight: entry.weight }] : [],
      ),
    );
    const scale = Math.max(
      ...entries.map((entry) => entry.aspect?.scale_max_pct ?? 0),
      share ?? 0,
      average ?? 0,
      1,
    );
    const left = entries.find((entry) => entry.aspect?.axis_left)?.aspect?.axis_left ?? null;
    const right = entries.find((entry) => entry.aspect?.axis_right)?.aspect?.axis_right ?? null;
    return { share, average, scale, left, right };
  };

  const longo = aggregate("pass_tendency");
  if (longo.share != null) {
    const gap = longo.average == null ? null : longo.share - longo.average;
    const verdict = gap == null ? null : gap >= 2 ? copy.longer : gap <= -2 ? copy.shorter : copy.onAverage;
    const bits = [
      verdict,
      copy.longShare(Math.round(longo.share)),
      longo.average == null ? null : `${copy.average} ${Math.round(longo.average)}%`,
    ].filter((bit): bit is string => Boolean(bit));
    rows.push({
      key: "curto",
      label: copy.shortPass,
      detail: bits.join(" · "),
      fill:
        longo.average == null
          ? clampPct((longo.share / longo.scale) * 100)
          : clampPct(centeredTendencyPosition(longo.share, longo.average, longo.scale)),
      averageFill: longo.average == null ? null : 50,
      left: translateLabel(longo.left || "Curto", lang),
      right: translateLabel(longo.right || "Longo", lang),
    });
  }

  // Média de tendência a cruzamentos entre as temporadas (lat/mc/extremos).
  if (SUMMARY_CROSSING_FAMILIES.has(family)) {
    const volumes = detail
      .map((item) => ({ value: crossingVolumePer90(item.row.player), weight: item.weight }))
      .filter((entry): entry is { value: number; weight: number } => entry.value != null);
    const volume = weightedMean(volumes);
    if (volume != null) {
      const peak = Math.max(volume, ...volumes.map((entry) => entry.value), 1);
      rows.push({
        key: "cruzamentos",
        label: copy.crosses,
        detail: `${per90(volume)}/90`,
        fill: clampPct((volume / (peak * 1.15)) * 100),
        averageFill: null,
        left: translateLabel("Baixo", lang),
        right: translateLabel("Alto", lang),
      });
    }
  }

  return rows;
}

type SummaryModel = ReturnType<typeof buildSummaryModel>;

/** Dados compartilhados pelo resumo multi-temporada e pela página do analista. */
function buildSummaryModel(rows: SummarySheetRow[], lang: ReportLang) {
  const copy: ReportCopy = REPORT_COPY[lang];
  const ordered = [...rows].sort((a, b) => a.year.localeCompare(b.year));
  const minutes = ordered.map((row) => Math.max(0, row.player.minutes ?? 0));
  const sum = minutes.reduce((a, b) => a + b, 0);
  const detail = ordered.map((row, index) => {
    const sections = reportSections(row.player, lang);
    return {
      row,
      weight: sum ? minutes[index] : 1,
      scores: sectionScores(sections),
      metrics: reportMetrics(sections, copy, lang),
      mix: sortedProfileShareRows(row.player).map((item) => ({ ...item, label: translateLabel(item.label, lang) })),
    };
  });
  const weightTotal = detail.reduce((total, item) => total + item.weight, 0) || 1;

  const mixSums = new Map<string, { share: number; tone: string }>();
  for (const item of detail) {
    for (const row of item.mix) {
      const entry = mixSums.get(row.label) ?? { share: 0, tone: row.tone };
      entry.share += row.share * item.weight;
      mixSums.set(row.label, entry);
    }
  }
  const avgMix = [...mixSums.entries()]
    .map(([label, entry]) => ({ label, tone: entry.tone, share: entry.share / weightTotal }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4);

  const titles: { title: string; tone: string }[] = [];
  for (const item of detail) {
    for (const score of item.scores) {
      if (!titles.some((entry) => entry.title === score.title)) titles.push({ title: score.title, tone: score.tone });
    }
  }
  const matrix = titles
    .map((entry) => {
      const cells = detail.map((item) => item.scores.find((score) => score.title === entry.title)?.score ?? null);
      const avg = weightedMean(
        cells
          .map((value, index) => ({ value, weight: detail[index].weight }))
          .filter((cell): cell is { value: number; weight: number } => cell.value != null),
      );
      return { ...entry, cells, avg };
    })
    .filter((entry): entry is typeof entry & { avg: number } => entry.avg != null);

  type Agg = ReportMetric & { weighted: number; weight: number; per: (number | null)[] };
  const aggs = new Map<string, Agg>();
  detail.forEach((item, seasonIndex) => {
    for (const metric of item.metrics) {
      const key = `${metric.name}::${metric.context}`;
      const agg = aggs.get(key) ?? { ...metric, weighted: 0, weight: 0, per: Array(detail.length).fill(null) };
      agg.weighted += metric.percentile * item.weight;
      agg.weight += item.weight;
      agg.per[seasonIndex] = metric.percentile;
      aggs.set(key, agg);
    }
  });
  const avgMetrics: ReportMetric[] = [...aggs.values()].map((agg) => ({
    name: agg.name,
    context: agg.context,
    tone: agg.tone,
    percentile: Math.round(agg.weighted / (agg.weight || 1)),
    value: agg.per.map((value) => (value == null ? "—" : value)).join(" · "),
  }));
  const errosLabel = translateLabel("Erros Totais", lang);
  const ranked = [...avgMetrics].sort((a, b) => b.percentile - a.percentile);
  const strengths = ranked.filter((metric) => metric.percentile >= 50 && metric.name !== errosLabel).slice(0, 8);
  const weaknesses = [...ranked].reverse().filter((metric) => metric.percentile < 50).slice(0, 8);

  const clubs: string[] = [];
  for (const row of ordered) {
    const club = row.player.display_club ?? row.player.club;
    if (club && clubs[clubs.length - 1] !== club) clubs.push(club);
  }
  const span = ordered.length > 1 ? `${ordered[0].year}–${ordered[ordered.length - 1].year}` : ordered[0]?.year ?? "";
  return { ordered, detail, weightTotal, avgMix, matrix, avgMetrics, strengths, weaknesses, clubs, span };
}

function ProfileStack({ rows }: { rows: { label: string; share: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.share, 0) || 1;
  return (
    <span className="evo-stack">
      {rows.map((row) => {
        const width = (row.share / total) * 100;
        return (
          <span key={row.label} style={{ width: `${width}%`, background: profileAccent(row.label) }}>
            {width >= 9 ? Math.round(row.share) : ""}
          </span>
        );
      })}
    </span>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <span className="evo-bar is-empty">—</span>;
  return (
    <span className={`evo-bar ${percentileTone(value)}`}>
      <span style={{ width: `${clampPct(value)}%` }} />
      <i />
      <b>{value}</b>
    </span>
  );
}

/** "Evolução ano a ano": perfil tático e blocos por temporada, média e variação. */
function EvolutionGrid({ model, copy, lang }: { model: SummaryModel; copy: ReportCopy; lang: ReportLang }) {
  const { detail, matrix, avgMix } = model;
  const locale = reportLocale(lang);
  const n = detail.length;
  const multi = n > 1;
  const columns = `27mm repeat(${n}, minmax(0, 1fr))${multi ? " minmax(0, 1fr) 13mm" : ""}`;
  const legend = [...new Set(detail.flatMap((item) => item.mix.map((row) => row.label)))];
  const profileOf = (index: number) => translateLabel(reportProfileName(detail[index].row.player), lang);
  const bestAvg = [...matrix].sort((a, b) => b.avg - a.avg)[0];
  return (
    <section className="player-report-card player-report-evo">
      <header className="player-report-card-head">
        <h2>{copy.evolution}</h2>
        <span className="player-report-evo-legend">
          {legend.map((label) => (
            <em key={label}>
              <i style={{ background: profileAccent(label) }} />
              {label}
            </em>
          ))}
          <em className="is-median">
            <i />
            {copy.medianKey}
          </em>
        </span>
      </header>
      <div className="player-report-evo-grid" style={{ gridTemplateColumns: columns }}>
        <span className="evo-corner" />
        {detail.map((item) => (
          <div key={`${item.row.year}-${item.row.leagueName}`} className="evo-head">
            <b>{item.row.year}</b>
            <span>
              {item.row.player.display_club ?? item.row.player.club}
              <em> · {item.row.leagueName}</em>
            </span>
            <small>
              {item.row.player.minutes.toLocaleString(locale)} min · {item.row.player.goals} G · {item.row.player.assists} A
            </small>
          </div>
        ))}
        {multi ? (
          <>
            <div className="evo-head is-avg">
              <b>{copy.avgCol}</b>
              <small>{copy.weightedShort}</small>
            </div>
            <div className="evo-head is-delta">
              <small>
                {detail[0].row.year} →<br />
                {detail[n - 1].row.year}
              </small>
            </div>
          </>
        ) : null}

        <span className="evo-label is-caps">{copy.tacticalProfile}</span>
        {detail.map((item) => (
          <div key={`mix-${item.row.year}`} className="evo-cell">
            <ProfileStack rows={item.mix} />
          </div>
        ))}
        {multi ? (
          <>
            <div className="evo-cell is-avg">
              <ProfileStack rows={avgMix} />
            </div>
            <span className="evo-delta is-text">
              {profileOf(0) === profileOf(n - 1) ? profileOf(0) : `${profileOf(0)} → ${profileOf(n - 1)}`}
            </span>
          </>
        ) : null}

        {matrix.map((entry) => {
          const from = entry.cells[0];
          const to = entry.cells[n - 1];
          const delta = from != null && to != null ? to - from : null;
          const cls = delta == null ? "" : delta >= 3 ? "is-up" : delta <= -3 ? "is-down" : "is-even";
          return (
            <Fragment key={entry.title}>
              <span className="evo-label">
                <i style={{ background: TONE_COLORS[entry.tone] }} />
                {entry.title}
              </span>
              {entry.cells.map((value, index) => (
                <div key={`${entry.title}-${index}`} className="evo-cell">
                  <ScoreBar value={value} />
                </div>
              ))}
              {multi ? (
                <>
                  <div className="evo-cell is-avg">
                    <ScoreBar value={Math.round(entry.avg)} />
                  </div>
                  <span className={`evo-delta ${cls}`}>
                    {delta == null ? "—" : `${delta >= 3 ? "▲" : delta <= -3 ? "▼" : "►"} ${fmtSigned(delta, 0, lang)}`}
                  </span>
                </>
              ) : null}
            </Fragment>
          );
        })}

        <span className="evo-label is-caps">{copy.highlightRow}</span>
        {detail.map((item) => {
          const sorted = [...item.scores].sort((a, b) => b.score - a.score);
          const best = sorted[0];
          const worst = sorted[sorted.length - 1];
          const pct = item.row.player.minutes_pct;
          return (
            <div key={`note-${item.row.year}`} className="evo-note">
              {pct != null && pct < 30 ? (
                <em>
                  {copy.shortSample} ({Math.round(pct)}%)
                </em>
              ) : null}
              {best ? (
                <span className="is-up">
                  ▲ {best.title} {best.score}
                </span>
              ) : null}
              {worst && worst !== best ? (
                <span className="is-down">
                  ▼ {worst.title} {worst.score}
                </span>
              ) : null}
            </div>
          );
        })}
        {multi ? (
          <>
            <div className="evo-note is-avg">{bestAvg ? <span>{copy.axisOfProfile(bestAvg.title)}</span> : null}</div>
            <span />
          </>
        ) : null}
      </div>
    </section>
  );
}

/** Páginas do resumo multi-temporada: identidade + evolução + radares; depois pontos, tendências e GPS. */
export function SeasonSummarySheet({
  rows,
  family,
  lang,
  pageNumber,
  totalPages,
}: {
  rows: SummarySheetRow[];
  family: PositionFamily;
  lang: ReportLang;
  pageNumber: number;
  totalPages: number;
}) {
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const familyLabel = translateLabel(familyBySlug(family).label, lang);
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );
  const model = useMemo(() => buildSummaryModel(rows, lang), [rows, lang]);
  const { ordered, detail, avgMix, matrix, strengths, weaknesses, clubs, span } = model;
  const main = rows[0].player;
  const tm = main.transfermarkt;
  const dominant = avgMix[0] ?? null;
  const totalMinutes = ordered.reduce((sum, row) => sum + (row.player.minutes ?? 0), 0);
  const contractDate = formatIso(tm?.contract_until, lang);

  const tendencies = useMemo(() => summaryTendencies(detail, lang, family), [detail, lang, family]);
  const bio = useMemo(() => reportBio(main, lang), [main, lang]);
  const heatmap = useMemo(() => mergedSummaryHeatmap(ordered), [ordered]);
  const avgRun = useMemo(() => averagePhysicalRun(ordered), [ordered]);
  const xprog = xprogView(detail.map((item) => ({ x: item.row.player.xprog, weight: item.weight })));
  const avgScores: SectionScore[] = matrix.map((entry) => ({ title: entry.title, tone: entry.tone, score: Math.round(entry.avg) }));
  const avgProfileScores = profileScoresOf(avgMix);
  const seasonsHint = `${ordered.map((row) => row.year).join(" · ")} → ${copy.avgCol.toLocaleLowerCase(locale)}`;

  const banner = (
    <ReportBanner
      kicker={copy.multiKicker}
      league={familyLabel}
      family={copy.multiSeasons(ordered.length)}
      season={span}
      seasonTag={copy.multiTag}
    />
  );

  return (
    <article className="player-report player-report-summary" lang={lang === "en" ? "en" : "pt-BR"}>
      <div className="player-report-page">
        {banner}
        <div className="player-report-body">
          <section className="player-report-mini player-report-hero">
            <PlayerPhoto
              src={tm?.photo}
              alt=""
              className="player-report-hero-photo"
              fallback={<span className="player-report-hero-photo player-report-photo-fallback">{playerInitials(main.name)}</span>}
            />
            <div className="player-report-hero-main">
              <h1>{main.name}</h1>
              <p>
                <span>{translateLabel(main.position, lang)}</span>
                <span className="player-report-dot">·</span>
                <span>{clubs.join(" → ")}</span>
                {dominant ? (
                  <>
                    <span className="player-report-dot">·</span>
                    <span>
                      {copy.avgProfileTitle}: <b>{dominant.label}</b> ({Math.round(dominant.share)}%)
                    </span>
                  </>
                ) : null}
              </p>
              {bio.length ? (
                <ul className="player-report-bio player-report-bio-mini">
                  {bio.map((item) => (
                    <li key={item.label}>
                      <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                      <span className="player-report-bio-text">
                        <span className="player-report-bio-label">{item.label}</span>
                        <strong>{item.value}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="player-report-kpis">
                <div>
                  <dt>{copy.minutesKpi(ordered.length)}</dt>
                  <dd>{totalMinutes.toLocaleString(locale)}</dd>
                </div>
                <div>
                  <dt>{copy.marketValue}</dt>
                  <dd>{localizeMarketValue(tm?.market_value, lang)}</dd>
                </div>
                <div>
                  <dt>{copy.contractUntilKpi}</dt>
                  <dd>{contractDate ?? "—"}</dd>
                </div>
              </dl>
            </div>
            {heatmap ? (
              <div className="player-report-heat player-report-heat-summary">
                <p className="player-report-label">{copy.avgHeatmapTitle}</p>
                <PlayerHeatmap playerName={main.name} heatmap={heatmap} fixed={{ width: 196, height: 127 }} />
              </div>
            ) : null}
          </section>

          {matrix.length ? <EvolutionGrid model={model} copy={copy} lang={lang} /> : null}

          {avgScores.length ? (
            <div className="player-report-charts is-twin">
              {avgProfileScores.length >= 3 ? (
                <RadarCard title={copy.profileRadar} hint={copy.avgProfileRadarHint} scores={avgProfileScores} sectors />
              ) : null}
              <RadarCard
                title={copy.avgStatRadar}
                hint={copy.blocksRadarHint}
                scores={avgScores}
                legend={{ player: main.name, median: copy.medianKey }}
              />
            </div>
          ) : null}

          <footer className="player-report-foot">
            <p className="player-report-avg-note">{copy.avgNote}</p>
            <ReportColophon generated={generated} page={copy.page(pageNumber, totalPages)} />
          </footer>
        </div>
      </div>

      <div className="player-report-page">
        {banner}
        <div className="player-report-body">
          <header className="player-report-cont">
            <strong>{main.name}</strong>
            <span>
              {familyLabel} · {span}
            </span>
          </header>

          <div className="player-report-split">
            <MetricList title={copy.strengths} hint={seasonsHint} metrics={strengths} empty={copy.noStrengths} tone="is-strong" />
            <MetricList title={copy.weaknesses} hint={seasonsHint} metrics={weaknesses} empty={copy.noWeaknesses} tone="is-weak" />
          </div>

          <TendencyXProgSection
            tendencies={tendencies}
            xprog={xprog}
            copy={copy}
            lang={lang}
            hint={copy.avgTendenciesHint}
          />

          {avgRun ? (
            <GpsCard run={avgRun} title={copy.gpsAvgTitle(ordered.length)} meta={copy.avgTendenciesHint} lang={lang} />
          ) : null}

          <footer className="player-report-foot">
            <p className="player-report-avg-note">{copy.avgNote}</p>
            <ReportColophon generated={generated} page={copy.page(pageNumber + 1, totalPages)} />
          </footer>
        </div>
      </div>
    </article>
  );
}

function parseStat(value: string): number | null {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function InsightCard({ item }: { item: Insight }) {
  return (
    <article className={`player-report-insight is-${item.tone}`}>
      <header>
        <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
        <h3>{item.title}</h3>
        <b className={item.big.length > 9 ? "is-long" : undefined}>{item.big}</b>
      </header>
      {item.visual.kind === "bars" ? (
        <ul className="insight-bars">
          {item.visual.rows.map((row) => (
            <li key={row.label} className={`is-${row.tone}`}>
              <span className="insight-bar-label">{row.label}</span>
              <span className="insight-bar-track">
                <i style={{ width: `${Math.max(2, clampPct(row.fill))}%` }} />
                {row.median ? <em /> : null}
              </span>
              <b>{row.display}</b>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="insight-spark">
          {item.visual.cols.map((col) => (
            <li key={col.label} className={`is-${col.tone}`}>
              <b>{col.value || "—"}</b>
              <span className="insight-spark-col">
                <i style={{ height: `${Math.max(3, clampPct(col.value))}%` }} />
                <em />
              </span>
              <small>{col.label}</small>
            </li>
          ))}
        </ul>
      )}
      {item.note ? <p>{item.note}</p> : null}
    </article>
  );
}

/** Página final: leitura estatística direta para o scout. */
export function AnalystSheet({
  rows,
  family,
  lang,
  pageNumber,
  totalPages,
}: {
  rows: SummarySheetRow[];
  family: PositionFamily;
  lang: ReportLang;
  pageNumber: number;
  totalPages: number;
}) {
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const familyLabel = translateLabel(familyBySlug(family).label, lang);
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );
  const model = useMemo(() => buildSummaryModel(rows, lang), [rows, lang]);
  const { ordered, detail, avgMix, matrix, avgMetrics, clubs, span } = model;
  const main = rows[0].player;
  const tm = main.transfermarkt;
  const multi = ordered.length > 1;
  const dominant = avgMix[0] ?? null;
  const totalMinutes = ordered.reduce((sum, row) => sum + (row.player.minutes ?? 0), 0);
  const contractDate = formatIso(tm?.contract_until, lang);
  const age = main.birth_year ? new Date().getFullYear() - main.birth_year : null;
  const foot = formatFoot(main.foot);
  const contractMonthsLeft = (() => {
    const [y, m] = (tm?.contract_until ?? "").split("-").map(Number);
    if (!y || !m) return null;
    const now = new Date();
    return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
  })();
  const leagues = [...new Set(rows.map((row) => row.poolName ?? row.leagueName).filter(Boolean))].join(" / ");
  const badges = useMemo(() => playerStatBadges(main), [main]);
  const toneByBadge = useMemo(() => {
    const tones = new Map<string, string>();
    for (const option of badgeCatalogForFamily(family)) tones.set(option.key, option.tone);
    return tones;
  }, [family]);

  const report = useMemo(() => {
    const sumStat = (label: string) => {
      const values = ordered.map((row) => parseStat(metricDisplay(row.player, label)));
      return values.every((value) => value != null) ? values.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) : null;
    };
    const avgRun = averagePhysicalRun(ordered);
    const xprog = xprogView(detail.map((item) => ({ x: item.row.player.xprog, weight: item.weight })));
    return buildInsights({
      lang,
      position: translateLabel(main.position, lang),
      profile: dominant ? { label: dominant.label, share: dominant.share, second: avgMix[1] ? { label: avgMix[1].label, share: avgMix[1].share } : null } : null,
      seasons: ordered.map((row) => ({
        year: row.year,
        club: row.player.display_club ?? row.player.club,
        minutes: row.player.minutes ?? 0,
        minutesPct: row.player.minutes_pct ?? null,
      })),
      blocks: matrix.map((entry) => ({ title: entry.title, cells: entry.cells, avg: entry.avg })),
      metrics: avgMetrics,
      errorsLabel: translateLabel("Erros Totais", lang),
      xprog,
      production: {
        goals: ordered.reduce((sum, row) => sum + (row.player.goals ?? 0), 0),
        assists: ordered.reduce((sum, row) => sum + (row.player.assists ?? 0), 0),
        xg: sumStat("xG"),
        xa: sumStat("xA"),
        minutes: totalMinutes,
      },
      person: {
        age,
        heightCm: main.height ?? null,
        foot: foot ? translateLabel(foot, lang).toLocaleLowerCase(lang === "en" ? "en-GB" : "pt-BR") : null,
        contractDate,
        contractMonths: contractMonthsLeft,
        marketValue: tm?.market_value ? localizeMarketValue(tm.market_value, lang) : null,
      },
      physical: avgRun ? reportRunRows(avgRun, lang).map((metric) => ({ key: metric.key, label: metric.label, value: metric.value, pct: metric.pct ?? null })) : null,
    });
  }, [ordered, detail, matrix, avgMetrics, dominant, main, clubs, totalMinutes, lang, copy]);

  const facts = [
    translateLabel(main.position, lang),
    clubs.join(" → "),
    age != null ? copy.bioYears(age) : null,
    foot ? translateLabel(foot, lang) : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="player-report player-report-analyst" lang={lang === "en" ? "en" : "pt-BR"}>
      <div className="player-report-page">
        <ReportBanner
          kicker={copy.insightsKicker}
          league={multi ? familyLabel : leagues}
          family={multi ? copy.multiSeasons(ordered.length) : familyLabel}
          season={span}
          seasonTag={multi ? copy.multiTag : copy.seasonTag}
        />
        <div className="player-report-body">
          <section className="player-report-an-head">
            <PlayerPhoto
              src={tm?.photo}
              alt=""
              className="player-report-mini-photo"
              fallback={<span className="player-report-mini-photo player-report-photo-fallback">{playerInitials(main.name)}</span>}
            />
            <div className="player-report-an-who">
              <h1>{main.name}</h1>
              <p>
                {facts.join(" · ")}
                {dominant ? (
                  <>
                    {" · "}
                    {multi ? copy.avgProfileTitle : copy.tacticalProfile}: <b>{dominant.label}</b> ({Math.round(dominant.share)}%)
                  </>
                ) : null}
              </p>
            </div>
            <dl className="player-report-kpis">
              <div>
                <dt>{multi ? copy.minutesKpi(ordered.length) : copy.minutes}</dt>
                <dd>{totalMinutes.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>{copy.marketValue}</dt>
                <dd>{localizeMarketValue(tm?.market_value, lang)}</dd>
              </div>
              <div>
                <dt>{copy.contractUntilKpi}</dt>
                <dd>{contractDate ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="player-report-synth">
            <div>
              <p className="player-report-label">{copy.synthesis}</p>
              <div className="player-report-synth-text">
                {report.paragraphs.map((item) => (
                  <p key={item.label}>
                    <b>{item.label}</b>
                    {item.text}
                  </p>
                ))}
              </div>
            </div>
            {badges.length ? (
              <BadgeChips badges={badges.slice(0, 4)} toneOf={(key) => toneByBadge.get(key) ?? "passes"} lang={lang} />
            ) : null}
          </section>

          <section>
            <h2 className="player-report-heading">{copy.quickRead}</h2>
            <div className="player-report-insights">
              {report.insights.map((item) => (
                <InsightCard key={item.title} item={item} />
              ))}
            </div>
          </section>

          <section className="player-report-card player-report-keynums">
            <header className="player-report-card-head">
              <h2>{copy.keyNumbers}</h2>
              <span>{leagues}</span>
            </header>
            <table className="player-report-seasons">
              <thead>
                <tr>
                  <th>{copy.seasonTag}</th>
                  <th>{copy.club}</th>
                  <th>{copy.position}</th>
                  <th className="tabular">{copy.minutes}</th>
                  <th className="tabular">G</th>
                  <th className="tabular">A</th>
                  <th className="tabular">xG</th>
                  <th className="tabular">xA</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => {
                  const one = (label: string) => {
                    const v = parseStat(metricDisplay(row.player, label));
                    return v == null ? "—" : fmtNum(v, 1, lang);
                  };
                  return (
                    <tr key={`${row.year}-${row.leagueName}`}>
                      <th scope="row">
                        {row.year}
                        <small>{row.leagueName}</small>
                      </th>
                      <td>{row.player.display_club ?? row.player.club}</td>
                      <td>{translateLabel(row.player.position, lang)}</td>
                      <td className="tabular">
                        {row.player.minutes.toLocaleString(locale)}
                        {row.player.minutes_pct != null ? <small> ({Math.round(row.player.minutes_pct)}%)</small> : null}
                      </td>
                      <td className="tabular">{row.player.goals}</td>
                      <td className="tabular">{row.player.assists}</td>
                      <td className="tabular">{one("xG")}</td>
                      <td className="tabular">{one("xA")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="player-report-heading">{copy.fitTitle}</h2>
            <div className="player-report-fit">
              <article className="is-yes">
                <i className="fa-solid fa-check" aria-hidden="true" />
                <div>
                  <h3>{copy.fitYes}</h3>
                  <p>{report.fit.yes}</p>
                </div>
              </article>
              <article className="is-no">
                <i className="fa-solid fa-exclamation" aria-hidden="true" />
                <div>
                  <h3>{copy.fitNo}</h3>
                  <p>{report.fit.no}</p>
                </div>
              </article>
            </div>
          </section>

          <footer className="player-report-foot">
            <p className="player-report-avg-note">{copy.insightsNote(copy.pool(familyLabel, leagues))}</p>
            <ReportColophon generated={generated} page={copy.page(pageNumber, totalPages)} />
          </footer>
        </div>
      </div>
    </article>
  );
}

type ReportSheetSpec = {
  player: PlayerProfile;
  /** Season year evaluated on this sheet (for the summary page and the banner). */
  seasonYear: string;
  leagueName: string;
  poolName?: string;
  archiveSeasonLabel?: string;
  skipProjection?: boolean;
};

type ArchiveRow = {
  league: string;
  season: string;
  competition?: string | null;
  minutes?: number;
  key: string;
};

export function PlayerReportButton({
  player,
  scoutPlayer,
  family,
  players,
  primaryArchiveLabel,
  cta,
}: {
  player: PlayerProfile;
  scoutPlayer?: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  primaryArchiveLabel?: string;
  cta?: boolean;
}) {
  const { leagueId, name: currentLeagueName, season: currentSeason } = useLeague();
  const scout = scoutPlayer ?? player;
  const { beginLoad, endLoad } = useLoading();
  const [mounted, setMounted] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [lang, setLang] = useState<ReportLang>("pt");
  const [menuOpen, setMenuOpen] = useState(false);
  const [printRequest, setPrintRequest] = useState(0);
  const [reportSheets, setReportSheets] = useState<ReportSheetSpec[]>([
    { player, seasonYear: "", leagueName: "", skipProjection: false },
  ]);
  const [includeArchive, setIncludeArchive] = useState<Record<string, boolean>>({});
  const [registryRows, setRegistryRows] = useState<{ league: string; season: string; competition?: string | null; minutes?: number }[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Registro de identidade dá TODOS os anos disponíveis (cross_season está
  // vazio em linhas de arquivo e não cobre quem saiu da base corrente).
  useEffect(() => {
    // Sempre resolve a linha: identidade carimbada quando existe, senão
    // liga+temporada+player_id cai no persons.json e cobre qualquer linha.
    const qs = new URLSearchParams();
    if (scout.athlete_id) qs.set("athlete_id", scout.athlete_id);
    if (scout.person_key) qs.set("person_key", scout.person_key);
    qs.set("league", leagueId);
    qs.set("season", primaryArchiveLabel ?? currentSeason);
    qs.set("player_id", scout.player_id);
    let cancelled = false;
    fetch(`/api/athlete-rows?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rows?: { league: string; season: string; competition?: string | null; minutes?: number }[] } | null) => {
        if (!cancelled) setRegistryRows(data?.rows ?? null);
      })
      .catch(() => {
        if (!cancelled) setRegistryRows(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scout.athlete_id, scout.person_key, scout.player_id, leagueId, primaryArchiveLabel, currentSeason]);

  // Linha = liga+temporada: um atleta pode ter Paulista A2 e Serie C no mesmo ano.
  const archiveRows = useMemo<ArchiveRow[]>(() => {
    const viewedKey = `${leagueId}|${primaryArchiveLabel ?? currentSeason}`;
    const map = new Map<string, ArchiveRow>();
    for (const row of registryRows ?? []) {
      if (!row.league || !row.season) continue;
      const key = `${row.league}|${row.season}`;
      if (!map.has(key)) map.set(key, { ...row, key });
    }
    for (const row of scout.cross_season?.seasons ?? []) {
      if (!row.year) continue;
      const league = row.league ?? leagueId;
      const key = `${league}|${row.year}`;
      if (!map.has(key)) map.set(key, { league, season: row.year, key });
    }
    map.delete(viewedKey);
    const rows = [...map.values()];
    return rows.sort((a, b) => b.season.localeCompare(a.season) || (b.minutes ?? 0) - (a.minutes ?? 0));
  }, [registryRows, scout.cross_season, leagueId, primaryArchiveLabel, currentSeason]);

  const archiveGroups = useMemo(
    () =>
      [
        { key: "est", label: "Estaduais", rows: archiveRows.filter((row) => row.league.startsWith("est")) },
        { key: "nat", label: "Séries nacionais", rows: archiveRows.filter((row) => !row.league.startsWith("est")) },
      ].filter((group) => group.rows.length),
    [archiveRows],
  );

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

  function leagueNameFor(rowLeague?: string): string {
    if (!rowLeague || rowLeague === leagueId) return currentLeagueName;
    return getLeague(rowLeague)?.name ?? rowLeague;
  }

  function poolNameFor(rowLeague?: string): string {
    const league = rowLeague ? getLeague(rowLeague) : undefined;
    if (league?.poolName) return league.poolName;
    return leagueNameFor(rowLeague);
  }

  async function fetchArchiveProfile(row: ArchiveRow): Promise<{ profile: PlayerProfile; competition?: string | null } | null> {
    const qs = new URLSearchParams({
      league: row.league,
      season: row.season,
      name: scout.name,
      birth_year: String(scout.birth_year ?? ""),
    });
    if (scout.athlete_id) qs.set("athlete_id", scout.athlete_id);
    if (scout.person_key) qs.set("person_key", scout.person_key);
    const res = await fetch(`/api/player-season?${qs}`);
    if (!res.ok) return null;
    const profile = (await res.json()) as PlayerProfile;
    return { profile, competition: row.competition ?? profile.competition ?? null };
  }

  async function exportPdf(next: ReportLang) {
    setMenuOpen(false);
    setLang(next);
    beginLoad();
    const primaryRow = scout.cross_season?.seasons.find((s) => s.year === primaryArchiveLabel);
    const sheets: ReportSheetSpec[] = [
      {
        player,
        skipProjection: player.player_id !== scout.player_id,
        archiveSeasonLabel: primaryArchiveLabel,
        seasonYear: primaryArchiveLabel ?? currentSeason,
        leagueName: player.competition ?? leagueNameFor(primaryRow?.league),
        poolName: poolNameFor(primaryRow?.league ?? leagueId),
      },
    ];
    const covered = new Set([`${leagueId}|${primaryArchiveLabel ?? currentSeason}`]);
    for (const row of archiveRows) {
      if (!includeArchive[row.key] || covered.has(row.key)) continue;
      const found = await fetchArchiveProfile(row);
      if (found) {
        sheets.push({
          player: found.profile,
          archiveSeasonLabel: row.season,
          seasonYear: row.season,
          leagueName: found.competition ?? leagueNameFor(row.league),
          poolName: poolNameFor(row.league),
          skipProjection: true,
        });
        covered.add(row.key);
      }
    }
    setReportSheets(sheets);
    endLoad();
    setPrintRequest((value) => value + 1);
  }

  const copy = REPORT_COPY[lang];
  const totalPages = reportSheets.length * 2 + (reportSheets.length > 1 ? 2 : 0) + 1;
  const summaryRows = useMemo(
    () =>
      reportSheets.map((sheet) => ({
        player: sheet.player,
        year: sheet.seasonYear,
        leagueName: sheet.leagueName,
        poolName: sheet.poolName,
      })),
    [reportSheets],
  );

  return (
    <>
      <div className="shadow-add-menu player-report-menu" ref={rootRef}>
        <button
          type="button"
          className={`btn btn-ghost ${cta ? "hero-report-cta-btn" : "btn-sm"}${menuOpen ? " active" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={copy.pdfTitle}
        >
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> {cta ? "Gerar Relatório PDF" : "PDF"}
        </button>
        {menuOpen ? (
          <div className="shadow-add-dropdown" role="menu">
            {archiveRows.length ? (
              <div className="player-report-archive-picks" role="group" aria-label="Temporadas no PDF">
                <p className="player-report-archive-picks-title">Incluir fichas de arquivo</p>
                {archiveGroups.map((group) => {
                  const all = group.rows.every((row) => includeArchive[row.key]);
                  const some = group.rows.some((row) => includeArchive[row.key]);
                  return (
                    <div key={group.key} className="player-report-archive-group">
                      <label className="player-report-archive-pick player-report-archive-pick-group">
                        <input
                          type="checkbox"
                          checked={all}
                          ref={(el) => {
                            if (el) el.indeterminate = !all && some;
                          }}
                          onChange={(event) =>
                            setIncludeArchive((current) => {
                              const next = { ...current };
                              for (const row of group.rows) next[row.key] = event.target.checked;
                              return next;
                            })
                          }
                        />
                        <span>
                          <strong>{group.label}</strong>
                          {` · ${group.rows.length}`}
                        </span>
                      </label>
                      {group.rows.map((row) => (
                        <label key={row.key} className="player-report-archive-pick player-report-archive-pick-child">
                          <input
                            type="checkbox"
                            checked={Boolean(includeArchive[row.key])}
                            onChange={(event) =>
                              setIncludeArchive((current) => ({ ...current, [row.key]: event.target.checked }))
                            }
                          />
                          <span>
                            Temporada {row.season}
                            {` · ${row.competition ?? leagueNameFor(row.league)}`}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <button type="button" role="menuitem" data-report-lang="pt" onClick={() => void exportPdf("pt")}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" />
              <span>
                <strong>{REPORT_COPY.pt.portuguese}</strong>
                <em>Relatório em português</em>
              </span>
            </button>
            <button type="button" role="menuitem" data-report-lang="en" onClick={() => void exportPdf("en")}>
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
            <>
              {reportSheets.map((sheet, index) => (
                <ReportSheet
                  key={sheet.archiveSeasonLabel ?? `main-${sheet.player.player_id}`}
                  player={sheet.player}
                  family={family}
                  players={players}
                  lang={lang}
                  sheetUrl={sheetUrl}
                  archiveSeasonLabel={sheet.archiveSeasonLabel}
                  leagueName={sheet.leagueName}
                  poolName={sheet.poolName}
                  skipProjection={sheet.skipProjection}
                  pageOffset={index * 2}
                  totalPages={totalPages}
                />
              ))}
              {reportSheets.length > 1 ? (
                <SeasonSummarySheet
                  rows={summaryRows}
                  family={family}
                  lang={lang}
                  pageNumber={reportSheets.length * 2 + 1}
                  totalPages={totalPages}
                />
              ) : null}
              {reportSheets[0]?.seasonYear ? (
                <AnalystSheet rows={summaryRows} family={family} lang={lang} pageNumber={totalPages} totalPages={totalPages} />
              ) : null}
            </>,
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
