import { CompararClient } from "./CompararClient";
import { getFamilyPlayers, getMeta } from "@/lib/data.server";
import { familyBySlug } from "@/lib/positions";
import type { PositionFamily } from "@/lib/types";

type Props = {
  searchParams: Promise<{ posicao?: string; a?: string; b?: string }>;
};

export default async function CompararPage({ searchParams }: Props) {
  const { posicao, a, b } = await searchParams;
  const family = familyBySlug(posicao ?? "zagueiros");
  const players = getFamilyPlayers(family.key as PositionFamily);
  const meta = getMeta();
  const scatterMetrics = meta.scatter_metrics[family.key] ?? [];

  return (
    <CompararClient
      key={family.key}
      family={family.key as PositionFamily}
      players={players}
      scatterMetrics={scatterMetrics}
      initialA={a}
      initialB={b}
    />
  );
}
