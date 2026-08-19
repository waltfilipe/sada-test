"use client";

import { useId, type CSSProperties } from "react";

import { MEDAL_META } from "@/lib/scoutTheme";
import type { AccuracyBadgeKind } from "@/lib/types";

const META: Record<AccuracyBadgeKind, { label: string; short: string; rank: string }> = {
  gold: {
    label: `${MEDAL_META.gold.label} · volume e eficiência`,
    short: "Elite",
    rank: "P90+",
  },
  silver: {
    label: `${MEDAL_META.silver.label} · volume e eficiência`,
    short: "Alto",
    rank: "P75+",
  },
  bronze: {
    label: `${MEDAL_META.bronze.label} · volume e eficiência`,
    short: "Sólido",
    rank: "P50+",
  },
};

const PALETTE: Record<
  AccuracyBadgeKind,
  { face: string; edge: string; rim: string; glow: string; chevron: string; text: string; bg: string }
> = {
  gold: {
    face: "#f5c842",
    edge: "#c4921a",
    rim: "rgba(245, 200, 66, 0.72)",
    glow: "rgba(245, 200, 66, 0.32)",
    chevron: "#fff9e8",
    text: "#fff6d6",
    bg: "rgba(245, 200, 66, 0.14)",
  },
  silver: {
    face: "#dbe4ef",
    edge: "#8fa0b8",
    rim: "rgba(219, 228, 239, 0.68)",
    glow: "rgba(219, 228, 239, 0.22)",
    chevron: "#f8fbff",
    text: "#eef2f7",
    bg: "rgba(219, 228, 239, 0.12)",
  },
  bronze: {
    face: "#e09a5a",
    edge: "#a86534",
    rim: "rgba(224, 154, 90, 0.68)",
    glow: "rgba(224, 154, 90, 0.24)",
    chevron: "#fff1e6",
    text: "#fce0c6",
    bg: "rgba(224, 154, 90, 0.14)",
  },
};

const CHEVRON_COUNT: Record<AccuracyBadgeKind, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

type Props = {
  badge: AccuracyBadgeKind;
  size?: number;
  showLabel?: boolean;
};

function ShieldChevrons({ badge, color }: { badge: AccuracyBadgeKind; color: string }) {
  const count = CHEVRON_COUNT[badge];
  const paths = [];
  for (let i = 0; i < count; i += 1) {
    const y = 6.2 + i * 2.15;
    paths.push(
      <path
        key={i}
        d={`M8 ${y} L10.1 ${y + 1.35} L8 ${y + 2.7} L5.9 ${y + 1.35} Z`}
        fill={color}
        opacity={0.92 - i * 0.08}
      />,
    );
  }
  return <g>{paths}</g>;
}

export function AccuracyBadge({ badge, size = 15, showLabel = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const p = PALETTE[badge];
  const meta = META[badge];
  const grad = `shield-${badge}-${uid}`;

  return (
    <span
      className={`accuracy-badge accuracy-badge-${badge}`}
      title={meta.label}
      style={
        {
          "--badge-text": p.text,
          "--badge-bg": p.bg,
          "--badge-ring": p.rim,
        } as CSSProperties
      }
    >
      <svg
        viewBox="0 0 16 18"
        width={size}
        height={Math.round(size * 1.12)}
        role="img"
        aria-label={meta.label}
        className="accuracy-badge-svg"
      >
        <defs>
          <linearGradient id={grad} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor={p.face} />
            <stop offset="55%" stopColor={p.face} />
            <stop offset="100%" stopColor={p.edge} />
          </linearGradient>
          <filter id={`shield-glow-${uid}`} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse cx="8" cy="9" rx="7.2" ry="8.2" fill={p.glow} />
        <path
          d="M8 1.2 L13.4 3.6 V8.4 C13.4 11.8 11.2 14.6 8 16.4 C4.8 14.6 2.6 11.8 2.6 8.4 V3.6 Z"
          fill={`url(#${grad})`}
          stroke={p.rim}
          strokeWidth="0.75"
          filter={`url(#shield-glow-${uid})`}
        />
        <path
          d="M8 2.35 L12.35 4.35 V8.25 C12.35 11.05 10.55 13.35 8 14.75 C5.45 13.35 3.65 11.05 3.65 8.25 V4.35 Z"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.55"
        />
        <ShieldChevrons badge={badge} color={p.chevron} />
      </svg>
      {showLabel ? (
        <span className="accuracy-badge-label">
          {meta.short}
          <span className="accuracy-badge-rank">{meta.rank}</span>
        </span>
      ) : null}
    </span>
  );
}
