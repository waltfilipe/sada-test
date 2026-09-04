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
  Aéreo: {
    label: "Aéreo",
    icon: "fa-cloud",
    title: "Duelo aéreo — volume e eficiência acima de P60",
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
    title: "Distribuição de passe — ambas métricas acima de P60",
  },
  "Disputas com Bola": {
    label: "Disputas com Bola",
    icon: "fa-bolt",
    title: "Disputas com bola — volume e eficiência acima de P60",
  },
  "1v1 - Ofensivo": {
    label: "1v1 - Ofensivo",
    icon: "fa-person-running",
    title: "1v1 ofensivo — volume e eficiência acima de P60",
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
    title: "Cruzamentos — ambas métricas acima de P60",
  },
  "Passes Chave e Área": {
    label: "Passes Chave e Área",
    icon: "fa-key",
    title: "Passes chave e área — ambas métricas acima de P60",
  },
  "Pré Assistências e xA": {
    label: "Pré Assistências e xA",
    icon: "fa-handshake",
    title: "Pré assistências e xA — ambas métricas acima de P60",
  },
  "Passes Criativos": {
    label: "Passes Criativos",
    icon: "fa-wand-magic-sparkles",
    title: "Passes criativos — volume e eficiência acima de P60",
  },
  "Gols e xG": {
    label: "Gols e xG",
    icon: "fa-futbol",
    title: "Gols e xG — ambas métricas acima de P60",
  },
  Finalizações: {
    label: "Finalizações",
    icon: "fa-bullseye",
    title: "Finalizações — ambas métricas acima de P60",
  },
  Ofensividade: {
    label: "Ofensividade",
    icon: "fa-fire",
    title: "Ofensividade — ambas métricas acima de P60",
  },
  "Ações Terminais": {
    label: "Ações Terminais",
    icon: "fa-fire",
    title: "Ações terminais — ambas métricas acima de P60",
  },
  Verticalidade: {
    label: "Verticalidade",
    icon: "fa-arrow-up",
    title: "Verticalidade — ambas métricas acima de P60",
  },
  "Duelos Vencidos": {
    label: "Duelos Vencidos",
    icon: "fa-shield-halved",
    title: "Duelos vencidos — volume e eficiência acima de P60",
  },
  "Ações Defensivas": {
    label: "Ações Defensivas",
    icon: "fa-shield",
    title: "Ações defensivas — volume acima de P60",
  },
};

function num(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function aboveThreshold(value: number | undefined): boolean {
  return value != null && value > STAT_BADGE_THRESHOLD;
}

/** Miniblock badge: every sub-metric percentile must be above P60. */
function metricGroupEarnsBadge(item: AspectItem): boolean {
  const subs = item.sub_metrics ?? [];
  if (subs.length < 2) return false;
  return subs.every((sub) => aboveThreshold(num(sub.percentile)));
}

/** Player earns a stat badge when quantity and efficiency (when available) are both > P60. */
export function metricEarnsStatBadge(item: AspectItem, displayLabel?: string): boolean {
  if (item.kind === "metric_group") {
    return metricGroupEarnsBadge(item);
  }

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
