"use client";

import { useEffect, useRef } from "react";
import type { PlayerHeatmapData } from "@/lib/types";

type Props = {
  heatmap?: PlayerHeatmapData | null;
  playerName: string;
};

type Point = { x: number; y: number };

/** Real pitch proportions in metres — data is normalised 0–100 on both axes. */
const PITCH_L = 105;
const PITCH_W = 68;
const PITCH_RATIO = PITCH_L / PITCH_W;

/** One density cell per metre keeps the gaussian smooth after upscaling. */
const GRID_W = 105;
const GRID_H = 68;
const SIGMA = 3.4;

/** Elegant low→high ramp: teal → green → amber → coral. */
const RAMP: { stop: number; rgba: [number, number, number, number] }[] = [
  { stop: 0.0, rgba: [13, 148, 136, 0] },
  { stop: 0.18, rgba: [14, 165, 233, 0.16] },
  { stop: 0.36, rgba: [45, 212, 191, 0.34] },
  { stop: 0.54, rgba: [163, 230, 53, 0.48] },
  { stop: 0.7, rgba: [250, 204, 21, 0.6] },
  { stop: 0.85, rgba: [249, 146, 60, 0.7] },
  { stop: 1.0, rgba: [244, 94, 92, 0.78] },
];

function rampColor(t: number): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i += 1) {
    const hi = RAMP[i];
    if (v > hi.stop && i < RAMP.length - 1) continue;
    const lo = RAMP[i - 1];
    const span = hi.stop - lo.stop || 1;
    const k = (v - lo.stop) / span;
    return [
      lo.rgba[0] + (hi.rgba[0] - lo.rgba[0]) * k,
      lo.rgba[1] + (hi.rgba[1] - lo.rgba[1]) * k,
      lo.rgba[2] + (hi.rgba[2] - lo.rgba[2]) * k,
      lo.rgba[3] + (hi.rgba[3] - lo.rgba[3]) * k,
    ];
  }
  return RAMP[RAMP.length - 1].rgba;
}

function buildDensity(points: Point[]): Float32Array {
  const grid = new Float32Array(GRID_W * GRID_H);
  const radius = Math.ceil(SIGMA * 3);
  const denom = 2 * SIGMA * SIGMA;

  for (const pt of points) {
    // x runs goal to goal (attack to the right), y is the width of the pitch.
    const cx = Math.round((pt.x / 100) * (GRID_W - 1));
    const cy = Math.round(((100 - pt.y) / 100) * (GRID_H - 1));

    for (let dy = -radius; dy <= radius; dy += 1) {
      const gy = cy + dy;
      if (gy < 0 || gy >= GRID_H) continue;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const gx = cx + dx;
        if (gx < 0 || gx >= GRID_W) continue;
        grid[gy * GRID_W + gx] += Math.exp(-(dx * dx + dy * dy) / denom);
      }
    }
  }

  let max = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] > max) max = grid[i];
  }
  if (max > 0) {
    for (let i = 0; i < grid.length; i += 1) {
      // Gentle gamma lifts mid-range zones so the map reads as a smooth field.
      grid[i] = Math.pow(grid[i] / max, 0.78);
    }
  }
  return grid;
}

type Rect = { x: number; y: number; w: number; h: number };

function pitchRect(w: number, h: number): Rect {
  const pad = Math.max(6, Math.min(w, h) * 0.045);
  const availW = w - pad * 2;
  const availH = h - pad * 2;
  let pw = availW;
  let ph = pw / PITCH_RATIO;
  if (ph > availH) {
    ph = availH;
    pw = ph * PITCH_RATIO;
  }
  return { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
}

function roundedPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.moveTo(r.x + radius, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, radius);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, radius);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, radius);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, radius);
  ctx.closePath();
}

function drawGrass(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  grad.addColorStop(0, "#15412a");
  grad.addColorStop(0.5, "#123a25");
  grad.addColorStop(1, "#0f321f");

  ctx.save();
  roundedPath(ctx, r, radius);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const bands = 9;
  const bandW = r.w / bands;
  for (let i = 0; i < bands; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(255, 255, 255, 0.022)";
    ctx.fillRect(r.x + i * bandW, r.y, bandW, r.h);
  }
  ctx.restore();
}

function drawHeat(ctx: CanvasRenderingContext2D, r: Rect, radius: number, points: Point[]) {
  const density = buildDensity(points);

  const off = document.createElement("canvas");
  off.width = GRID_W;
  off.height = GRID_H;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;

  const img = offCtx.createImageData(GRID_W, GRID_H);
  for (let i = 0; i < density.length; i += 1) {
    const [cr, cg, cb, ca] = rampColor(density[i]);
    const o = i * 4;
    img.data[o] = cr;
    img.data[o + 1] = cg;
    img.data[o + 2] = cb;
    img.data[o + 3] = Math.round(ca * 255);
  }
  offCtx.putImageData(img, 0, 0);

  ctx.save();
  roundedPath(ctx, r, radius);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Bilinear upscale plus a light blur removes the per-cell grid entirely.
  ctx.filter = `blur(${Math.max(1, r.w * 0.008)}px)`;
  ctx.drawImage(off, r.x, r.y, r.w, r.h);
  ctx.filter = "none";
  ctx.restore();
}

function drawLines(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const mx = (m: number) => r.x + (m / PITCH_L) * r.w;
  const my = (m: number) => r.y + (m / PITCH_W) * r.h;
  const scale = r.w / PITCH_L;

  ctx.save();
  roundedPath(ctx, r, radius);
  ctx.clip();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = Math.max(1, r.w * 0.0028);
  ctx.lineJoin = "round";

  ctx.strokeRect(r.x, r.y, r.w, r.h);

  ctx.beginPath();
  ctx.moveTo(mx(PITCH_L / 2), r.y);
  ctx.lineTo(mx(PITCH_L / 2), r.y + r.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mx(PITCH_L / 2), my(PITCH_W / 2), 9.15 * scale, 0, Math.PI * 2);
  ctx.stroke();

  const boxDepth = 16.5;
  const boxHalf = 20.16;
  const sixDepth = 5.5;
  const sixHalf = 9.16;

  for (const side of [0, 1]) {
    const dir = side === 0 ? 1 : -1;
    const goalLine = side === 0 ? 0 : PITCH_L;

    ctx.strokeRect(
      mx(goalLine + (dir === 1 ? 0 : -boxDepth)),
      my(PITCH_W / 2 - boxHalf),
      boxDepth * scale,
      boxHalf * 2 * scale,
    );

    ctx.strokeRect(
      mx(goalLine + (dir === 1 ? 0 : -sixDepth)),
      my(PITCH_W / 2 - sixHalf),
      sixDepth * scale,
      sixHalf * 2 * scale,
    );

    const spotX = mx(goalLine + dir * 11);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(spotX, my(PITCH_W / 2), Math.max(1.2, r.w * 0.0032), 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      mx(goalLine + dir * boxDepth),
      r.y,
      (PITCH_L - boxDepth) * scale * dir,
      r.h,
    );
    ctx.clip();
    ctx.beginPath();
    ctx.arc(spotX, my(PITCH_W / 2), 9.15 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const goalDepth = 1.6;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.strokeRect(
      mx(goalLine + (dir === 1 ? -goalDepth : 0)),
      my(PITCH_W / 2 - 3.66),
      goalDepth * scale,
      7.32 * scale,
    );
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  }

  const cornerR = 1 * scale;
  const corners: [number, number, number][] = [
    [r.x, r.y, 0],
    [r.x + r.w, r.y, Math.PI / 2],
    [r.x + r.w, r.y + r.h, Math.PI],
    [r.x, r.y + r.h, -Math.PI / 2],
  ];
  for (const [cx, cy, start] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, start, start + Math.PI / 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAttackHint(ctx: CanvasRenderingContext2D, r: Rect) {
  const y = r.y + r.h + Math.max(8, r.h * 0.055);
  const w = Math.min(r.w * 0.2, 64);
  const x = r.x + r.w - w;

  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
  ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - 5, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w - 6, y - 3);
  ctx.lineTo(x + w - 6, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, points: Point[]) {
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
  ctx.clearRect(0, 0, width, height);

  const rect = pitchRect(width, height);
  const radius = Math.min(10, rect.h * 0.06);

  drawGrass(ctx, rect, radius);
  if (points.length) drawHeat(ctx, rect, radius, points);
  drawLines(ctx, rect, radius);
  drawAttackHint(ctx, rect);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div ref={wrapRef} className="heatmap-pitch-wrap">
          <canvas ref={canvasRef} className="heatmap-pitch-canvas" role="img" aria-label={ariaLabel} />
        </div>
      ) : heatmap?.image_url ? (
        <img src={heatmap.image_url} alt={ariaLabel} className="heatmap-img" />
      ) : null}
      {meta ? <p className="heatmap-meta">{meta}</p> : null}
    </div>
  );
}
