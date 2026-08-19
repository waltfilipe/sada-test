import type { AccuracyBadgeKind } from "@/lib/types";

const META: Record<AccuracyBadgeKind, { label: string; short: string }> = {
  gold: { label: "Ouro", short: "Ouro" },
  silver: { label: "Prata", short: "Prata" },
  bronze: { label: "Bronze", short: "Bronze" },
};

type Props = {
  badge: AccuracyBadgeKind;
};

export function AccuracyBadge({ badge }: Props) {
  const meta = META[badge];
  return (
    <span className={`accuracy-badge accuracy-badge-${badge}`} title={`Precisão · ${meta.label}`}>
      {meta.short}
    </span>
  );
}
