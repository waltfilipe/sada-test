import { letterFromPercentile } from "@/lib/sectionGrades";
import type { AspectItem } from "@/lib/types";

function num(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function averageDefined(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return undefined;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

/** Volume-only percentile for an aspect subcard. */
export function aspectQuantityPercentile(item: AspectItem): number | undefined {
  if (item.kind === "def_efficiency_group") {
    const subs = item.sub_metrics ?? [];
    const inter = subs.find((row) => row.label === "Interceptações");
    const cortes = subs.find((row) => row.label === "Rebatidas");
    const qty = averageDefined([num(inter?.percentile), num(cortes?.percentile)]);
    if (qty != null) return qty;
    const acoes = subs.find((row) => row.label === "Ações bem-sucedidas");
    return num(acoes?.percentile);
  }

  if (item.kind === "metric_group") {
    const subs = item.sub_metrics ?? [];
    if (item.label === "Cruzamentos") {
      return num(subs.find((row) => row.label === "Cruzamentos")?.percentile);
    }
    const eff = subs.find((row) => row.label === "Eficiência" || row.label === "Eficiência Defensiva");
    if (eff) {
      const vol = subs.find((row) => row !== eff);
      return num(vol?.percentile);
    }
    return averageDefined(subs.map((row) => num(row.percentile)));
  }

  return num(item.percentile);
}

/** Efficiency-only percentile for an aspect subcard. */
export function aspectQualityPercentile(item: AspectItem): number | undefined {
  if (item.efficiency_pct != null) return num(item.efficiency_pct);

  if (item.kind === "def_efficiency_group") {
    return num(item.sub_metrics?.find((row) => row.label === "Eficiência Defensiva")?.percentile);
  }

  if (item.kind === "metric_group") {
    const eff = item.sub_metrics?.find((row) => row.label === "Eficiência" || row.label === "Eficiência Defensiva");
    return num(eff?.percentile);
  }

  return undefined;
}

export type AspectGradeTriple = {
  quantidade: string | null;
  qualidade: string | null;
  geral: string | null;
};

export function aspectGradeTriple(item: AspectItem): AspectGradeTriple {
  const qtyPct = aspectQuantityPercentile(item);
  const qualPct = aspectQualityPercentile(item);

  return {
    quantidade: qtyPct != null ? letterFromPercentile(qtyPct) : null,
    qualidade: qualPct != null ? letterFromPercentile(qualPct) : null,
    geral: item.grade ?? (qtyPct != null ? letterFromPercentile(qtyPct) : null),
  };
}
