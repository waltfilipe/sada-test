import { ScatterClient } from "./ScatterClient";
import { getFamilyPlayers, getMeta } from "@/lib/data.server";
import { familyBySlug } from "@/lib/positions";
import type { PositionFamily } from "@/lib/types";

type Props = {
  searchParams: Promise<{ posicao?: string; a?: string; b?: string; x?: string; y?: string }>;
};

export default async function ScatterPage({ searchParams }: Props) {
  const { posicao, a, b, x, y } = await searchParams;
  const family = familyBySlug(posicao ?? "zagueiros");
  const players = getFamilyPlayers(family.key as PositionFamily);
  const meta = getMeta();
  const metrics = meta.scatter_metrics[family.key] ?? [];

  return (
    <ScatterClient
      key={family.key}
      family={family.key as PositionFamily}
      players={players}
      metrics={metrics}
      initialA={a}
      initialB={b}
      initialX={x}
      initialY={y}
    />
  );
}
