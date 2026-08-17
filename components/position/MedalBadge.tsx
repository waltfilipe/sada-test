type Props = {
  medal: "gold" | "silver" | "bronze";
};

const LABELS: Record<Props["medal"], string> = {
  gold: "1º",
  silver: "2º",
  bronze: "3º",
};

export function MedalBadge({ medal }: Props) {
  return (
    <span className={`medal-badge medal-${medal}`} title={`Medalha ${LABELS[medal]}`}>
      {LABELS[medal]}
    </span>
  );
}
