import { aspectQualityPercentile, aspectQuantityPercentile } from "@/lib/aspectGrades";
import type { AspectItem } from "@/lib/types";

export const STAT_BADGE_THRESHOLD = 60;

export type StatMetricBadge = {
  key: string;
  label: string;
  icon: string;
  title: string;
};

export const METRIC_BADGE_CATALOG: Record<string, Omit<StatMetricBadge, "key">> = {
  "Duelos Defensivos": {
    label: "Duelos Defensivos",
    icon: "fa-shield-halved",
    title: "Duelos defensivos — volume e eficiência acima de P60",
  },
  "Eficiência Defensiva": {
    label: "Eficiência Defensiva",
    icon: "fa-shield-virus",
    title: "Eficiência defensiva — volume e eficiência acima de P60",
  },
  "Duelos Aéreos": {
    label: "Duelos Aéreos",
    icon: "fa-cloud",
    title: "Duelos aéreos — volume e eficiência acima de P60",
  },
  "Passes Progressivos": {
    label: "Passes Progressivos",
    icon: "fa-forward",
    title: "Passes progressivos — volume e eficiência acima de P60",
  },
  "Passes para Terço Final": {
    label: "Passes para Terço Final",
    icon: "fa-bullseye",
    title: "Passes para terço final — volume e eficiência acima de P60",
  },
  "Passes Longos": {
    label: "Passes Longos",
    icon: "fa-arrows-left-right",
    title: "Passes longos — volume e eficiência acima de P60",
  },
  Distribuição: {
    label: "Distribuição",
    icon: "fa-share-nodes",
    title: "Distribuição de passe — volume acima de P60",
  },
  "Duelos Ofensivos": {
    label: "Duelos Ofensivos",
    icon: "fa-bolt",
    title: "Duelos ofensivos — volume e eficiência acima de P60",
  },
  Dribles: {
    label: "Dribles",
    icon: "fa-person-running",
    title: "Dribles — volume e eficiência acima de P60",
  },
  "Conduções Progressivas": {
    label: "Conduções Progressivas",
    icon: "fa-road",
    title: "Conduções progressivas — volume acima de P60",
  },
  Progressão: {
    label: "Conduções Progressivas",
    icon: "fa-road",
    title: "Conduções progressivas — volume acima de P60",
  },
  Cruzamentos: {
    label: "Cruzamentos",
    icon: "fa-crosshairs",
    title: "Cruzamentos — volume e eficiência acima de P60",
  },
  "Passes Finas": {
    label: "Passes Finas",
    icon: "fa-key",
    title: "Passes finais — volume acima de P60",
  },
  Ofensividade: {
    label: "Ofensividade",
    icon: "fa-fire",
    title: "Ofensividade no terço final — volume acima de P60",
  },
};

function aboveThreshold(value: number | undefined): boolean {
  return value != null && value > STAT_BADGE_THRESHOLD;
}

/** Player earns a stat badge when quantity and efficiency (when available) are both > P60. */
export function metricEarnsStatBadge(item: AspectItem, displayLabel?: string): boolean {
  const qty = aspectQuantityPercentile(item);
  if (!aboveThreshold(qty)) return false;

  const qual = aspectQualityPercentile(item);
  if (qual == null) {
    return aboveThreshold(qty);
  }
  return aboveThreshold(qual);
}

export function statBadgeForMetric(item: AspectItem, displayLabel?: string): StatMetricBadge | null {
  const label = displayLabel ?? item.label;
  const meta = METRIC_BADGE_CATALOG[label] ?? METRIC_BADGE_CATALOG[item.label];
  if (!meta || !metricEarnsStatBadge(item, label)) return null;
  return { key: label, ...meta };
}

export function earnedStatBadges(items: AspectItem[], groupTitleByItem?: Map<string, string>): StatMetricBadge[] {
  const badges: StatMetricBadge[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const displayLabel = groupTitleByItem?.get(item.label) ?? item.label;
    const badge = statBadgeForMetric(item, displayLabel);
    if (!badge || seen.has(badge.key)) continue;
    seen.add(badge.key);
    badges.push(badge);
  }

  return badges;
}
