"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AthleteSlot } from "@/components/compare/AthleteSlot";
import { MetricAxisPicker } from "@/components/scatter/MetricAxisPicker";
import { ScatterPlot, type ScatterHighlight } from "@/components/scatter/ScatterPlot";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { familyBySlug } from "@/lib/positions";
import { scatterAxis, scatterAxisLabel } from "@/lib/scatterAxis";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };
type Tone = ScatterHighlight["tone"];

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  metrics: Metric[];
  initialA?: string;
  initialB?: string;
  initialC?: string;
  initialX?: string;
  initialY?: string;
};

const TONES: Tone[] = ["a", "b", "c"];

function positionMetrics(family: PositionFamily): Metric[] {
  const labels = statSectionsForFamily(family).flatMap((section) => section.labels);
  return [...new Set(labels)].map((label) => ({ key: label, label }));
}

function formatMetric(value: number): string {
  const digits = Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 1 : 2;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function quadrantLabel(
  x: number,
  y: number,
  avgX: number,
  avgY: number,
  xLabel: string,
  yLabel: string,
): string {
  const highX = x >= avgX;
  const highY = y >= avgY;
  if (highX && highY) return `Quadrante Alto em ${xLabel} e ${yLabel}`;
  if (highY) return `Quadrante Alto em ${yLabel}`;
  if (highX) return `Quadrante Alto em ${xLabel}`;
  return `Abaixo da média em ${xLabel} e ${yLabel}`;
}

export function ScatterClient({
  family,
  players,
  metrics,
  initialA,
  initialB,
  initialC,
  initialX,
  initialY,
}: Props) {
  const { href } = useLeague();
  const rootRef = useRef<HTMLDivElement>(null);
  const familyMeta = familyBySlug(family);
  const axisMetrics = useMemo(() => {
    const fromPosition = positionMetrics(family);
    return fromPosition.length ? fromPosition : metrics;
  }, [family, metrics]);

  const pick = (requested: string | undefined, fallbackIndex: number | null) => {
    if (requested === "") return "";
    if (requested && players.some((player) => player.player_id === requested)) return requested;
    if (fallbackIndex == null) return "";
    return players[fallbackIndex]?.player_id ?? "";
  };

  const defaultX = axisMetrics[0]?.key ?? "intervencoes";
  const defaultY = axisMetrics[1]?.key ?? axisMetrics[0]?.key ?? "confrontos_of";

  const [idA, setIdA] = useState(() => pick(initialA, 0));
  const [idB, setIdB] = useState(() => {
    if (initialB === "") return "";
    const chosen = pick(initialB, 1);
    const first = pick(initialA, 0);
    if (!chosen || chosen !== first) return chosen;
    return players.find((player) => player.player_id !== first)?.player_id ?? "";
  });
  const [idC, setIdC] = useState(() => pick(initialC, null));
  const [xKey, setXKey] = useState(() => {
    if (initialX && axisMetrics.some((metric) => metric.key === initialX && metric.key !== initialY)) {
      return initialX;
    }
    return defaultX;
  });
  const [yKey, setYKey] = useState(() => {
    if (initialY && axisMetrics.some((metric) => metric.key === initialY && metric.key !== initialX)) {
      return initialY;
    }
    return axisMetrics.find((metric) => metric.key !== defaultX)?.key ?? defaultY;
  });

  const slotIds = [idA, idB, idC];
  const selected = useMemo(() => {
    const seen = new Set<string>();
    const rows: { id: string; tone: Tone; player: PlayerProfile }[] = [];
    [idA, idB, idC].forEach((id, index) => {
      if (!id || seen.has(id)) return;
      const player = players.find((item) => item.player_id === id);
      if (!player) return;
      seen.add(id);
      rows.push({ id, tone: TONES[index], player });
    });
    return rows;
  }, [idA, idB, idC, players]);

  const points = useMemo(
    () =>
      players.map((player) => ({
        player_id: player.player_id,
        label: player.name,
        name: player.name,
        club: player.club,
        href: href(`/posicao/${family}?atleta=${player.player_id}`),
        x: scatterAxis(player, xKey).value,
        y: scatterAxis(player, yKey).value,
      })),
    [players, xKey, yKey, href, family],
  );

  const avgX = useMemo(
    () => points.reduce((sum, point) => sum + point.x, 0) / (points.length || 1),
    [points],
  );
  const avgY = useMemo(
    () => points.reduce((sum, point) => sum + point.y, 0) / (points.length || 1),
    [points],
  );

  const xLabel = scatterAxisLabel(players, xKey);
  const yLabel = scatterAxisLabel(players, yKey);
  const highlights = selected.map((slot) => ({ id: slot.id, tone: slot.tone }));

  const swapAxes = () => {
    setXKey(yKey);
    setYKey(xKey);
  };

  const optionsFor = (current: string) => {
    const taken = new Set(slotIds.filter((id) => id && id !== current));
    return players.filter((player) => !taken.has(player.player_id));
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("posicao", family);
    params.set("a", idA);
    params.set("b", idB);
    params.set("c", idC);
    params.set("x", xKey);
    params.set("y", yKey);
    const next = href(`/scatter?${params.toString()}`);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) window.history.replaceState(window.history.state, "", next);
  }, [family, idA, idB, idC, xKey, yKey, href]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      const topbar = root.querySelector(".scout-topbar-wrap");
      const canvas = root.querySelector(".scatter-canvas");
      const top = topbar?.getBoundingClientRect().height ?? 0;
      const pad = canvas ? parseFloat(getComputedStyle(canvas).paddingTop) || 0 : 0;
      root.style.setProperty("--scatter-chrome", `${Math.ceil(top + pad + 10)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    const topbar = root.querySelector(".scout-topbar-wrap");
    if (topbar) observer.observe(topbar);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const positionTabs = (
    <PositionFamilyTabs active={family} hrefFor={(slug) => href(`/scatter?posicao=${slug}`)} />
  );

  if (!players.length) {
    return (
      <div className="scout-root scatter-root" ref={rootRef}>
        <ScoutTopbar active="scatter" subnav={positionTabs} />
        <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
      </div>
    );
  }

  const compareQuery = new URLSearchParams({ posicao: family });
  if (selected[0]) compareQuery.set("a", selected[0].id);
  if (selected[1]) compareQuery.set("b", selected[1].id);

  return (
    <div className="scout-root scatter-root" ref={rootRef}>
      <ScoutTopbar active="scatter" subnav={positionTabs} />

      <main className="scatter-canvas">
        <div className="scatter-workspace">
          <aside className="scatter-rail" aria-label="Atletas em destaque">
            <section className="sc-panel scatter-panel scatter-axis-panel">
              <header className="sc-panel-head">
                <div>
                  <p className="sc-eyebrow">Configuração</p>
                  <h2>Eixos do gráfico</h2>
                </div>
                <p className="sc-note">{players.length} atletas</p>
              </header>

              <MetricAxisPicker
                axis="x"
                metrics={axisMetrics}
                groups={statSectionsForFamily(family)}
                value={xKey}
                otherValue={yKey}
                plottedLabel={xLabel}
                onChange={setXKey}
                onSwap={swapAxes}
              />
              <MetricAxisPicker
                axis="y"
                metrics={axisMetrics}
                groups={statSectionsForFamily(family)}
                value={yKey}
                otherValue={xKey}
                plottedLabel={yLabel}
                onChange={setYKey}
                onSwap={swapAxes}
              />
            </section>

            <div className="scatter-slots">
              <AthleteSlot
                compact
                allowEmpty
                side="a"
                player={players.find((player) => player.player_id === idA) ?? null}
                players={optionsFor(idA)}
                onChange={setIdA}
              />
              <AthleteSlot
                compact
                allowEmpty
                side="b"
                player={players.find((player) => player.player_id === idB) ?? null}
                players={optionsFor(idB)}
                onChange={setIdB}
              />
              <AthleteSlot
                compact
                allowEmpty
                side="c"
                player={players.find((player) => player.player_id === idC) ?? null}
                players={optionsFor(idC)}
                onChange={setIdC}
              />
            </div>

            <div className="scatter-rail-extra">
              <section className="sc-panel scatter-panel scatter-legend">
                <header className="sc-panel-head">
                  <div>
                    <p className="sc-eyebrow">Leitura</p>
                    <h2>Legenda</h2>
                  </div>
                </header>
                <ul className="legend-list">
                  <li>
                    <i className="lg lg-a" aria-hidden />
                    <span>Atleta 1</span>
                  </li>
                  <li>
                    <i className="lg lg-b" aria-hidden />
                    <span>Atleta 2</span>
                  </li>
                  <li>
                    <i className="lg lg-c" aria-hidden />
                    <span>Atleta 3</span>
                  </li>
                  <li>
                    <i className="lg lg-pool" aria-hidden />
                    <span>Pool da posição</span>
                  </li>
                  <li>
                    <i className="lg lg-avg" aria-hidden />
                    <span>Média do grupo</span>
                  </li>
                </ul>
              </section>
            </div>
          </aside>

          <section className="scatter-map" aria-label="Mapa de dispersão">
            <ScatterPlot
              points={points}
              avgX={avgX}
              avgY={avgY}
              highlights={highlights}
              xLabel={xLabel}
              yLabel={yLabel}
            />
          </section>
        </div>

        {selected.length > 0 && (
          <div className="scatter-stats">
            {selected.map((slot, index) => {
              const point = points.find((item) => item.player_id === slot.id);
              if (!point) return null;
              return (
                <article key={slot.tone} className={`scatter-stat side-${slot.tone}`}>
                  <p className="scatter-stat-line">
                    <span>Atleta {index + 1}</span>{" "}
                    {quadrantLabel(point.x, point.y, avgX, avgY, xLabel, yLabel)}
                  </p>
                  <strong className="scatter-stat-name">{slot.player.name}</strong>
                  <p className="scatter-stat-values">
                    <span>
                      {xLabel} <b>{formatMetric(point.x)}</b>
                    </span>
                    <span>
                      {yLabel} <b>{formatMetric(point.y)}</b>
                    </span>
                  </p>
                </article>
              );
            })}
          </div>
        )}

        <section className="scatter-guide">
          <h2>Como ler este gráfico</h2>
          <p>
            Cada ponto é um atleta da posição. Os eixos usam o número por 90 minutos. Se a métrica tem
            aproveitamento, entra o que deu certo: duelos e disputas vencidos, dribles com sucesso, passes,
            cruzamentos e finalizações certas. Sem eficiência, o eixo mostra o próprio dado, como condução
            progressiva e pré-assistências.
          </p>
          <p>
            Passe o mouse em um ponto para ver o jogador e o clube. Clique para abrir o dossiê. Dá para
            destacar um, dois ou três atletas ao mesmo tempo; o restante do grupo continua no gráfico, mais
            discreto. As linhas tracejadas marcam a média.
          </p>
          <div className="scatter-links">
            <Link href={href(`/comparar?${compareQuery.toString()}`)}>Comparar atletas</Link>
            {selected.map((slot) => (
              <Link key={slot.id} href={href(`/posicao/${family}?atleta=${slot.id}`)}>
                Dossiê de {slot.player.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
