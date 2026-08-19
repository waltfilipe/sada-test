"use client";

import { useId } from "react";

import type { AccuracyBadgeKind } from "@/lib/types";

const META: Record<AccuracyBadgeKind, { label: string }> = {
  gold: { label: "Precisão · Ouro (top 10%)" },
  silver: { label: "Precisão · Prata (top 25%)" },
  bronze: { label: "Precisão · Bronze (top 50%)" },
};

const PALETTE: Record<
  AccuracyBadgeKind,
  { core: string; ring: string; glow: string; highlight: string }
> = {
  gold: {
    core: "#e8b84a",
    ring: "rgba(242, 193, 78, 0.55)",
    glow: "rgba(242, 193, 78, 0.18)",
    highlight: "rgba(255, 246, 213, 0.95)",
  },
  silver: {
    core: "#b8c4d4",
    ring: "rgba(203, 213, 225, 0.45)",
    glow: "rgba(203, 213, 225, 0.12)",
    highlight: "rgba(255, 255, 255, 0.92)",
  },
  bronze: {
    core: "#c8844f",
    ring: "rgba(209, 138, 81, 0.48)",
    glow: "rgba(209, 138, 81, 0.14)",
    highlight: "rgba(252, 224, 198, 0.9)",
  },
};

type Props = {
  badge: AccuracyBadgeKind;
  size?: number;
};

export function AccuracyBadge({ badge, size = 14 }: Props) {
  const uid = useId().replace(/:/g, "");
  const p = PALETTE[badge];
  const meta = META[badge];
  const grad = `acc-${badge}-${uid}`;

  return (
    <span className={`accuracy-badge accuracy-badge-${badge}`} title={meta.label}>
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        role="img"
        aria-label={meta.label}
        className="accuracy-badge-svg"
      >
        <defs>
          <radialGradient id={grad} cx="35%" cy="30%" r="78%">
            <stop offset="0%" stopColor={p.highlight} />
            <stop offset="45%" stopColor={p.core} />
            <stop offset="100%" stopColor={p.core} stopOpacity="0.72" />
          </radialGradient>
        </defs>
        <circle cx="8" cy="8" r="7.2" fill={p.glow} />
        <circle cx="8" cy="8" r="5.6" fill={`url(#${grad})`} />
        <circle cx="8" cy="8" r="5.6" fill="none" stroke={p.ring} strokeWidth="0.9" />
        <path
          d="M8 4.8 L9.05 6.95 L11.35 7.25 L9.68 8.85 L10.1 11.15 L8 10.05 L5.9 11.15 L6.32 8.85 L4.65 7.25 L6.95 6.95 Z"
          fill="rgba(255,255,255,0.22)"
        />
        <ellipse cx="8" cy="6.2" rx="2.8" ry="1.6" fill="rgba(255,255,255,0.28)" />
      </svg>
    </span>
  );
}
