"use client";

import { useId } from "react";
import { MEDAL_META, type MedalKind } from "@/lib/scoutTheme";

type Palette = {
  ribbonA: string;
  ribbonB: string;
  faceLight: string;
  faceMid: string;
  faceDark: string;
  ring: string;
  mark: string;
};

const PALETTES: Record<MedalKind, Palette> = {
  gold: {
    ribbonA: "#f0b429",
    ribbonB: "#b7791f",
    faceLight: "#fff6d5",
    faceMid: "#f2c14e",
    faceDark: "#a86a12",
    ring: "#ffe9a8",
    mark: "#7c4a08",
  },
  silver: {
    ribbonA: "#cbd5e1",
    ribbonB: "#8593a7",
    faceLight: "#ffffff",
    faceMid: "#d3dbe6",
    faceDark: "#7c8899",
    ring: "#f1f5f9",
    mark: "#54606f",
  },
  bronze: {
    ribbonA: "#d08a52",
    ribbonB: "#96521f",
    faceLight: "#fce0c6",
    faceMid: "#d18a51",
    faceDark: "#8a4a1c",
    ring: "#f7cfa8",
    mark: "#663408",
  },
};

type Props = {
  medal: MedalKind;
  /** Renders the "Top 10%" caption next to the disc. */
  withLabel?: boolean;
  size?: number;
};

export function MedalBadge({ medal, withLabel = false, size = 20 }: Props) {
  const uid = useId().replace(/:/g, "");
  const p = PALETTES[medal];
  const meta = MEDAL_META[medal];

  const ribbon = `ribbon-${uid}`;
  const face = `face-${uid}`;
  const sheen = `sheen-${uid}`;

  return (
    <span className={`sc-medal sc-medal-${medal}`} title={`${meta.tone} · ${meta.label} do pool`}>
      <svg
        viewBox="0 0 28 32"
        width={size}
        height={size * (32 / 28)}
        role="img"
        aria-label={`${meta.tone}, ${meta.label} do pool`}
        className="sc-medal-svg"
      >
        <defs>
          <linearGradient id={ribbon} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={p.ribbonA} />
            <stop offset="100%" stopColor={p.ribbonB} />
          </linearGradient>
          <radialGradient id={face} cx="34%" cy="26%" r="82%">
            <stop offset="0%" stopColor={p.faceLight} />
            <stop offset="52%" stopColor={p.faceMid} />
            <stop offset="100%" stopColor={p.faceDark} />
          </radialGradient>
          <linearGradient id={sheen} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d="M7.4 1 L13 11 L9.6 13.4 L3.4 4.2 Z" fill={`url(#${ribbon})`} opacity="0.92" />
        <path d="M20.6 1 L15 11 L18.4 13.4 L24.6 4.2 Z" fill={`url(#${ribbon})`} opacity="0.72" />

        <circle cx="14" cy="21" r="9.4" fill="rgba(0,0,0,0.28)" />
        <circle cx="14" cy="20.6" r="9" fill={`url(#${face})`} />
        <circle cx="14" cy="20.6" r="9" fill="none" stroke={p.ring} strokeOpacity="0.5" strokeWidth="0.7" />
        <circle cx="14" cy="20.6" r="6.6" fill="none" stroke={p.mark} strokeOpacity="0.28" strokeWidth="0.8" />
        <path
          d="M14 15.6 L15.5 18.7 L18.9 19.2 L16.4 21.6 L17 25 L14 23.4 L11 25 L11.6 21.6 L9.1 19.2 L12.5 18.7 Z"
          fill={p.mark}
          fillOpacity="0.42"
        />
        <ellipse cx="14" cy="17.4" rx="6.6" ry="4" fill={`url(#${sheen})`} />
      </svg>
      {withLabel && <span className="sc-medal-caption">{meta.short}</span>}
    </span>
  );
}
