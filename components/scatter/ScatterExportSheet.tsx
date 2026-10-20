"use client";

import { useMemo } from "react";
import { ScatterPlot } from "@/components/scatter/ScatterPlot";
import { ReportSheet } from "@/components/position/profile/PlayerReport";
import { useLeague } from "@/components/LeagueProvider";
import { buildScatterChartView } from "@/lib/scatterChartBuild";
import { familyBySlug } from "@/lib/positions";
import { REPORT_COPY, reportLocale, type ReportLang } from "@/lib/reportI18n";
import type { SavedScatterChart } from "@/lib/scatterSavedCharts";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  savedCharts: SavedScatterChart[];
  focusPlayer: PlayerProfile;
  lang: ReportLang;
  sheetUrl: string;
};

function plotSize(count: number): { width: number; height: number } {
  if (count >= 3) return { width: 520, height: 156 };
  if (count === 2) return { width: 520, height: 210 };
  return { width: 560, height: 280 };
}

export function ScatterExportSheet({ family, players, savedCharts, focusPlayer, lang, sheetUrl }: Props) {
  const league = useLeague();
  const { href } = league;
  const copy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const familyLabel = familyBySlug(family).label;
  const leagueBanner = `${league.name} · ${league.season}`;
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );
  const totalPages = savedCharts.length ? 3 : 2;
  const size = plotSize(savedCharts.length);

  const built = useMemo(
    () => savedCharts.map((saved) => buildScatterChartView(saved, players, family, href)),
    [savedCharts, players, family, href],
  );

  return (
    <div className="scout-print-export" lang={lang === "en" ? "en" : "pt-BR"}>
      <ReportSheet
        player={focusPlayer}
        family={family}
        players={players}
        lang={lang}
        sheetUrl={sheetUrl}
        totalPages={totalPages}
      />
      {built.length ? (
        <div className="player-report-page scatter-report-page">
          <header className="player-report-banner">
            <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
            <p className="player-report-kicker">{copy.summaryKicker}</p>
            <p className="player-report-league">
              {leagueBanner}
              <span>{familyLabel}</span>
            </p>
          </header>
          <div className="player-report-body scatter-report-body">
            <h2 className="player-report-heading">Mapas de dispersão</h2>
            <div className="scatter-report-stack">
              {built.map((chart, index) => (
                <section key={savedCharts[index]?.id ?? index} className="scatter-report-card">
                  <p className="player-report-label">
                    {chart.xLabel} × {chart.yLabel}
                    {chart.highlightCount
                      ? ` · ${chart.highlightCount} em destaque`
                      : ""}
                  </p>
                  <div className="scatter-report-plot">
                    <ScatterPlot
                      instanceId={`print-${savedCharts[index]?.id ?? index}`}
                      fixedSize={size}
                      interactive={false}
                      points={chart.points}
                      avgX={chart.avgX}
                      avgY={chart.avgY}
                      highlights={chart.highlights}
                      xLabel={chart.xLabel}
                      yLabel={chart.yLabel}
                    />
                  </div>
                </section>
              ))}
            </div>
            <ul className="scatter-report-legend" aria-label="Legenda">
              <li>
                <i className="lg lg-a" aria-hidden="true" /> Atleta 1
              </li>
              <li>
                <i className="lg lg-b" aria-hidden="true" /> Atleta 2
              </li>
              <li>
                <i className="lg lg-c" aria-hidden="true" /> Atleta 3
              </li>
              <li>
                <i className="lg lg-pool" aria-hidden="true" /> Pool da posição
              </li>
              <li>
                <i className="lg lg-avg" aria-hidden="true" /> Média do grupo
              </li>
            </ul>
            <footer className="player-report-foot">
              <p className="player-report-colophon">
                <span>SADA | Scout</span>
                <span>{generated}</span>
                <span>{copy.page(totalPages, totalPages)}</span>
              </p>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
