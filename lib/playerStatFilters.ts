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
