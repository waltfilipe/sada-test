import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

function flattenAspects(player: PlayerProfile): AspectItem[] {
  const groups = player.aspects;
  return [
    ...(groups.defensivos ?? []),
    ...(groups.construcao ?? []),
    ...(groups.ofensivos ?? []),
    ...(groups.terco_final ?? []),
  ];
}

function findAspect(items: AspectItem[], label: string): AspectItem | undefined {
  const aliases: Record<string, string[]> = {
    "Passes Finais": ["Passes Finas", "Passes Finais"],
    Progressão: ["Progressão", "Conduções Progressivas"],
  };
  const candidates = aliases[label] ?? [label];
  return items.find((item) => candidates.some((c) => item.label === c || item.label.startsWith(c)));
}

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

function blend5050(a: number | undefined, b: number | undefined): number | undefined {
  if (a != null && b != null) return 0.5 * a + 0.5 * b;
  return a ?? b;
}

/** 50% volume + 50% efficiency when both exist; otherwise whichever is available. */
function volEffScore(item: AspectItem): number | undefined {
  return blend5050(num(item.percentile), num(item.efficiency_pct));
}

function defEfficiencyGroupScore(item: AspectItem): number | undefined {
  const subs = item.sub_metrics ?? [];
  const inter = subs.find((row) => row.label === "Interceptações");
  const cortes = subs.find((row) => row.label === "Rebatidas");
  const eff = subs.find((row) => row.label === "Eficiência Defensiva");
  const qty = averageDefined([num(inter?.percentile), num(cortes?.percentile)]);
  return blend5050(qty, num(eff?.percentile));
}

function metricGroupScore(item: AspectItem): number | undefined {
  const subs = item.sub_metrics ?? [];
  if (!subs.length) return num(item.percentile);

  if (item.label === "Cruzamentos") {
    const vol = subs.find((row) => row.label === "Cruzamentos");
    const eff = subs.find((row) => row.label === "Eficiência");
    return blend5050(num(vol?.percentile), num(eff?.percentile));
  }

  if (item.label === "Progressão") {
    return num(item.percentile) ?? averageDefined(subs.map((row) => num(row.percentile)));
  }

  return averageDefined(subs.map((row) => num(row.percentile)));
}

function blockScore(item: AspectItem | undefined): number | undefined {
  if (!item) return undefined;
  if (item.kind === "def_efficiency_group") return defEfficiencyGroupScore(item);
  if (item.kind === "metric_group") return metricGroupScore(item);
  if (item.kind === "pass_certos" || item.kind === "metric" || !item.kind) return volEffScore(item);
  return num(item.percentile);
}

/** Block labels per section — used for composite section score. */
const SECTION_BLOCK_LABELS: Partial<Record<PositionFamily, Record<string, string[]>>> = {
  zagueiros: {
    Defensivo: ["Duelos Defensivos", "Eficiência Defensiva"],
    Aéreo: ["Duelos Aéreos"],
    Construção: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
    Ofensivo: ["Duelos Ofensivos", "Conduções Progressivas"],
  },
  laterais: {
    Defensivo: ["Duelos Defensivos", "Eficiência Defensiva", "Duelos Aéreos"],
    Construção: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
    Ofensivo: ["Duelos Ofensivos", "Dribles", "Progressão"],
    "Terço Final": ["Cruzamentos", "Passes Finas", "Ofensividade"],
  },
};

export function playerSectionScore(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
): number | undefined {
  const blockLabels = SECTION_BLOCK_LABELS[family]?.[sectionTitle];
  if (!blockLabels?.length) return undefined;

  const all = flattenAspects(player);
  const blockScores = blockLabels
    .map((label) => blockScore(findAspect(all, label)))
    .filter((score): score is number => score != null);

  if (!blockScores.length) return undefined;
  return blockScores.reduce((sum, score) => sum + score, 0) / blockScores.length;
}

/** Same thresholds as pipeline `_grade_from_pct`. */
export function letterFromPercentile(pct: number): string {
  if (pct >= 85) return "A";
  if (pct >= 75) return "B+";
  if (pct >= 65) return "B";
  if (pct >= 55) return "B-";
  if (pct >= 45) return "C+";
  if (pct >= 35) return "C";
  if (pct >= 25) return "C-";
  return "D";
}

export function letterFromRating(rating: number, max = 10): string {
  return letterFromPercentile((rating / max) * 100);
}

export function playerSectionGrade(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
): string | undefined {
  const score = playerSectionScore(player, family, sectionTitle);
  if (score == null) return undefined;
  return letterFromPercentile(score);
}

export function allSectionGrades(
  player: PlayerProfile,
  family: PositionFamily,
): Record<string, string | undefined> {
  const sections = statSectionsForFamily(family);
  return Object.fromEntries(
    sections.map((section) => [section.title, playerSectionGrade(player, family, section.title)]),
  );
}
