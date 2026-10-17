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

/** Rough printed height of a section, in table rows. */
function sectionWeight(section: ReportSection): number {
  return section.blocks.reduce(
    (total, block, index) => total + block.lines.length + (block.title ? 1.1 : 0) + (index === 0 ? 0.7 : 0.4),
    2.2,
  );
}

/** Masonry into three columns, keeping reading order: each section goes to the shortest column. */
function sectionColumns(sections: ReportSection[], count = 3): ReportSection[][] {
  const columns: ReportSection[][] = Array.from({ length: count }, () => []);
  const heights = Array(count).fill(0);
  for (const section of sections) {
    const target = heights.indexOf(Math.min(...heights));
    columns[target].push(section);
    heights[target] += sectionWeight(section);
  }
  return columns.filter((column) => column.length);
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

function PercentileCell({ value }: { value: number | null }) {
  return (
    <td className={`player-report-pct ${percentileTone(value)}`}>
      <span className="player-report-pct-track" aria-hidden="true">
        <span style={{ width: `${value ?? 0}%` }} />
      </span>
      <b>{value ?? "—"}</b>
    </td>
  );
}

function ReportSheet({
  player,
  family,
  players,
  lang,
  sheetUrl,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  lang: ReportLang;
  sheetUrl: string;
}) {
  const league = useLeague();
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const columns = useMemo(() => sectionColumns(reportSections(player, lang)), [player, lang]);
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
  const tendencies = reportTendencies(player, players, lang);
  const generated = new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const highlightsHref = youtubeHighlightsHref(player);
  const xg = localizeValue(metricDisplay(player, "xG"), lang);
  const xa = localizeValue(metricDisplay(player, "xA"), lang);
  const leagueLabel = `${league.name} ${league.season}`;

  const bio = [
    age != null ? copy.age(age) : null,
    player.height ? `${player.height} cm` : null,
    foot ? translateLabel(foot, lang) : null,
    translateNationality(player.nationality, lang),
  ].filter(Boolean);

  return (
    <article className="player-report" lang={lang === "en" ? "en" : "pt-BR"}>
      <header className="player-report-banner">
        <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
        <p className="player-report-kicker">{copy.kicker}</p>
        <p className="player-report-league">
          {league.name} · {league.season}
          <span>{familyLabel}</span>
        </p>
      </header>

      <div className="player-report-body">
        <section className="player-report-identity">
          <PlayerPhoto
            src={tm?.photo}
            alt=""
            className="player-report-photo"
            fallback={<span className="player-report-photo player-report-photo-fallback">{playerInitials(player.name)}</span>}
          />
          <div className="player-report-who">
            <h1>{player.name}</h1>
            <p className="player-report-club">
              <ClubLogo club={player.club} size={16} />
              <span>{player.club}</span>
              <span className="player-report-dot">·</span>
              <span>{translateLabel(player.position, lang)}</span>
            </p>
            {bio.length ? <p className="player-report-bio">{bio.join(" · ")}</p> : null}
            <p className="player-report-highlights">
              <a href={highlightsHref} target="_blank" rel="noopener noreferrer">
                <i className="fa-brands fa-youtube" aria-hidden="true" /> {copy.highlights}
              </a>
            </p>
            <div className="player-report-profile">
              <p>
                {copy.profile} <strong>{profileLabel}</strong>
              </p>
              {mix.length ? (
                <ul>
                  {mix.map((item) => (
                    <li key={item.key} className={item.active ? "is-active" : undefined}>
                      <span className="player-report-mix-label">
                        <i style={{ background: profileAccent(item.label) }} aria-hidden="true" />
                        {translateLabel(item.label, lang)}
                      </span>
                      <span className="player-report-mix-meta">
                        {item.grade}
                        {item.grade && item.rank ? " · " : ""}
                        {item.rank ? ordinal(item.rank, lang) : ""}
                      </span>
                      <span className="player-report-mix-track">
                        <span style={{ width: `${Math.max(4, Math.round(item.share))}%`, background: profileAccent(item.label) }} />
                      </span>
                      <strong>{Math.round(item.share)}%</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <div className="player-report-heat">
            <p>{copy.heatmap}</p>
            {(player.heatmap?.points?.length ?? 0) > 0 ? (
              <PlayerHeatmap playerName={player.name} heatmap={player.heatmap} fixed={{ width: 196, height: 127 }} />
            ) : (
              <p className="player-report-heat-empty">{copy.heatmapEmpty}</p>
            )}
          </div>
        </section>

        <dl className="player-report-facts">
          <div>
            <dt>{copy.minutes}</dt>
            <dd>
              {player.minutes.toLocaleString(locale)}
              {player.minutes_pct != null ? <small>{copy.minutesShare(Math.round(player.minutes_pct))}</small> : null}
            </dd>
          </div>
          <div>
            <dt>{copy.goals}</dt>
            <dd>
              {player.goals.toLocaleString(locale)}
              <small>xG {xg}</small>
            </dd>
          </div>
          <div>
            <dt>{copy.assists}</dt>
            <dd>
              {player.assists.toLocaleString(locale)}
              <small>xA {xa}</small>
            </dd>
          </div>
          <div className="is-context">
            <dt>{copy.marketValue}</dt>
            <dd>
              {localizeMarketValue(tm?.market_value, lang)}
              {tm?.on_loan_from ? <small>{copy.onLoan(tm.on_loan_from)}</small> : null}
            </dd>
          </div>
          <div className="is-context">
            <dt>{copy.contract}</dt>
            <dd>
              {localizeContract(tm?.contract_remaining, lang)}
              {contractDate ? <small>{copy.contractUntil(contractDate)}</small> : null}
            </dd>
          </div>
        </dl>

        {tendencies.length ? (
          <section className="player-report-tendencies" aria-label={copy.tendencies}>
            <h2>{copy.tendencies}</h2>
            <div className="player-report-tendency-grid">
              {tendencies.map((item) => (
                <div key={item.key} className={`player-report-tendency${item.key === "curto" ? " is-length" : ""}`}>
                  <p>{item.label}</p>
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
            <h2>{copy.badges}</h2>
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

        <section className="player-report-stats-wrap" aria-label={copy.stats}>
          <h2>{copy.stats}</h2>
          <div className="player-report-stats">
            {columns.map((column, columnIndex) => (
              <div key={columnIndex} className="player-report-stats-col">
                {column.map((section) => (
                  <section key={section.title} className={`player-report-section tone-${section.tone}`}>
                    <h3>{section.title}</h3>
                    {section.blocks.map((block, index) => (
                      <div
                        key={`${section.title}-${block.title ?? index}`}
                        className={`player-report-block${block.title ? "" : " is-untitled"}`}
                      >
                        {block.title ? <p>{block.title}</p> : null}
                        <table>
                          {index === 0 ? (
                            <thead>
                              <tr className="player-report-scale">
                                <th scope="col" />
                                <td>{copy.value}</td>
                                <td>{copy.percentile}</td>
                              </tr>
                            </thead>
                          ) : null}
                          <tbody>
                            {block.lines.map((line, lineIndex) => (
                              <tr key={`${line.label}-${lineIndex}`} className={line.sub ? "is-sub" : undefined}>
                                <th scope="row">{line.label}</th>
                                <td className="player-report-value">{line.value}</td>
                                <PercentileCell value={line.percentile} />
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
            <p className="player-report-legend-title">{copy.legendTitle}</p>
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
            </ul>
          </div>
          <div className="player-report-links">
            {tm?.profile_url ? (
              <p>
                <span>{copy.transfermarkt}</span>
                <a href={tm.profile_url}>{tm.profile_url.replace(/^https?:\/\/(www\.)?/, "")}</a>
              </p>
            ) : null}
            {sheetUrl ? (
              <p>
                <span>{copy.sheet}</span>
                <a href={sheetUrl}>{sheetUrl.replace(/^https?:\/\//, "")}</a>
              </p>
            ) : null}
          </div>
          <p className="player-report-colophon">
            <span>SADA Scout</span>
            <span>{copy.generated(generated)}</span>
          </p>
        </footer>
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
