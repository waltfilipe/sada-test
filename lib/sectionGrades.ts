import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { gradeScore } from "@/lib/scoutTheme";
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
  };
  const candidates = aliases[label] ?? [label];
  return items.find((item) => candidates.some((c) => item.label === c || item.label.startsWith(c)));
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

const SECTION_RATING_KEY: Partial<Record<PositionFamily, Record<string, string>>> = {
  zagueiros: {
    Defensivo: "defesa",
    Construção: "construcao",
  },
  laterais: {
    Defensivo: "defensivo",
    Construção: "construtor",
    Ofensivo: "ofensivo",
  },
};

function aspectSectionLetter(metrics: AspectItem[]): string | undefined {
  if (!metrics.length) return undefined;
  let worst = metrics[0]?.grade;
  for (const metric of metrics.slice(1)) {
    if (gradeScore(metric.grade) < gradeScore(worst)) worst = metric.grade;
  }
  return worst;
}

export function playerSectionGrade(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
): string | undefined {
  const ratingKey = SECTION_RATING_KEY[family]?.[sectionTitle];
  if (ratingKey && player.ratings[ratingKey] != null) {
    return letterFromRating(player.ratings[ratingKey]);
  }

  const section = statSectionsForFamily(family).find((item) => item.title === sectionTitle);
  if (!section) return undefined;
  const all = flattenAspects(player);
  const metrics = section.labels
    .map((label) => findAspect(all, label))
    .filter((item): item is AspectItem => Boolean(item));
  return aspectSectionLetter(metrics);
}
