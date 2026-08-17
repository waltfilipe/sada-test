"use client";

import { useEffect, useState } from "react";
import { ScatterPlot } from "@/components/Charts";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { PositionFamily } from "@/lib/types";

type ScatterPayload = {
  points: { player_id: string; label: string; x: number; y: number }[];
  avgX: number;
  avgY: number;
};

export function ScatterClient() {
  const [family, setFamily] = useState<PositionFamily>("zagueiros");
  const [metrics, setMetrics] = useState<{ key: string; label: string }[]>([]);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [xKey, setXKey] = useState("intervencoes");
  const [yKey, setYKey] = useState("confrontos_of");
  const [payload, setPayload] = useState<ScatterPayload | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then((meta) => {
        const list = meta.scatter_metrics[family] ?? [];
        setMetrics(list);
        setXKey(list[0]?.key ?? "intervencoes");
        setYKey(list[1]?.key ?? "confrontos_of");
      });
  }, [family]);

  useEffect(() => {
    fetch(`/api/families/${family}`)
      .then((res) => res.json())
      .then((data) => {
        setPlayerA(data.players[0]?.player_id ?? "");
        setPlayerB(data.players[1]?.player_id ?? data.players[0]?.player_id ?? "");
      });
  }, [family]);

  useEffect(() => {
    if (!xKey || !yKey) return;
    const params = new URLSearchParams({ x: xKey, y: yKey, a: playerA, b: playerB });
    fetch(`/api/scatter/${family}?${params}`)
      .then((res) => res.json())
      .then(setPayload);
  }, [family, xKey, yKey, playerA, playerB]);

  const xLabel = metrics.find((m) => m.key === xKey)?.label ?? xKey;
  const yLabel = metrics.find((m) => m.key === yKey)?.label ?? yKey;
  const labelA = payload?.points.find((p) => p.player_id === playerA)?.label ?? "Atleta 1";
  const labelB = payload?.points.find((p) => p.player_id === playerB)?.label ?? "Atleta 2";

  return (
    <div className="page scatter-page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">Dispersão</p>
          <h1>Comparação com scatter</h1>
        </div>
      </header>

      <div className="scatter-layout">
        <aside className="panel scatter-sidebar">
          <label>
            Posição
            <select value={family} onChange={(e) => setFamily(e.target.value as PositionFamily)}>
              {POSITION_FAMILIES.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Atleta 1
            <select value={playerA} onChange={(e) => setPlayerA(e.target.value)}>
              {payload?.points.map((point) => (
                <option key={point.player_id} value={point.player_id}>{point.label}</option>
              ))}
            </select>
          </label>
          <label>
            Atleta 2
            <select value={playerB} onChange={(e) => setPlayerB(e.target.value)}>
              {payload?.points.map((point) => (
                <option key={point.player_id} value={point.player_id}>{point.label}</option>
              ))}
            </select>
          </label>
          <label>
            Eixo X
            <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
              {metrics.map((metric) => (
                <option key={metric.key} value={metric.key}>{metric.label}</option>
              ))}
            </select>
          </label>
          <label>
            Eixo Y
            <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
              {metrics.map((metric) => (
                <option key={metric.key} value={metric.key}>{metric.label}</option>
              ))}
            </select>
          </label>
        </aside>

        <section className="panel scatter-main">
          <div className="scatter-card">
            <div className="scatter-card-head tone-a">{labelA}</div>
            {payload && (
              <ScatterPlot
                points={payload.points}
                avgX={payload.avgX}
                avgY={payload.avgY}
                highlight={playerA}
                color="#34d399"
                xLabel={xLabel}
                yLabel={yLabel}
              />
            )}
          </div>
          <div className="scatter-card">
            <div className="scatter-card-head tone-b">{labelB}</div>
            {payload && (
              <ScatterPlot
                points={payload.points}
                avgX={payload.avgX}
                avgY={payload.avgY}
                highlight={playerB}
                color="#a78bfa"
                xLabel={xLabel}
                yLabel={yLabel}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
