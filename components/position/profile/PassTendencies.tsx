"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoading } from "@/components/LoadingProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import { flattenAspects } from "@/lib/aspectLookup";
import { crossingReading, formatPer90 } from "@/lib/crossingTendency";
import { centeredTendencyPosition } from "@/lib/tendencyScale";
import type { AspectItem, PlayerProfile, XProg } from "@/lib/types";
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

    </article>
  );
}

function fmt1(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtSigned(value: number, digits = 1): string {
  const abs = Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${value >= 0 ? "+" : "−"}${abs}`;
}

function xprogDirection(x: XProg): Direction {
  if (Math.abs(x.delta) < Math.max(0.25, x.sd * 0.35)) return "neutral";
  return x.delta > 0 ? "up" : "down";
}

const XPROG_VERDICT: Record<Direction, string> = {
  up: "acima do esperado",
  down: "abaixo do esperado",
  neutral: "dentro do esperado",
};

function XProgChart({ player, pool }: { player: PlayerProfile; pool: PlayerProfile[] }) {
  const me = player.xprog as XProg;
  const dir = xprogDirection(me);
  const dots = pool
    .filter((p) => p.player_id !== player.player_id && p.xprog && !p.xprog.low_sample)
    .map((p) => ({ x: (p.xprog as XProg).expected, y: (p.xprog as XProg).actual }));
  const values = [...dots.flatMap((d) => [d.x, d.y]), me.expected, me.actual];
  const lo = Math.max(0, Math.floor(Math.min(...values)));
  const hi = Math.ceil(Math.max(...values)) + 1;
  const W = 300;
  const L = 38;
  const T = 10;
  const R = 10;
  const B = 36;
  const pw = W - L - R;
  const ph = W - T - B;
  const sx = (v: number) => L + ((v - lo) / (hi - lo)) * pw;
  const sy = (v: number) => T + ph - ((v - lo) / (hi - lo)) * ph;
  const step = Math.max(1, Math.ceil((hi - lo) / 5));
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);

  return (
    <svg
      className={`xp-chart xp-${dir}`}
      viewBox={`0 0 ${W} ${W}`}
      role="img"
      aria-label={`Progressivos por 90 minutos: real ${fmt1(me.actual)} contra esperado ${fmt1(me.expected)}`}
    >
      <polygon className="xp-zone-up" points={`${sx(lo)},${sy(lo)} ${sx(lo)},${sy(hi)} ${sx(hi)},${sy(hi)}`} />
      <polygon className="xp-zone-down" points={`${sx(lo)},${sy(lo)} ${sx(hi)},${sy(lo)} ${sx(hi)},${sy(hi)}`} />
      {ticks.map((t) => (
        <g key={t}>
          <line className="xp-grid" x1={sx(t)} x2={sx(t)} y1={T} y2={T + ph} />
          <line className="xp-grid" x1={L} x2={L + pw} y1={sy(t)} y2={sy(t)} />
          <text className="xp-tick" x={sx(t)} y={T + ph + 13} textAnchor="middle">
            {t}
          </text>
          <text className="xp-tick" x={L - 6} y={sy(t) + 3} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <line className="xp-diagonal" x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} />
      {dots.map((d, i) => (
        <circle key={i} className="xp-dot" cx={sx(d.x)} cy={sy(d.y)} r={2.6} />
      ))}
      <line className="xp-resid" x1={sx(me.expected)} y1={sy(me.expected)} x2={sx(me.expected)} y2={sy(me.actual)} />
      <circle className="xp-me-ring" cx={sx(me.expected)} cy={sy(me.actual)} r={9} />
      <circle className="xp-me" cx={sx(me.expected)} cy={sy(me.actual)} r={5.2} />
      <text className="xp-zone-label" x={L + 6} y={T + 13}>
        Acima do esperado
      </text>
      <text className="xp-zone-label" x={L + pw - 6} y={T + ph - 8} textAnchor="end">
        Abaixo do esperado
      </text>
      <text className="xp-axis" x={L + pw / 2} y={W - 4} textAnchor="middle">
        Progressivos/90 esperado
      </text>
      <text className="xp-axis" transform={`translate(11 ${T + ph / 2}) rotate(-90)`} textAnchor="middle">
        Progressivos/90 real
      </text>
    </svg>
  );
}

function XProgPanel({ player, pool }: { player: PlayerProfile; pool: PlayerProfile[] }) {
  const x = player.xprog;
  if (!x) return <p className="pass-tendencies-note">Sem dados de xProgressão para esta temporada.</p>;
  const dir = xprogDirection(x);
  const facts: { label: string; value: string; tip: string }[] = [
    { label: "Passes/90", value: fmt1(x.passes90), tip: "Volume de passes do atleta por 90 minutos." },
    { label: "Passes certos", value: `${fmt1(x.pass_pct)}%`, tip: "Precisão global de passe." },
    {
      label: "Passes/90 do time",
      value: fmt1(x.team_p90),
      tip: "Volume médio de passes do elenco (proxy de posse e estilo de jogo). Times que mais passam diluem a progressão individual.",
    },
  ];
  if (x.acc_actual != null && x.acc_expected != null) {
    facts.push({
      label: "Acerto progressivo",
      value: `${Math.round(x.acc_actual)}% · esp. ${Math.round(x.acc_expected)}%`,
      tip: "Precisão nos passes progressivos comparada ao esperado dado % de passe e volume progressivo. Poder preditivo baixo: é sinal de habilidade, não de contexto.",
    });
  }
  return (
    <div className={`xp-panel xp-${dir}`}>
      <div className="xp-hero">
        <div className="xp-hero-nums">
          <div>
            <strong className="tabular">{fmt1(x.actual)}</strong>
            <span>real /90</span>
          </div>
          <i className="fa-solid fa-arrow-right-long" aria-hidden="true" />
          <div className="xp-hero-exp">
            <strong className="tabular">{fmt1(x.expected)}</strong>
            <span>esperado /90</span>
          </div>
        </div>
        <div className="xp-hero-delta">
          {dir !== "neutral" ? (
            <i className={`fa-solid ${dir === "up" ? "fa-arrow-up" : "fa-arrow-down"}`} aria-hidden="true" />
          ) : null}
          <strong className="tabular">{fmtSigned(x.delta)}</strong>
          <span>{XPROG_VERDICT[dir]}</span>
        </div>
      </div>

      <XProgChart player={player} pool={pool} />

      <dl className="xp-facts">
        {facts.map((f) => (
          <div key={f.label} className="xp-fact">
            <dt>
              {f.label}
              <Tooltip content={f.tip}>
                <button type="button" className="tendency-info-btn" aria-label="Mais informações">
                  <i className="fa-solid fa-circle-info" aria-hidden="true" />
                </button>
              </Tooltip>
            </dt>
            <dd className="tabular">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="xp-caption">
        Percentil {Math.round(x.delta_pct)} da posição · modelo com {x.n} atletas (R² {x.r2.toFixed(2).replace(".", ",")})
        {x.low_sample ? " · amostra curta" : ""}
      </p>
    </div>
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
      });
    }
    if (progressive != null && progressiveAverage != null) {
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
      });
    }
    const crossing = crossingReading(player, pool);
    if (crossing) {
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
      <Tooltip content="Tendências de passe e xProgressão: quanto o atleta progride além do esperado pelo seu volume, precisão e estilo do time.">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={openModal}
        >
          <i className="fa-solid fa-chart-line" aria-hidden="true" /> Tendências e xProg
        </button>
      </Tooltip>
      {open ? (
        <StatWindow title="Tendências e xProg" onClose={() => setOpen(false)}>
          <div className="tendency-modal xp-modal">
            <section className="xp-col">
              <h3 className="xp-col-title">Tendências de passe</h3>
              {reading.rows.length ? (
                <div className="tend-grid">
                  {reading.rows.map((row) => (
                    <TendencyCard key={row.key} row={row} />
                  ))}
                </div>
              ) : (
                <p className="pass-tendencies-note">Sem amostra de passes para esta posição.</p>
              )}
            </section>
            <section className="xp-col">
              <h3 className="xp-col-title">
                xProgressão
                <Tooltip content="Passes progressivos/90 esperados para o volume de passes, a precisão e o estilo do time do atleta (regressão por posição e série). O resíduo mostra quem progride além do esperado.">
                  <button type="button" className="tendency-info-btn" aria-label="Mais informações">
                    <i className="fa-solid fa-circle-info" aria-hidden="true" />
                  </button>
                </Tooltip>
              </h3>
              <XProgPanel player={player} pool={players.length ? players : [player]} />
            </section>
          </div>
        </StatWindow>
      ) : null}
    </>
  );
}
