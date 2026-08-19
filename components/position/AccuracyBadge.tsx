"use client";

import { useId, type CSSProperties } from "react";

import type { AccuracyBadgeKind } from "@/lib/types";

const META: Record<AccuracyBadgeKind, { label: string; short: string }> = {
  gold: { label: "Aproveitamento · Ouro (top 10%)", short: "Ouro" },
  silver: { label: "Aproveitamento · Prata (top 25%)", short: "Prata" },
  bronze: { label: "Aproveitamento · Bronze (top 50%)", short: "Bronze" },
};

const PALETTE: Record<
  AccuracyBadgeKind,
  { core: string; ring: string; glow: string; highlight: string; text: string; bg: string }
> = {
  gold: {
    core: "#f2c14e",
    ring: "rgba(242, 193, 78, 0.72)",
    glow: "rgba(242, 193, 78, 0.28)",
    highlight: "rgba(255, 246, 213, 0.98)",
    text: "#fff6d6",
    bg: "rgba(242, 193, 78, 0.14)",
  },
  silver: {
    core: "#c8d4e4",
    ring: "rgba(203, 213, 225, 0.62)",
    glow: "rgba(203, 213, 225, 0.2)",
    highlight: "rgba(255, 255, 255, 0.95)",
    text: "#eef2f7",
    bg: "rgba(203, 213, 225, 0.12)",
  },
  bronze: {
    core: "#d18a51",
    ring: "rgba(209, 138, 81, 0.62)",
    glow: "rgba(209, 138, 81, 0.22)",
    highlight: "rgba(252, 224, 198, 0.95)",
    text: "#fce0c6",
    bg: "rgba(209, 138, 81, 0.14)",
  },
};

type Props = {
  badge: AccuracyBadgeKind;
  size?: number;
  showLabel?: boolean;
};

export function AccuracyBadge({ badge, size = 15, showLabel = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const p = PALETTE[badge];
  const meta = META[badge];
  const grad = `acc-${badge}-${uid}`;

  return (
    <span
      className={`accuracy-badge accuracy-badge-${badge}`}
      title={meta.label}
      style={
        {
          "--badge-text": p.text,
          "--badge-bg": p.bg,
          "--badge-ring": p.ring,
        } as CSSProperties
      }
    >
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        role="img"
        aria-label={meta.label}
        className="accuracy-badge-svg"
      >
        <defs>
          <radialGradient id={grad} cx="34%" cy="28%" r="82%">
            <stop offset="0%" stopColor={p.highlight} />
            <stop offset="42%" stopColor={p.core} />
            <stop offset="100%" stopColor={p.core} stopOpacity="0.78" />
          </radialGradient>
          <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="8" cy="8" r="7.4" fill={p.glow} />
        <circle cx="8" cy="8" r="5.8" fill={`url(#${grad})`} filter={`url(#glow-${uid})`} />
        <circle cx="8" cy="8" r="5.8" fill="none" stroke={p.ring} strokeWidth="0.85" />
        <path
          d="M8 4.55 L9.18 6.82 L11.62 7.14 L9.86 8.82 L10.32 11.24 L8 10.06 L5.68 11.24 L6.14 8.82 L4.38 7.14 L6.82 6.82 Z"
          fill="rgba(255,255,255,0.24)"
        />
        <ellipse cx="8" cy="6.05" rx="3" ry="1.75" fill="rgba(255,255,255,0.32)" />
      </svg>
      {showLabel ? <span className="accuracy-badge-label">{meta.short}</span> : null}
    </span>
  );
}
