"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLoading } from "@/components/LoadingProvider";
import { ScatterExportModal } from "@/components/scatter/ScatterExportModal";
import { ScatterExportSheet } from "@/components/scatter/ScatterExportSheet";
import { highlightedAthleteIds, type SavedScatterChart } from "@/lib/scatterSavedCharts";
import { REPORT_COPY, type ReportLang } from "@/lib/reportI18n";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  savedCharts: SavedScatterChart[];
};

export function ScatterExportButton({ family, players, savedCharts }: Props) {
  const { beginLoad, endLoad } = useLoading();
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [exportPlayerId, setExportPlayerId] = useState<string | null>(null);
  const [lang, setLang] = useState<ReportLang>("pt");
  const [printRequest, setPrintRequest] = useState(0);

  const athleteIds = useMemo(() => highlightedAthleteIds(savedCharts), [savedCharts]);
  const exportAthletes = useMemo(
    () =>
      athleteIds
        .map((id) => players.find((player) => player.player_id === id))
        .filter((player): player is PlayerProfile => Boolean(player)),
    [athleteIds, players],
  );
  const focusPlayer = useMemo(
    () => (exportPlayerId ? players.find((player) => player.player_id === exportPlayerId) : null),
    [exportPlayerId, players],
  );

  useEffect(() => {
    setMounted(true);
    setSheetUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!printRequest || !focusPlayer) return;
    beginLoad();
    const previousTitle = document.title;
    document.title =
      lang === "en" ? `${focusPlayer.name} - SADA Scout Report` : `${focusPlayer.name} - Relatório SADA Scout`;
    document.body.classList.add("exporting-scout-print");
    const cleanup = () => {
      document.body.classList.remove("exporting-scout-print");
      document.title = previousTitle;
      endLoad();
      setExportPlayerId(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => endLoad(), 400);
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printRequest, focusPlayer, lang, beginLoad, endLoad]);

  function startExport(playerId: string, nextLang: ReportLang) {
    setModalOpen(false);
    setLang(nextLang);
    setExportPlayerId(playerId);
    setPrintRequest((value) => value + 1);
  }

  if (!savedCharts.length) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setModalOpen(true)}
        disabled={!exportAthletes.length}
        aria-label={REPORT_COPY.pt.pdfTitle}
      >
        <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Exportar PDF
      </button>
      {modalOpen ? (
        <ScatterExportModal athletes={exportAthletes} onClose={() => setModalOpen(false)} onExport={startExport} />
      ) : null}
      {mounted && focusPlayer && exportPlayerId
        ? createPortal(
            <ScatterExportSheet
              family={family}
              players={players}
              savedCharts={savedCharts}
              focusPlayer={focusPlayer}
              lang={lang}
              sheetUrl={sheetUrl}
            />,
            document.body,
          )
        : null}
    </>
  );
}
