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

export function playerSectionGrade(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
): string | undefined {
  const section = statSectionsForFamily(family).find((item) => item.title === sectionTitle);
  if (!section) return undefined;
  const all = flattenAspects(player);
  const metrics = section.labels
    .map((label) => findAspect(all, label))
    .filter((item): item is AspectItem => Boolean(item));
  return metrics[0]?.grade;
}

export function playerMatchesStatLetterFilter(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string | null,
  minLetter: string | null,
): boolean {
  if (!sectionTitle || !minLetter) return true;
  const grade = playerSectionGrade(player, family, sectionTitle);
  if (!grade) return false;
  return gradeScore(grade) >= gradeScore(minLetter);
}

export const STAT_LETTER_OPTIONS = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
] as const;
