"use client";

import { useEffect, useRef } from "react";
import type { PlayerHeatmapData } from "@/lib/types";

type Props = {
  heatmap?: PlayerHeatmapData | null;
  playerName: string;
};

/** Pitch grid — vertical orientation (width × length). */
const GRID_W = 54;
const GRID_H = 78;
const PITCH_ASPECT = GRID_H / GRID_W;
const KERNEL_SIGMA = 2.1;

function buildDensity(points: { x: number; y: number }[]): Float32Array {
  const grid = new Float32Array(GRID_W * GRID_H);
  const radius = Math.ceil(KERNEL_SIGMA * 3);

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
        grid[gy * GRID_W + gx] += Math.exp(-dist2 / (2 * KERNEL_SIGMA * KERNEL_SIGMA));
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

function heatColor(t: number): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, t));
  if (v < 0.08) return [0, 0, 0, 0];
  if (v < 0.28) return [56, 189, 248, 0.12 + v * 0.45];
  if (v < 0.52) return [34, 211, 238, 0.22 + v * 0.42];
  if (v < 0.72) return [250, 204, 21, 0.38 + v * 0.35];
  if (v < 0.88) return [251, 146, 60, 0.5 + v * 0.38];
  return [239, 68, 68, 0.62 + v * 0.38];
}

function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number, pad: number) {
  const pw = w - pad * 2;
  const ph = h - pad * 2;
  const x0 = pad;
  const y0 = pad;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, y0, 0, y0 + ph);
  bg.addColorStop(0, "#1e4d2b");
  bg.addColorStop(0.5, "#1a4527");
  bg.addColorStop(1, "#163b22");
  ctx.fillStyle = bg;
  ctx.fillRect(x0, y0, pw, ph);

  const stripeH = ph / 12;
  for (let i = 0; i < 12; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.fillRect(x0, y0 + i * stripeH, pw, stripeH);
  }

  const line = "rgba(255, 255, 255, 0.38)";
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1.2, w * 0.004);
  ctx.strokeRect(x0, y0, pw, ph);

  const midY = y0 + ph / 2;
  ctx.beginPath();
  ctx.moveTo(x0, midY);
  ctx.lineTo(x0 + pw, midY);
  ctx.stroke();

  const circleR = pw * 0.11;
  ctx.beginPath();
  ctx.arc(x0 + pw / 2, midY, circleR, 0, Math.PI * 2);
  ctx.stroke();

  const boxH = ph * 0.155;
  ctx.strokeRect(x0, y0, pw, boxH);
  ctx.strokeRect(x0, y0 + ph - boxH, pw, boxH);

  const sixH = ph * 0.06;
  const sixW = pw * 0.42;
  ctx.strokeRect(x0 + (pw - sixW) / 2, y0, sixW, sixH);
  ctx.strokeRect(x0 + (pw - sixW) / 2, y0 + ph - sixH, sixW, sixH);

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  const dotR = Math.max(2, w * 0.007);
  ctx.beginPath();
  ctx.arc(x0 + pw / 2, midY, dotR, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeatLayer(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  w: number,
  h: number,
  pad: number,
) {
  const pw = w - pad * 2;
  const ph = h - pad * 2;
  const density = buildDensity(points);
  const cellW = pw / GRID_W;
  const cellH = ph / GRID_H;

  for (let gy = 0; gy < GRID_H; gy += 1) {
    for (let gx = 0; gx < GRID_W; gx += 1) {
      const value = density[gy * GRID_W + gx];
      if (value < 0.06) continue;
      const [r, g, b, a] = heatColor(value);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(cellLeft(pad, gx, cellW), cellTop(pad, gy, cellH), cellW + 1.2, cellH + 1.2);
    }
  }

  const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.58);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vignette;
  ctx.fillRect(pad, pad, pw, ph);
}

function cellLeft(pad: number, gx: number, cellW: number) {
  return pad + gx * cellW;
}

function cellTop(pad: number, gy: number, cellH: number) {
  return pad + gy * cellH;
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

  const pad = Math.max(6, width * 0.035);
  drawPitch(ctx, width, height, pad);
  if (points.length) drawHeatLayer(ctx, points, width, height, pad);
}

export function PlayerHeatmap({ heatmap, playerName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const points = heatmap?.points ?? [];
  const hasPoints = points.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !hasPoints) return;

    const paint = () => render(canvas, points);
    paint();

    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [heatmap, hasPoints]);

  if (!hasPoints && !heatmap?.image_url) {
    return (
      <div className="heatmap-empty">
        <span className="heatmap-empty-icon" aria-hidden="true">
          <i className="fa-solid fa-map-location-dot" />
        </span>
        <p className="heatmap-placeholder-copy">Mapa de calor indisponível para este atleta.</p>
      </div>
    );
  }

  const meta = [
    heatmap?.competition,
    heatmap?.scope && heatmap.scope !== "overall" ? heatmap.scope : null,
    heatmap?.point_count ? `${heatmap.point_count} zonas` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ariaLabel = `Heatmap de ${playerName}${meta ? ` — ${meta}` : ""}`;

  return (
    <div className="heatmap-body heatmap-body-live">
      {hasPoints ? (
        <div
          ref={wrapRef}
          className="heatmap-pitch-wrap"
          style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
        >
          <canvas ref={canvasRef} className="heatmap-pitch-canvas" role="img" aria-label={ariaLabel} />
        </div>
      ) : heatmap?.image_url ? (
        <img src={heatmap.image_url} alt={ariaLabel} className="heatmap-img" />
      ) : null}
      {meta ? <p className="heatmap-meta">{meta}</p> : null}
    </div>
  );
}
