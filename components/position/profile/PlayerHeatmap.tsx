"use client";

import { useEffect, useRef } from "react";
import type { PlayerHeatmapData } from "@/lib/types";

type Props = {
  heatmap?: PlayerHeatmapData | null;
  playerName: string;
};

const W = 280;
const H = 380;
const GRID_W = 56;
const GRID_H = 76;
const KERNEL_RADIUS = 2.2;

function heatColor(t: number): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.2) return [34, 197, 94, clamped * 0.35];
  if (clamped < 0.55) return [234, 179, 8, 0.25 + clamped * 0.35];
  return [249, 115, 22, 0.45 + clamped * 0.45];
}

function buildDensity(points: { x: number; y: number }[]): Float32Array {
  const grid = new Float32Array(GRID_W * GRID_H);
  const sigma = KERNEL_RADIUS;
  const radius = Math.ceil(sigma * 3);

  for (const pt of points) {
    const cx = (pt.x / 100) * (GRID_W - 1);
    const cy = (pt.y / 100) * (GRID_H - 1);
    const ix = Math.round(cx);
    const iy = Math.round(cy);

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const gx = ix + dx;
        const gy = iy + dy;
        if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) continue;
        const dist2 = dx * dx + dy * dy;
        const w = Math.exp(-dist2 / (2 * sigma * sigma));
        grid[gy * GRID_W + gx] += w;
      }
    }
  }

  let max = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] > max) max = grid[i];
  }
  if (max > 0) {
    for (let i = 0; i < grid.length; i += 1) {
      grid[i] /= max;
    }
  }
  return grid;
}

function drawPitch(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#166534");
  grad.addColorStop(1, "#14532d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  const midY = H / 2;
  ctx.beginPath();
  ctx.moveTo(10, midY);
  ctx.lineTo(W - 10, midY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, midY, 34, 0, Math.PI * 2);
  ctx.stroke();

  const boxW = W - 20;
  const boxH = 62;
  ctx.strokeRect(10, 10, boxW, boxH);
  ctx.strokeRect(10, H - 10 - boxH, boxW, boxH);
}

function drawHeatmap(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  drawPitch(ctx);
  if (!points.length) return;

  const density = buildDensity(points);
  const cellW = (W - 20) / GRID_W;
  const cellH = (H - 20) / GRID_H;

  for (let gy = 0; gy < GRID_H; gy += 1) {
    for (let gx = 0; gx < GRID_W; gx += 1) {
      const value = density[gy * GRID_W + gx];
      if (value < 0.04) continue;
      const [r, g, b, a] = heatColor(value);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(10 + gx * cellW, 10 + gy * cellH, cellW + 0.5, cellH + 0.5);
    }
  }
}

export function PlayerHeatmap({ heatmap, playerName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmap?.points?.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawHeatmap(ctx, heatmap.points);
  }, [heatmap]);

  if (!heatmap?.points?.length) {
    return (
      <div className="heatmap-canvas heatmap-canvas-empty">
        <span className="heatmap-canvas-icon" aria-hidden="true">
          <i className="fa-solid fa-fire" />
        </span>
        <p className="heatmap-placeholder-copy">Mapa de origem de ações — em breve.</p>
      </div>
    );
  }

  const meta = [heatmap.competition, heatmap.scope !== "overall" ? heatmap.scope : null, heatmap.point_count ? `${heatmap.point_count} toques` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="heatmap-canvas heatmap-canvas-live">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="heatmap-pitch-canvas"
        role="img"
        aria-label={`Heatmap de ${playerName}${meta ? ` — ${meta}` : ""}`}
      />
      {meta ? <p className="heatmap-meta">{meta}</p> : null}
    </div>
  );
}
