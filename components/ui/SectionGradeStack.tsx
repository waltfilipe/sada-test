import { GradeBadge } from "@/components/ui/GradeBadge";
import { letterGradePillColor } from "@/lib/gradeColors";
import type { SectionGradeTriple } from "@/lib/sectionGrades";

type Props = {
  grades?: SectionGradeTriple | null;
  size?: "sm" | "md";
};

function miniBadgeStyle(letter: string) {
  const color = letterGradePillColor(letter);
  return {
    color: "#f8fafc",
    background: `color-mix(in srgb, ${color} 58%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 42%, transparent)`,
  } as const;
}

export function SectionGradeStack({ grades, size = "sm" }: Props) {
  if (!grades) return null;
  const { geral, quantidade, qualidade } = grades;

  return (
    <span className={`section-grade-stack${size === "sm" ? " section-grade-stack-sm" : ""}`}>
      <GradeBadge letter={geral} size={size} />
      <span className="section-grade-mini-group" aria-label="Quantidade e qualidade">
        <span className="section-grade-mini" style={miniBadgeStyle(quantidade)} title="Quantidade — volume de ações">
          {quantidade}
        </span>
        <span className="section-grade-mini" style={miniBadgeStyle(qualidade)} title="Qualidade — eficiência">
          {qualidade}
        </span>
      </span>
    </span>
  );
}
