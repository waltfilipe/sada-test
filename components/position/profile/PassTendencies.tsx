"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoading } from "@/components/LoadingProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import { flattenAspects } from "@/lib/aspectLookup";
import { crossingReading, formatPer90 } from "@/lib/crossingTendency";
import { centeredTendencyPosition } from "@/lib/tendencyScale";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { StatWindow } from "./ScoutStatsSections";

function parseDisplay(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim().replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function exactItem(player: PlayerProfile, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === label);
  return parseDisplay(item?.display_value);
}

function exactSub(player: PlayerProfile, parent: string, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === parent);
  const sub = item?.sub_metrics?.find((row) => row.label === label);
  return parseDisplay(sub?.display_value);
}

function storedShare(player: PlayerProfile, key: "pass_tendency" | "progressive_share"): AspectItem | null {
  return (player.aspects.perfil_construcao ?? []).find((item) => item.bar_key === key) ?? null;
}

function longPassShare(player: PlayerProfile): number | null {
  const stored = storedShare(player, "pass_tendency");
  if (stored?.share_pct != null) return stored.share_pct;
  const long = exactItem(player, "Passes Longos");
  const total = exactSub(player, "Distribuição", "Passes");
  if (long == null || total == null || total <= 0) return null;
  return (long / total) * 100;
}

function progressiveShare(player: PlayerProfile): number | null {
  const stored = storedShare(player, "progressive_share");
  if (stored?.share_pct != null) return stored.share_pct;
  const progressive = exactItem(player, "Passes Progressivos");
  const total = exactSub(player, "Distribuição", "Passes");
  if (progressive == null || total == null || total <= 0) return null;
  return (progressive / total) * 100;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

type Direction = "up" | "down" | "neutral";

type TendencyRow = {
  key: string;
  icon: string;
  title: string;
  tip: string;
  unit: "pct" | "per90";
  value: number;
  average: number;
  scale: number;
  leftEnd: string;
  rightEnd: string;
  reading: string;
};

function format(value: number, unit: "pct" | "per90"): string {
  return unit === "pct" ? formatPct(value) : formatPer90(value);
}

function direction(value: number, average: number, unit: "pct" | "per90"): Direction {
  const gap = value - average;
  if (Math.abs(gap) < (unit === "pct" ? 1.5 : 0.15)) return "neutral";
  return gap > 0 ? "up" : "down";
}

function deltaText(value: number, average: number, unit: "pct" | "per90"): string {
  const dir = direction(value, average, unit);
  if (dir === "neutral") return "Na média";
  const abs = Math.abs(value - average);
  const sign = dir === "up" ? "+" : "−";
  return unit === "pct" ? `${sign}${Math.round(abs)} p.p.` : `${sign}${formatPer90(abs)} /90`;
}

function markerInset(value: number): number {
  return Math.min(96, Math.max(4, value));
}

function TendencyCard({ row }: { row: TendencyRow }) {
  const dir = direction(row.value, row.average, row.unit);
  const pos = markerInset(centeredTendencyPosition(row.value, row.average, row.scale));
  const from = Math.min(pos, 50);
  const to = Math.max(pos, 50);
  return (
    <article className={`tend-card tend-${dir}`}>
      <header className="tend-card-head">
        <span className="tend-card-icon" aria-hidden="true">
          <i className={`fa-solid ${row.icon}`} />
        </span>
        <h4 className="tend-card-title">{row.title}</h4>
        <Tooltip content={row.tip}>
          <button type="button" className="tendency-info-btn" aria-label="Mais informações">
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
          </button>
        </Tooltip>
        <span className={`tend-delta tend-delta-${dir}`}>
          {dir !== "neutral" ? (
            <i className={`fa-solid ${dir === "up" ? "fa-arrow-up" : "fa-arrow-down"}`} aria-hidden="true" />
          ) : null}
          {deltaText(row.value, row.average, row.unit)}
        </span>
      </header>

      <div className="tend-card-main">
        <strong className="tend-card-value tabular">{format(row.value, row.unit)}</strong>
        <span className="tend-card-avg">
          média da posição <b className="tabular">{format(row.average, row.unit)}</b>
        </span>
      </div>

      <div className="tend-track" aria-hidden="true">
        <span className="tend-track-rail" />
        <span className="tend-track-fill" style={{ left: `${from}%`, width: `${to - from}%` }} />
        <span className="tend-track-mid" />
        <span className="tend-track-dot" style={{ left: `${pos}%` }} />
      </div>
      <div className="tend-track-ends" aria-hidden="true">
        <span>{row.leftEnd}</span>
        <span>média</span>
        <span>{row.rightEnd}</span>
      </div>

      <p className="tend-card-reading">{row.reading}</p>
    </article>
  );
}

export function PassTendencies({ player, players }: { player: PlayerProfile; players: PlayerProfile[] }) {
  const [open, setOpen] = useState(false);
  const { beginLoad, endLoad } = useLoading();

  useEffect(() => {
    setOpen(false);
  }, [player.player_id]);

  const reading = useMemo(() => {
    const pool = players.length ? players : [player];
    const longStored = storedShare(player, "pass_tendency");
    const progStored = storedShare(player, "progressive_share");
    const long = longPassShare(player);
    const progressive = progressiveShare(player);
    const longAverage =
      longStored?.pool_avg_pct ??
      mean(pool.map(longPassShare).filter((value): value is number => value != null));
    const progressiveAverage =
      progStored?.pool_avg_pct ??
      mean(pool.map(progressiveShare).filter((value): value is number => value != null));

    const rows: TendencyRow[] = [];

    if (long != null && longAverage != null) {
      const gap = long - longAverage;
      rows.push({
        key: "long",
        icon: "fa-ruler-horizontal",
        title: "Passe curto ↔ longo",
        tip: "Parcela de passes longos no total de passes, comparada à média da posição.",
        unit: "pct",
        value: long,
        average: longAverage,
        scale: Math.max(40, long, longAverage, 1),
        leftEnd: "Mais curto",
        rightEnd: "Mais longo",
        reading:
          gap >= 1.5
            ? "Joga mais longo que a média da posição."
            : gap <= -1.5
              ? "Joga mais curto que a média da posição."
              : "Em linha com a média, entre passe curto e longo.",
      });
    }
    if (progressive != null && progressiveAverage != null) {
      const gap = progressive - progressiveAverage;
      rows.push({
        key: "prog",
        icon: "fa-angles-up",
        title: "Passes progressivos",
        tip: "Parcela de passes progressivos no total de passes, comparada à média da posição.",
        unit: "pct",
        value: progressive,
        average: progressiveAverage,
        scale: Math.max(40, progressive, progressiveAverage, 1),
        leftEnd: "Menos",
        rightEnd: "Mais",
        reading:
          gap >= 1.5
            ? "Busca avançar o jogo com mais frequência que a média."
            : gap <= -1.5
              ? "Prioriza passes seguros mais que a média."
              : "Progressão em linha com a média da posição.",
      });
    }
    const crossing = crossingReading(player, pool);
    if (crossing) {
      const gap = crossing.volume - crossing.average;
      rows.push({
        key: "cross",
        icon: "fa-arrow-right-arrow-left",
        title: "Cruzamentos",
        tip: "Volume de cruzamentos por 90 minutos, comparado à média da posição nesta série.",
        unit: "per90",
        value: crossing.volume,
        average: crossing.average,
        scale: crossing.scale,
        leftEnd: "Menos",
        rightEnd: "Mais",
        reading:
          gap >= 0.15
            ? "Cruza mais que a média da posição."
            : gap <= -0.15
              ? "Cruza menos que a média da posição."
              : "Volume de cruzamentos na média da posição.",
      });
    }
    return { rows };
  }, [player, players]);

  const openModal = () => {
    beginLoad();
    setOpen(true);
    window.setTimeout(() => endLoad(), 120);
  };

  return (
    <>
      <Tooltip content="Passe curto/long, progressivos e cruzamentos comparados à média da posição.">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={openModal}
        >
          <i className="fa-solid fa-chart-line" aria-hidden="true" /> Tendências
        </button>
      </Tooltip>
      {open ? (
        <StatWindow title="Tendências de passe" onClose={() => setOpen(false)}>
          <div className="tendency-modal">
            {reading.rows.length ? (
              <div className="tend-grid">
                {reading.rows.map((row) => (
                  <TendencyCard key={row.key} row={row} />
                ))}
              </div>
            ) : (
              <p className="pass-tendencies-note">Sem amostra de passes para esta posição.</p>
            )}

            <p className="pass-tendencies-note tendency-footnote">
              O traço central é a média da posição nesta série; o ponto é o atleta. Quanto mais longe do centro, mais
              marcada a tendência.
            </p>
          </div>
        </StatWindow>
      ) : null}
    </>
  );
}
