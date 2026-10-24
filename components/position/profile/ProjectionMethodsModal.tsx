"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatLabCell,
  METHOD_COLUMNS,
  type ProjectionLabReport,
  type ProjectionLabRow,
} from "@/lib/projectionMethodsLab";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  onClose: () => void;
};

function renderCell(row: ProjectionLabRow, methodId: string): string {
  const cell = row.cells[methodId];
  if (!cell) return "—";
  return formatLabCell(cell, row.metric.kind);
}

export function ProjectionMethodsModal({ player, family, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [report, setReport] = useState<ProjectionLabReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        playerId: player.player_id,
        family,
        league: "serie-a",
      });
      const res = await fetch(`/api/projection-lab?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setReport(data as ProjectionLabReport);
    } catch {
      setError("Não foi possível calcular os 8 métodos para este atleta.");
    } finally {
      setLoading(false);
    }
  }, [family, player.player_id]);

  useEffect(() => {
    setMounted(true);
    void load();
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
  }, [load]);

  if (!mounted) return null;

  return createPortal(
    <div className="stat-window-backdrop" onClick={onClose}>
      <div
        className="stat-window similar-cross-modal projection-lab-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Comparação de métodos de projeção — ${player.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <h3>8 métodos · Série A</h3>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="stat-window-body">
          <div className="similar-cross-ref">
            <div className="similar-cross-ref-copy">
              <p className="similar-cross-ref-name">{player.name}</p>
              <p className="similar-cross-ref-meta">
                {player.club} · {player.profile} · {player.minutes.toLocaleString("pt-BR")} min
                {player.minutes_pct != null ? ` (${Math.round(player.minutes_pct)}% do time)` : ""}
              </p>
              <p className="similar-cross-intro-note">
                Comparação lado a lado na mesma divisão (pool Série A). M5 = intervalo de confiança; M6 exige
                histórico em outra temporada.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="similar-cross-hint" aria-live="polite">
              Calculando métricas…
            </p>
          ) : null}

          {error ? (
            <div className="similar-cross-error">
              <p>{error}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
                Tentar de novo
              </button>
            </div>
          ) : null}

          {report && !loading ? (
            <>
              {report.historySeasons.length ? (
                <p className="similar-cross-hint">
                  Histórico Marcel (M6):{" "}
                  {report.historySeasons.map((h) => `${h.label} (${h.minutes} min)`).join(" · ")}
                </p>
              ) : (
                <p className="similar-cross-hint">M6 (Marcel): sem outra temporada encontrada no repositório.</p>
              )}

              <div className="projection-lab-table-wrap" role="region" aria-label="Tabela comparativa">
                <table className="projection-lab-table">
                  <thead>
                    <tr>
                      <th scope="col">Métrica</th>
                      <th scope="col">Obs.</th>
                      {METHOD_COLUMNS.map((col) => (
                        <th key={col.id} scope="col" title={col.description}>
                          {col.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.metric.id}>
                        <th scope="row">{row.metric.label}</th>
                        <td className="tabular">
                          {formatLabCell({ type: "point", value: row.observed }, row.metric.kind)}
                        </td>
                        {METHOD_COLUMNS.map((col) => (
                          <td key={col.id} className="tabular projection-lab-cell">
                            {renderCell(row, col.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details className="projection-lab-legend">
                <summary>Legenda dos métodos</summary>
                <ul>
                  {METHOD_COLUMNS.map((col) => (
                    <li key={col.id}>
                      <strong>{col.short}</strong> — {col.name}: {col.description}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
