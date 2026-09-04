"use client";

import { useEffect, useRef } from "react";
import type { PlayerHeatmapData } from "@/lib/types";

type Props = {
  heatmap?: PlayerHeatmapData | null;
  playerName: string;
};

const GRID_W = 64;
const GRID_H = 88;
const KERNEL_RADIUS = 2.4;
const PITCH_ASPECT = GRID_H / GRID_W;

function heatColor(t: number): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, t));
  if (v < 0.12) return [56, 189, 248, v * 0.22];
  if (v < 0.38) return [34, 211, 238, 0.08 + v * 0.28];
  if (v < 0.62) return [250, 204, 21, 0.18 + v * 0.32];
  if (v < 0.82) return [251, 146, 60, 0.28 + v * 0.38];
  return [248, 113, 113, 0.42 + v * 0.48];
}

function buildDensity(points: { x: number; y: number }[]): Float32Array {
  const grid = new Float32Array(GRID_W * GRID_H);
  const sigma = KERNEL_RADIUS;
  const radius = Math.ceil(sigma * 3);

  for (const pt of points) {
    const cx = (pt.x / 100) * (GRID_W - 1);
    const cy = ((100 - pt.y) / 100) * (GRID_H - 1);
    const ix = Math.round(cx);
    const iy = Math.round(cy);

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const gx = ix + dx;
        const gy = iy + dy;
        if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) continue;
        const dist2 = dx * dx + dy * dy;
        grid[gy * GRID_W + gx] += Math.exp(-dist2 / (2 * sigma * sigma));
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

function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number) {
  const pw = w - pad * 2;
  const ph = h - pad * 2;
  const x0 = pad;
  const y0 = pad;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1a2e1f");
  bg.addColorStop(0.55, "#152618");
  bg.addColorStop(1, "#0f1a12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const stripeH = ph / 10;
  for (let i = 0; i < 10; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(255,255,255,0.018)";
    ctx.fillRect(x0, y0 + i * stripeH, pw, stripeH);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.strokeRect(x0, y0, pw, ph);

  const midY = y0 + ph / 2;
  ctx.beginPath();
  ctx.moveTo(x0, midY);
  ctx.lineTo(x0 + pw, midY);
  ctx.stroke();

  const circleR = pw * 0.12;
  ctx.beginPath();
  ctx.arc(x0 + pw / 2, midY, circleR, 0, Math.PI * 2);
  ctx.stroke();

  const boxH = ph * 0.16;
  ctx.strokeRect(x0, y0, pw, boxH);
  ctx.strokeRect(x0, y0 + ph - boxH, pw, boxH);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  const dotR = Math.max(1.5, w * 0.006);
  ctx.beginPath();
  ctx.arc(x0 + pw / 2, midY, dotR, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  w: number,
  h: number,
  pad: number,
) {
  drawPitch(ctx, w, h, pad);
  if (!points.length) return;

  const pw = w - pad * 2;
  const ph = h - pad * 2;
  const density = buildDensity(points);
  const cellW = pw / GRID_W;
  const cellH = ph / GRID_H;

  for (let gy = 0; gy < GRID_H; gy += 1) {
    for (let gx = 0; gx < GRID_W; gx += 1) {
      const value = density[gy * GRID_W + gx];
      if (value < 0.035) continue;
      const [r, g, b, a] = heatColor(value);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(pad + gx * cellW, pad + gy * cellH, cellW + 0.6, cellH + 0.6);
    }
  }

  const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function render(canvas: HTMLCanvasElement, points: { x: number; y: number }[]) {
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const width = Math.max(1, Math.floor(wrap.clientWidth));
  const height = Math.max(1, Math.floor(wrap.clientHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = Math.max(8, width * 0.04);
  drawHeatmap(ctx, points, width, height, pad);
}

export function PlayerHeatmap({ heatmap, playerName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !heatmap?.points?.length) return;

    const paint = () => render(canvas, heatmap.points);
    paint();

    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [heatmap]);

  if (!heatmap?.points?.length) {
    return (
      <div className="heatmap-canvas heatmap-canvas-empty">
        <span className="heatmap-canvas-icon" aria-hidden="true">
          <i className="fa-solid fa-map-location-dot" />
        </span>
        <p className="heatmap-placeholder-copy">Mapa de calor indisponível para este atleta.</p>
      </div>
    );
  }

  const meta = [
    heatmap.competition,
    heatmap.scope !== "overall" ? heatmap.scope : null,
    heatmap.point_count ? `${heatmap.point_count} toques` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="heatmap-canvas heatmap-canvas-live">
      <div ref={wrapRef} className="heatmap-pitch-wrap" style={{ aspectRatio: `1 / ${PITCH_ASPECT}` }}>
        <canvas
          ref={canvasRef}
          className="heatmap-pitch-canvas"
          role="img"
          aria-label={`Heatmap de ${playerName}${meta ? ` — ${meta}` : ""}`}
        />
      </div>
      {meta ? <p className="heatmap-meta">{meta}</p> : null}
    </div>
  );
}
