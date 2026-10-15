import { CompararClient } from "@/app/comparar/CompararClient";
import { compactHeatmap, getFamilyPlayers, getMeta } from "@/lib/data.server";
import { isLeagueId } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { notFound } from "next/navigation";
import type { PositionFamily } from "@/lib/types";

type Props = {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ posicao?: string; a?: string; b?: string; c?: string; triple?: string }>;
};

export default async function CompararPage({ params, searchParams }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const { posicao, a, b, c, triple } = await searchParams;
  const family = familyBySlug(posicao ?? "zagueiros");
  const players = getFamilyPlayers(family.key as PositionFamily, league).map((player) => {
    const heatmap = compactHeatmap(player.heatmap);
    return heatmap === player.heatmap ? player : { ...player, heatmap };
  });
  const meta = getMeta(league);
  const scatterMetrics = meta.scatter_metrics[family.key] ?? [];

  return (
    <CompararClient
      key={`${league}-${family.key}`}
      family={family.key as PositionFamily}
      players={players}
      scatterMetrics={scatterMetrics}
      heatmapsEnabled={meta.heatmaps_enabled !== false}
      initialA={a}
      initialB={b}
      initialC={c}
      initialTriple={triple === "1" || Boolean(c)}
    />
  );
}
