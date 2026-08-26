import { playerSectionGrade as sectionGradeFromProfile } from "@/lib/sectionGrades";
import { gradeScore } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export function playerSectionGrade(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
): string | undefined {
  return sectionGradeFromProfile(player, family, sectionTitle);
}

export type StatLetterFilters = Record<string, string | null>;

export function playerMatchesStatLetterFilters(
  player: PlayerProfile,
  family: PositionFamily,
  filters: StatLetterFilters,
): boolean {
  for (const [sectionTitle, minLetter] of Object.entries(filters)) {
    if (!minLetter) continue;
    const grade = playerSectionGrade(player, family, sectionTitle);
    if (!grade) return false;
    if (gradeScore(grade) < gradeScore(minLetter)) return false;
  }
  return true;
}

/** @deprecated use playerMatchesStatLetterFilters */
export function playerMatchesStatLetterFilter(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string | null,
  minLetter: string | null,
): boolean {
  if (!sectionTitle || !minLetter) return true;
  return playerMatchesStatLetterFilters(player, family, { [sectionTitle]: minLetter });
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
