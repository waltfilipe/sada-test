"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { useLeague } from "@/components/LeagueProvider";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { familyBySlug } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { formatRating, playerInitials } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import { playerStatBadges } from "@/lib/statBadges";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

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
  blocks: ReportBlock[];
};

const SEASON_TOTALS = new Set(["gols", "xg", "pré assistências", "pre assistências", "erros totais"]);

function per90Label(label: string): string {
  if (
    label === "Eficiência" ||
    label === "Eficiência Defensiva" ||
    label === "Erros Totais" ||
    label === "Eficiência de finalização"
  ) {
    return label;
  }
  if (SEASON_TOTALS.has(label.trim().toLowerCase())) return label;
  if (label.includes("%") || label.includes(" / ") || label.includes("/90") || label.includes("/ 90")) return label;
  return `${label}/90`;
}

function percentileOf(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? Math.round(value) : null;
}

function blocksFor(item: AspectItem, title: string): ReportBlock[] {
  const subs = item.sub_metrics ?? [];
  if (subs.length) {
    const lines = subs
      .map((sub) => ({
        label: per90Label(sub.label),
        value: sub.display_value?.trim() || "—",
        percentile: percentileOf(sub.percentile),
      }))
      .filter((line) => line.value !== "—" || line.percentile != null);
    return lines.length ? [{ title, lines }] : [];
  }

  const volumeValue =
    item.display_value?.trim() ||
    (item.certos_per90 != null ? item.certos_per90.toFixed(1).replace(".", ",") : "—");
  const volumePercentile = percentileOf(item.percentile);
  const efficiency: ReportLine | null =
    item.efficiency_pct != null || item.efficiency_value
      ? {
          label: "Eficiência",
          value: item.efficiency_value?.trim() || "—",
          percentile: percentileOf(item.efficiency_pct),
          sub: true,
        }
      : null;

  if (!efficiency) {
    if (volumeValue === "—" && volumePercentile == null) return [];
    return [{ title: null, lines: [{ label: per90Label(title), value: volumeValue, percentile: volumePercentile }] }];
  }
  return [
    {
      title,
      lines: [
        { label: "Por 90", value: volumeValue, percentile: volumePercentile },
        efficiency,
      ],
    },
  ];
}

function reportSections(player: PlayerProfile): ReportSection[] {
  const all = flattenAspects(player);
  const sections: ReportSection[] = [];
  for (const section of statSectionsForFamily(player.position_family)) {
    const blocks: ReportBlock[] = [];
    for (const label of section.labels) {
      const item = findAspect(all, label);
      if (!item) continue;
      const title = label === "Conduções Progressivas" ? "Progressão" : label;
      blocks.push(...blocksFor(item, title));
    }
    if (blocks.length) sections.push({ title: section.title, blocks });
  }
  return sections;
}

function formatIso(iso?: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, day || 1).toLocaleDateString("pt-BR");
}

function percentileClass(value: number | null): string {
  if (value == null) return "player-report-pct";
  if (value >= 70) return "player-report-pct is-high";
  if (value <= 30) return "player-report-pct is-low";
  return "player-report-pct";
}

export function PlayerReportButton({ player, family }: { player: PlayerProfile; family: PositionFamily }) {
  const league = useLeague();
  const [mounted, setMounted] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");

  useEffect(() => {
    setMounted(true);
    setSheetUrl(window.location.href);
  }, [player.player_id]);

  const sections = useMemo(() => reportSections(player), [player]);
  const badges = useMemo(() => playerStatBadges(player), [player]);
  const familyLabel = familyBySlug(family).label;
  const tm = player.transfermarkt;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const contractDate = formatIso(tm?.contract_until);
  const rating = positionRating(player);
  const mix = profileMetaForFamily(family)
    .filter((item) => item.key !== "perfil" && item.key !== "geral")
    .map((item) => ({ label: item.label, share: player.profile_shares?.[item.key] ?? 0 }))
    .filter((item) => item.share > 0)
    .sort((a, b) => b.share - a.share);
  const generated = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const xg = metricDisplay(player, "xG");
  const xa = metricDisplay(player, "xA");

  const bio = [
    age != null ? `${age} anos` : null,
    player.height ? `${player.height} cm` : null,
    player.foot || null,
    player.nationality || null,
  ].filter(Boolean);

  function exportPdf() {
    const previousTitle = document.title;
    document.title = `${player.name} — Brasil Scout`;
    document.body.classList.add("exporting-player-report");
    const cleanup = () => {
      document.body.classList.remove("exporting-player-report");
      document.title = previousTitle;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  const sheet = (
    <article className="player-report">
      <header className="player-report-top">
        <div>
          <p className="player-report-brand">Brasil Scout</p>
          <p className="player-report-kicker">Relatório do atleta</p>
        </div>
        <p className="player-report-league">
          {league.name} · {league.season}
          <span>{familyLabel}</span>
        </p>
      </header>

      <section className="player-report-identity">
        <PlayerPhoto
          src={tm?.photo}
          alt=""
          className="player-report-photo"
          fallback={<span className="player-report-photo player-report-photo-fallback">{playerInitials(player.name)}</span>}
        />
        <div className="player-report-who">
          <h1>{player.name}</h1>
          <p>
            {player.club}
            <span> · </span>
            {player.position}
          </p>
          {bio.length ? <p className="player-report-bio">{bio.join(" · ")}</p> : null}
        </div>
        <div className="player-report-score">
          <strong>{formatRating(rating)}</strong>
          <span>Nota</span>
          <em>{player.ranks.geral}º geral</em>
          <span>{player.profile}</span>
        </div>
      </section>

      {mix.length ? (
        <p className="player-report-mix">
          {mix.map((item) => `${item.label} ${Math.round(item.share)}%`).join("  ·  ")}
        </p>
      ) : null}

      <dl className="player-report-facts">
        <div>
          <dt>Minutos</dt>
          <dd>
            {player.minutes.toLocaleString("pt-BR")}
            {player.minutes_pct != null ? <small>{Math.round(player.minutes_pct)}% da competição</small> : null}
          </dd>
        </div>
        <div>
          <dt>Valor de mercado</dt>
          <dd>{tm?.market_value ?? "—"}</dd>
        </div>
        <div>
          <dt>Contrato</dt>
          <dd>
            {tm?.contract_remaining ?? "—"}
            {contractDate ? <small>até {contractDate}</small> : null}
          </dd>
        </div>
        <div>
          <dt>Gols · xG</dt>
          <dd>
            {player.goals.toLocaleString("pt-BR")}
            <small>xG {xg}</small>
          </dd>
        </div>
        <div>
          <dt>Assistências · xA</dt>
          <dd>
            {player.assists.toLocaleString("pt-BR")}
            <small>xA {xa}</small>
          </dd>
        </div>
        {tm?.on_loan_from ? (
          <div>
            <dt>Empréstimo</dt>
            <dd>{tm.on_loan_from}</dd>
          </div>
        ) : null}
      </dl>

      {badges.length ? (
        <section className="player-report-badges" aria-label="Badges">
          <h2>Badges</h2>
          <ul>
            {badges.map((badge) => (
              <li key={badge.key}>{badge.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="player-report-stats-wrap" aria-label="Números por 90 minutos">
        <h2>Estatísticas</h2>
        <div className="player-report-stats">
          {sections.map((section) => (
            <section key={section.title} className="player-report-section">
              <h3>{section.title}</h3>
              {section.blocks.map((block, index) => (
                <div key={`${section.title}-${block.title ?? index}`} className="player-report-block">
                  {block.title ? <p>{block.title}</p> : null}
                  <table>
                    <tbody>
                      {block.lines.map((line, lineIndex) => (
                        <tr key={`${line.label}-${lineIndex}`} className={line.sub ? "is-sub" : undefined}>
                          <th scope="row">{line.label}</th>
                          <td>{line.value}</td>
                          <td className={percentileClass(line.percentile)}>{line.percentile ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          ))}
        </div>
      </section>

      <footer className="player-report-foot">
        {tm?.profile_url ? (
          <p>
            <span>Transfermarkt</span>
            <a href={tm.profile_url}>{tm.profile_url}</a>
          </p>
        ) : null}
        {sheetUrl ? (
          <p>
            <span>Ficha</span>
            <a href={sheetUrl}>{sheetUrl}</a>
          </p>
        ) : null}
        <p className="player-report-note">
          “Por 90” e linhas com /90 são taxas por 90 minutos. O percentil (0–100) compara o atleta com a posição na {league.name} {league.season}. Verde a partir de 70, âmbar até 30.
          Gerado em {generated}.
        </p>
      </footer>
    </article>
  );

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={exportPdf} aria-label="Exportar relatório em PDF">
        <i className="fa-solid fa-file-lines" aria-hidden="true" /> PDF
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
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
