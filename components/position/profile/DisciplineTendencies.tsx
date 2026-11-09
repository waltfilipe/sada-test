"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoading } from "@/components/LoadingProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DisciplineInfo, PlayerProfile } from "@/lib/types";
import { StatWindow } from "./ScoutStatsSections";

type MetricKey = "fouls" | "yellow" | "red";
type Tone = "good" | "even" | "bad";

type Metric = {
  key: MetricKey;
  label: string;
  total: number | null;
  per90: number | null;
  avg: number | null;
  decimals: number;
};

/** Below this pool average a ratio is meaningless (red cards ≈ 0,01/90). */
const MIN_RATIO_AVG = 0.05;

function fmt(value: number, decimals: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Menos é melhor: abaixo da média é bom, acima é ruim. */
function toneFor(value: number, avg: number): Tone {
  if (avg < MIN_RATIO_AVG) {
    const gap = value - avg;
    return gap > 0.03 ? "bad" : gap < -0.03 ? "good" : "even";
  }
  const ratio = value / avg;
  return ratio <= 0.85 ? "good" : ratio >= 1.15 ? "bad" : "even";
}

type Delta = { tone: Tone; icon: string; big: string; text: string };

/** Menos é melhor: abaixo da média = verde. `big` é o número em destaque, `text` a leitura. */
function deltaInfo(value: number, avg: number, decimals: number): Delta {
  const tone = toneFor(value, avg);
  const gap = value - avg;
  const icon = tone === "even" ? "fa-equals" : gap > 0 ? "fa-arrow-trend-up" : "fa-arrow-trend-down";
  if (avg < MIN_RATIO_AVG) {
    if (tone === "even") return { tone: "even", icon: "fa-equals", big: "Na média", text: "da posição" };
    return {
      tone,
      icon,
      big: `${gap > 0 ? "+" : "−"}${fmt(Math.abs(gap), decimals)}`,
      text: gap > 0 ? "/90 acima da média" : "/90 abaixo da média",
    };
  }
  const pct = Math.round(((value - avg) / avg) * 100);
  if (pct === 0) return { tone: "even", icon: "fa-equals", big: "Na média", text: "da posição" };
  return { tone, icon, big: `${Math.abs(pct)}%`, text: pct > 0 ? "acima da média" : "abaixo da média" };
}

function buildMetrics(disc: DisciplineInfo): Metric[] {
  const pool = disc.pool ?? {};
  return [
    {
      key: "fouls",
      label: "Faltas cometidas",
      total: disc.fouls_total,
      per90: disc.fouls_per90,
      avg: pool.fouls_per90 ?? null,
      decimals: 1,
    },
    {
      key: "yellow",
      label: "Cartões amarelos",
      total: disc.yellow_total,
      per90: disc.yellow_per90,
      avg: pool.yellow_per90 ?? null,
      decimals: 2,
    },
    {
      key: "red",
      label: "Cartões vermelhos",
      total: disc.red_total,
      per90: disc.red_per90,
      avg: pool.red_per90 ?? null,
      decimals: 2,
    },
  ];
}

/** Veredito: faltas e amarelos pesam igual; vermelho entra só quando aparece. */
function verdict(metrics: Metric[]): { tone: Tone; title: string; detail: string } | null {
  const scored = metrics.filter(
    (m): m is Metric & { per90: number; avg: number } =>
      m.per90 != null && m.avg != null && m.avg >= MIN_RATIO_AVG,
  );
  if (!scored.length) return null;
  const ratio = scored.reduce((sum, m) => sum + m.per90 / m.avg, 0) / scored.length;
  const reds = metrics.find((m) => m.key === "red")?.total ?? 0;
  const redNote = reds > 0 ? ` · ${reds} ${reds === 1 ? "expulsão" : "expulsões"} na temporada` : "";
  if (ratio <= 0.85) {
    return { tone: "good", title: "Mais disciplinado que a média", detail: `Comete menos faltas e leva menos cartões que a posição${redNote}.` };
  }
  if (ratio >= 1.15) {
    return { tone: "bad", title: "Acima da média em faltas e cartões", detail: `Perfil mais faltoso que o da posição${redNote}.` };
  }
  return { tone: "even", title: "Na média da posição", detail: `Faltas e cartões em linha com atletas da mesma função${redNote}.` };
}

function MetricIcon({ metric }: { metric: MetricKey }) {
  if (metric === "fouls") {
    return (
      <span className="disc-icon disc-icon-foul" aria-hidden="true">
        <i className="fa-solid fa-person-falling-burst" />
      </span>
    );
  }
  return <span className={`disc-card disc-card-${metric}`} aria-hidden="true" />;
}

/** Cartõezinhos empilhados: um por cartão recebido, até 8, depois "+n". */
function CardStack({ kind, count }: { kind: "yellow" | "red"; count: number }) {
  if (count <= 0) return <span className="disc-stack-empty">Nenhum</span>;
  const shown = Math.min(count, 8);
  return (
    <span className="disc-stack" aria-label={`${count} ${kind === "yellow" ? "amarelos" : "vermelhos"}`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`disc-card disc-card-mini disc-card-${kind}`} />
      ))}
      {count > shown ? <span className="disc-stack-more">+{count - shown}</span> : null}
    </span>
  );
}

function SummaryTile({ metric }: { metric: Metric }) {
  const comparable = metric.per90 != null && metric.avg != null;
  const delta = comparable ? deltaInfo(metric.per90!, metric.avg!, metric.decimals) : null;
  return (
    <div className={`disc-tile disc-tile-${metric.key}`}>
      <div className="disc-tile-head">
        <MetricIcon metric={metric.key} />
        <span className="disc-tile-label">{metric.label}</span>
      </div>
      <div className="disc-tile-body">
        <strong className="disc-tile-total tabular">{metric.total ?? "—"}</strong>
        <span className="disc-tile-unit">na temporada</span>
        {metric.key !== "fouls" ? <CardStack kind={metric.key} count={metric.total ?? 0} /> : null}
      </div>
      {delta ? (
        <div className={`disc-delta disc-delta-${delta.tone}`}>
          <span className="disc-delta-icon" aria-hidden="true">
            <i className={`fa-solid ${delta.icon}`} />
          </span>
          <span className="disc-delta-copy">
            <strong className="tabular">{delta.big}</strong>
            <span>{delta.text}</span>
          </span>
        </div>
      ) : null}
      {comparable ? (
        <dl className="disc-versus">
          <div>
            <dt>Atleta</dt>
            <dd className="tabular">
              {fmt(metric.per90!, metric.decimals)} <em>/90</em>
            </dd>
          </div>
          <div>
            <dt>Média da posição</dt>
            <dd className="tabular">
              {fmt(metric.avg!, metric.decimals)} <em>/90</em>
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

export function DisciplineTendencies({ player }: { player: PlayerProfile }) {
  const [open, setOpen] = useState(false);
  const { beginLoad, endLoad } = useLoading();

  useEffect(() => {
    setOpen(false);
  }, [player.player_id]);

  const disc = player.discipline;
  const metrics = useMemo(() => (disc ? buildMetrics(disc) : []), [disc]);
  const reading = useMemo(() => verdict(metrics), [metrics]);

  if (!disc) return null;

  const totalsText = `${disc.fouls_total ?? "—"} faltas · ${disc.yellow_total} amarelos · ${disc.red_total} vermelhos`;

  const openModal = () => {
    beginLoad();
    setOpen(true);
    window.setTimeout(() => endLoad(), 120);
  };

  return (
    <>
      <Tooltip content={`Disciplina — ${totalsText} na temporada.`}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={openModal}
        >
          <i className="fa-solid fa-flag" aria-hidden="true" /> Disciplina
        </button>
      </Tooltip>
      {open ? (
        <StatWindow title="Disciplina" onClose={() => setOpen(false)}>
          <div className="disc-modal">
            {reading ? (
              <div className={`disc-verdict disc-verdict-${reading.tone}`}>
                <span className="disc-verdict-icon" aria-hidden="true">
                  <i
                    className={`fa-solid ${
                      reading.tone === "good" ? "fa-shield-halved" : reading.tone === "bad" ? "fa-triangle-exclamation" : "fa-scale-balanced"
                    }`}
                  />
                </span>
                <span className="disc-verdict-copy">
                  <strong>{reading.title}</strong>
                  <span>{reading.detail}</span>
                </span>
              </div>
            ) : null}

            <div className="disc-tiles">
              {metrics.map((metric) => (
                <SummaryTile key={metric.key} metric={metric} />
              ))}
            </div>

            <p className="disc-footnote">
              <i className="fa-solid fa-circle-info" aria-hidden="true" /> Taxas por 90 minutos comparadas com atletas
              da mesma posição nesta série. Menos é melhor: verde = mais disciplinado que a média.
            </p>
          </div>
        </StatWindow>
      ) : null}
    </>
  );
}
