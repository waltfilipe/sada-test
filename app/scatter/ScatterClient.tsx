"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AthleteSlot } from "@/components/compare/AthleteSlot";
import { MetricAxisPicker } from "@/components/scatter/MetricAxisPicker";
import { ScatterPlot } from "@/components/scatter/ScatterPlot";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { POSITION_FAMILIES, familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Metric = { key: string; label: string };

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  metrics: Metric[];
  initialA?: string;
  initialB?: string;
  initialX?: string;
  initialY?: string;
};

function formatMetric(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(1);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  return value.toFixed(2);
}

function quadrantLabel(x: number, y: number, avgX: number, avgY: number): string {
  const highX = x >= avgX;
  const highY = y >= avgY;
  if (highX && highY) return "Alto em ambos";
  if (!highX && highY) return "Alto em Y";
  if (highX && !highY) return "Alto em X";
  return "Abaixo da média";
}

export function ScatterClient({
  family,
  players,
  metrics,
  initialA,
  initialB,
  initialX,
  initialY,
}: Props) {
  const router = useRouter();
  const familyMeta = familyBySlug(family);

  const pick = (requested: string | undefined, fallbackIndex: number) => {
    if (requested && players.some((player) => player.player_id === requested)) return requested;
    return players[fallbackIndex]?.player_id ?? players[0]?.player_id ?? "";
  };

  const defaultX = metrics[0]?.key ?? "intervencoes";
  const defaultY = metrics[1]?.key ?? metrics[0]?.key ?? "confrontos_of";

  const [idA, setIdA] = useState(() => pick(initialA, 0));
  const [idB, setIdB] = useState(() => {
    const chosen = pick(initialB, 1);
    const first = pick(initialA, 0);
    if (chosen !== first) return chosen;
    return players.find((player) => player.player_id !== first)?.player_id ?? chosen;
  });
  const [xKey, setXKey] = useState(() => {
    if (initialX && metrics.some((metric) => metric.key === initialX && metric.key !== initialY)) {
      return initialX;
    }
    return defaultX;
  });
  const [yKey, setYKey] = useState(() => {
    if (initialY && metrics.some((metric) => metric.key === initialY && metric.key !== initialX)) {
      return initialY;
    }
    const fallback = metrics.find((metric) => metric.key !== xKey)?.key ?? defaultY;
    return fallback;
  });

  const a = players.find((player) => player.player_id === idA) ?? players[0];
  const b = players.find((player) => player.player_id === idB) ?? players[1] ?? players[0];

  const points = useMemo(
    () =>
      players.map((player) => ({
        player_id: player.player_id,
        label: player.label,
        x: player.scatter[xKey] ?? 0,
        y: player.scatter[yKey] ?? 0,
      })),
    [players, xKey, yKey],
  );

  const avgX = useMemo(
    () => points.reduce((sum, point) => sum + point.x, 0) / (points.length || 1),
    [points],
  );
  const avgY = useMemo(
    () => points.reduce((sum, point) => sum + point.y, 0) / (points.length || 1),
    [points],
  );

  const pointA = points.find((point) => point.player_id === idA);
  const pointB = points.find((point) => point.player_id === idB);

  const xLabel = metrics.find((metric) => metric.key === xKey)?.label ?? xKey;
  const yLabel = metrics.find((metric) => metric.key === yKey)?.label ?? yKey;

  const swapAthletes = () => {
    setIdA(idB);
    setIdB(idA);
  };

  const swapAxes = () => {
    setXKey(yKey);
    setYKey(xKey);
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("posicao", family);
    if (idA) params.set("a", idA);
    if (idB) params.set("b", idB);
    params.set("x", xKey);
    params.set("y", yKey);
    router.replace(`/scatter?${params.toString()}`, { scroll: false });
  }, [family, idA, idB, xKey, yKey, router]);

  const positionTabs = (
    <nav className="position-tabs" aria-label="Posições">
      {POSITION_FAMILIES.map((item) => (
        <Link
          key={item.key}
          href={`/scatter?posicao=${item.slug}`}
          className={item.key === family ? "active" : ""}
          aria-current={item.key === family ? "page" : undefined}
        >
          <span className="tab-full">{item.label}</span>
          <span className="tab-short">{item.short}</span>
        </Link>
      ))}
    </nav>
  );

  if (!a || !b) {
    return (
      <div className="scout-root scatter-root">
        <ScoutTopbar active="scatter" center={positionTabs} />
        <div className="scout-empty">Nenhum atleta disponível para {familyMeta.label.toLowerCase()}.</div>
      </div>
    );
  }

  return (
    <div className="scout-root scatter-root">
      <ScoutTopbar active="scatter" center={positionTabs} />

      <main className="scatter-canvas">
        <div className="compare-stage scatter-stage">
          <AthleteSlot side="a" player={a} players={players} onChange={setIdA} />

          <div className="compare-pivot">
            <span className="pivot-mark">×</span>
            <span className="pivot-note">dois perfis no plano</span>
            <button type="button" className="pivot-swap" onClick={swapAthletes}>
              Inverter
            </button>
          </div>

          <AthleteSlot side="b" player={b} players={players} onChange={setIdB} />
        </div>

        <div className="scatter-workspace">
          <aside className="scatter-rail">
            <section className="sc-panel scatter-panel">
              <header className="sc-panel-head">
                <div>
                  <p className="sc-eyebrow">Configuração</p>
                  <h2>Eixos do gráfico</h2>
                </div>
                <p className="sc-note">{players.length} atletas</p>
              </header>

              <MetricAxisPicker
                axis="x"
                metrics={metrics}
                value={xKey}
                otherValue={yKey}
                onChange={setXKey}
                onSwap={swapAxes}
              />
              <MetricAxisPicker
                axis="y"
                metrics={metrics}
                value={yKey}
                otherValue={xKey}
                onChange={setYKey}
                onSwap={swapAxes}
              />
            </section>

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
                  <i className="lg lg-pool" aria-hidden />
                  <span>Pool da posição</span>
                </li>
                <li>
                  <i className="lg lg-avg" aria-hidden />
                  <span>Média do grupo</span>
                </li>
              </ul>
            </section>
          </aside>

          <section className="sc-panel scatter-panel scatter-chart-panel">
            <header className="sc-panel-head">
              <div>
                <p className="sc-eyebrow">Mapa de dispersão</p>
                <h2>
                  {xLabel} <span className="scatter-vs">×</span> {yLabel}
                </h2>
              </div>
              <p className="sc-note">Posição relativa no pool</p>
            </header>

            <ScatterPlot
              points={points}
              avgX={avgX}
              avgY={avgY}
              highlightA={idA}
              highlightB={idB}
              xLabel={xLabel}
              yLabel={yLabel}
            />

            <div className="scatter-stats">
              {[pointA, pointB].map((point, index) => {
                if (!point) return null;
                const player = index === 0 ? a : b;
                const side = index === 0 ? "a" : "b";
                return (
                  <article key={point.player_id} className={`scatter-stat side-${side}`}>
                    <header>
                      <span>Atleta {index + 1}</span>
                      <strong>{player.name}</strong>
                    </header>
                    <dl>
                      <div>
                        <dt>{xLabel}</dt>
                        <dd>{formatMetric(point.x)}</dd>
                      </div>
                      <div>
                        <dt>{yLabel}</dt>
                        <dd>{formatMetric(point.y)}</dd>
                      </div>
                      <div>
                        <dt>Quadrante</dt>
                        <dd>{quadrantLabel(point.x, point.y, avgX, avgY)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <div className="scatter-links">
          <Link href={`/comparar?posicao=${family}&a=${a.player_id}&b=${b.player_id}`}>
            Comparar atletas
          </Link>
          <Link href={`/posicao/${family}?atleta=${a.player_id}`}>Dossiê de {a.name}</Link>
          <Link href={`/posicao/${family}?atleta=${b.player_id}`}>Dossiê de {b.name}</Link>
        </div>
      </main>
    </div>
  );
}
