"use client";

type Props = {
  medal: "gold" | "silver" | "bronze";
};

const LABELS: Record<Props["medal"], string> = {
  gold: "1º",
  silver: "2º",
  bronze: "3º",
};

function MedalIcon({ medal }: Props) {
  const fill =
    medal === "gold"
      ? "url(#medal-gold)"
      : medal === "silver"
        ? "url(#medal-silver)"
        : "url(#medal-bronze)";

  return (
    <svg viewBox="0 0 20 20" aria-hidden className="medal-icon">
      <defs>
        <linearGradient id="medal-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="medal-silver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="medal-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="11" r="6.5" fill={fill} stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      <path d="M7 3.5 8.4 7.2 6 9.4 10 8.8 14 9.4 11.6 7.2 13 3.5 10 5.6Z" fill={fill} />
    </svg>
  );
}

export function MedalBadge({ medal }: Props) {
  return (
    <span className={`medal-badge medal-${medal}`} title={`Medalha ${LABELS[medal]}`}>
      <MedalIcon medal={medal} />
      <span>{LABELS[medal]}</span>
    </span>
  );
}
