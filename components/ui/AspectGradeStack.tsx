import { GradeBadge } from "@/components/ui/GradeBadge";
import { aspectGradeTriple } from "@/lib/aspectGrades";
import type { AspectItem } from "@/lib/types";

type Props = {
  item: AspectItem;
  size?: "sm" | "md";
};

export function AspectGradeStack({ item, size = "sm" }: Props) {
  const { quantidade, qualidade, geral } = aspectGradeTriple(item);
  const mini = size === "sm";

  return (
    <span className={`aspect-grade-stack${mini ? " aspect-grade-stack-sm" : ""}`}>
      {geral ? <GradeBadge letter={geral} size={size} /> : null}
      {(quantidade || qualidade) && (
        <span className="aspect-grade-mini-group" aria-label="Quantidade e qualidade">
          {quantidade ? (
            <span className="aspect-grade-mini" title="Quantidade — volume de ações">
              {quantidade}
            </span>
          ) : null}
          {qualidade ? (
            <span className="aspect-grade-mini" title="Qualidade — eficiência">
              {qualidade}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
