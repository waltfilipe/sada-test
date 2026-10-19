"use client";

import { useMemo, type ReactNode } from "react";
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

function ScatterPrintPage({
  familyLabel,
  leagueBanner,
  chartIndex,
  totalPages,
  generated,
  xLabel,
  yLabel,
  highlightCount,
  children,
}: {
  familyLabel: string;
  leagueBanner: string;
  chartIndex: number;
  totalPages: number;
  generated: string;
  xLabel: string;
  yLabel: string;
  highlightCount: number;
  children: ReactNode;
}) {
  return (
    <div className="player-report-page scatter-report-page">
      <header className="player-report-banner">
        <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
        <p className="player-report-kicker">Mapa de dispersão</p>
        <p className="player-report-league">
          {leagueBanner}
          <span>{familyLabel}</span>
        </p>
      </header>
      <div className="player-report-body scatter-report-body">
        <section className="scatter-report-head">
          <h1>
            {xLabel} × {yLabel}
          </h1>
          <p>
            {highlightCount
              ? `${highlightCount} atleta${highlightCount === 1 ? "" : "s"} em destaque · pool completo da posição`
              : "Pool completo da posição (sem destaque)"}
          </p>
        </section>
        <div className="scatter-report-plot">{children}</div>
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
            <span>SADA Scout</span>
            <span>{generated}</span>
            <span>
              Página {chartIndex} de {totalPages}
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
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
  const totalPages = savedCharts.length + 2;
  const pageOffset = savedCharts.length;

  const built = useMemo(
    () => savedCharts.map((saved) => buildScatterChartView(saved, players, family, href)),
    [savedCharts, players, family, href],
  );

  return (
    <div className="scout-print-export" lang={lang === "en" ? "en" : "pt-BR"}>
      {built.map((chart, index) => (
        <ScatterPrintPage
          key={savedCharts[index]?.id ?? index}
          familyLabel={familyLabel}
          leagueBanner={leagueBanner}
          chartIndex={index + 1}
          totalPages={totalPages}
          generated={generated}
          xLabel={chart.xLabel}
          yLabel={chart.yLabel}
          highlightCount={chart.highlightCount}
        >
          <ScatterPlot
            instanceId={`print-${savedCharts[index]?.id ?? index}`}
            fixedSize={{ width: 680, height: 520 }}
            interactive={false}
            points={chart.points}
            avgX={chart.avgX}
            avgY={chart.avgY}
            highlights={chart.highlights}
            xLabel={chart.xLabel}
            yLabel={chart.yLabel}
          />
        </ScatterPrintPage>
      ))}
      <ReportSheet
        player={focusPlayer}
        family={family}
        players={players}
        lang={lang}
        sheetUrl={sheetUrl}
        pageOffset={pageOffset}
        totalPages={totalPages}
      />
    </div>
  );
}
