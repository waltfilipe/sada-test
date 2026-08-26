import {
  getPlayerSectionGrade,
  type SectionGradeLookup,
} from "@/lib/sectionGrades";
import { gradeScore } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export type { SectionGradeLookup } from "@/lib/sectionGrades";

export function playerSectionGrade(
  lookup: SectionGradeLookup,
  playerId: string,
  sectionTitle: string,
): string | undefined {
  return getPlayerSectionGrade(lookup, playerId, sectionTitle);
}

export type StatLetterFilters = Record<string, string | null>;

export function playerMatchesStatLetterFilters(
  player: PlayerProfile,
  filters: StatLetterFilters,
  lookup: SectionGradeLookup,
): boolean {
  for (const [sectionTitle, minLetter] of Object.entries(filters)) {
    if (!minLetter) continue;
    const grade = getPlayerSectionGrade(lookup, player.player_id, sectionTitle);
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
  lookup: SectionGradeLookup,
): boolean {
  if (!sectionTitle || !minLetter) return true;
  return playerMatchesStatLetterFilters(player, { [sectionTitle]: minLetter }, lookup);
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
