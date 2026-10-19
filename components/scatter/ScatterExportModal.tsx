"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { REPORT_COPY, type ReportLang } from "@/lib/reportI18n";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  athletes: PlayerProfile[];
  onClose: () => void;
  onExport: (playerId: string, lang: ReportLang) => void;
};

export function ScatterExportModal({ athletes, onClose, onExport }: Props) {
  const [mounted, setMounted] = useState(false);
  const [pickedId, setPickedId] = useState(athletes[0]?.player_id ?? "");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="stat-window-backdrop" onClick={onClose}>
      <div
        className="stat-window scatter-export-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Exportar PDF com gráficos salvos"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <div>
            <p className="sc-eyebrow">PDF</p>
            <h2>Exportar dossiê + scatter</h2>
          </div>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <p className="scatter-export-modal-lead">
          Escolha o atleta do dossiê. O PDF inclui os gráficos salvos e o relatório completo da posição (mesmo layout
          da ficha).
        </p>

        <fieldset className="scatter-export-pick">
          <legend>Atleta do dossiê</legend>
          <ul>
            {athletes.map((player) => (
              <li key={player.player_id}>
                <label className={pickedId === player.player_id ? "is-active" : undefined}>
                  <input
                    type="radio"
                    name="scatter-export-player"
                    value={player.player_id}
                    checked={pickedId === player.player_id}
                    onChange={() => setPickedId(player.player_id)}
                  />
                  <PlayerPhoto
                    src={player.transfermarkt?.photo}
                    alt=""
                    className="scatter-export-photo"
                    fallback={
                      <span className="scatter-export-photo scatter-export-photo-fallback">{playerInitials(player.name)}</span>
                    }
                  />
                  <span className="scatter-export-pick-copy">
                    <strong>{player.name}</strong>
                    <em>{player.club}</em>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="scatter-export-lang">
          <p className="scatter-export-lang-label">Idioma do relatório</p>
          <div className="scatter-export-lang-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!pickedId}
              onClick={() => pickedId && onExport(pickedId, "pt")}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {REPORT_COPY.pt.portuguese}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!pickedId}
              onClick={() => pickedId && onExport(pickedId, "en")}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {REPORT_COPY.en.english}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
